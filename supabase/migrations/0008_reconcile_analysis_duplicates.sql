-- Merge duplicate analyses before enforcing one analysis per project.
-- This is separate from 0007 because migrations already applied must not be
-- edited in place.
drop index if exists analyses_one_per_project;

do $$
declare
  duplicate_group record;
  duplicate_analysis record;
  duplicate_file record;
  canonical_id uuid;
  canonical_file_id uuid;
  target_insight insights%rowtype;
  source_insight insights%rowtype;
begin
  for duplicate_group in
    select project_id
    from analyses
    where project_id is not null
    group by project_id
    having count(*) > 1
  loop
    select min(id) into canonical_id
    from analyses
    where project_id = duplicate_group.project_id;

    for duplicate_analysis in
      select id
      from analyses
      where project_id = duplicate_group.project_id
        and id <> canonical_id
    loop
      for duplicate_file in
        select duplicate_file.id, duplicate_file.path
        from files duplicate_file
        where duplicate_file.analysis_id = duplicate_analysis.id
      loop
        select canonical_file.id into canonical_file_id
        from files canonical_file
        where canonical_file.analysis_id = canonical_id
          and canonical_file.path = duplicate_file.path;

        if canonical_file_id is not null then
          update edges set source_id = canonical_file_id where source_id = duplicate_file.id;
          update edges set target_id = canonical_file_id where target_id = duplicate_file.id;
          update routes set file_id = canonical_file_id where file_id = duplicate_file.id;
          update explanations
          set file_id = canonical_file_id
          where file_id = duplicate_file.id
            and not exists (
              select 1
              from explanations existing_explanation
              where existing_explanation.file_id = canonical_file_id
                and existing_explanation.prompt_hash = explanations.prompt_hash
            );
          delete from explanations duplicate_explanation
          where duplicate_explanation.file_id = duplicate_file.id;

          if exists (select 1 from file_roles where file_id = canonical_file_id) then
            delete from file_roles where file_id = duplicate_file.id;
          else
            update file_roles
            set file_id = canonical_file_id, analysis_id = canonical_id
            where file_id = duplicate_file.id;
          end if;

          delete from files where id = duplicate_file.id;
        end if;
      end loop;

      update files duplicate_file
      set analysis_id = canonical_id
      where duplicate_file.analysis_id = duplicate_analysis.id
        and not exists (
          select 1 from files canonical_file
          where canonical_file.analysis_id = canonical_id
            and canonical_file.path = duplicate_file.path
        );

      update edges set analysis_id = canonical_id where analysis_id = duplicate_analysis.id;
      update routes set analysis_id = canonical_id where analysis_id = duplicate_analysis.id;
      update file_roles set analysis_id = canonical_id where analysis_id = duplicate_analysis.id;
      update explanations set analysis_id = canonical_id where analysis_id = duplicate_analysis.id;

      if exists (select 1 from insights where analysis_id = canonical_id)
         and exists (select 1 from insights where analysis_id = duplicate_analysis.id) then
        select * into target_insight from insights where analysis_id = canonical_id;
        select * into source_insight from insights where analysis_id = duplicate_analysis.id;

        update insights target
        set total_files = target.total_files + source_insight.total_files,
            parsed_files = target.parsed_files + source_insight.parsed_files,
            skipped_files = target.skipped_files + source_insight.skipped_files,
            total_imports = target.total_imports + source_insight.total_imports,
            resolved_imports = target.resolved_imports + source_insight.resolved_imports,
            external_imports = target.external_imports + source_insight.external_imports,
            excluded_imports = target.excluded_imports + source_insight.excluded_imports,
            failed_imports = target.failed_imports + source_insight.failed_imports,
            skip_reasons = (
              select coalesce(jsonb_object_agg(key, to_jsonb(total)), '{}'::jsonb)
              from (
                select key, sum(value::integer) as total
                from (
                  select key, value from jsonb_each_text(target_insight.skip_reasons)
                  union all
                  select key, value from jsonb_each_text(source_insight.skip_reasons)
                ) reason_rows
                group by key
              ) merged_reasons
            )
        where target.analysis_id = canonical_id;
        delete from insights where analysis_id = duplicate_analysis.id;
      elsif exists (select 1 from insights where analysis_id = duplicate_analysis.id) then
        update insights set analysis_id = canonical_id
        where analysis_id = duplicate_analysis.id;
      end if;

      delete from analyses where id = duplicate_analysis.id;
    end loop;
  end loop;
end $$;

create unique index if not exists analyses_one_per_project
  on analyses (project_id)
  where project_id is not null;
