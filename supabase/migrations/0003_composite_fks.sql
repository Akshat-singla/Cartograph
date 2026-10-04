-- Migration 0003: composite foreign keys for tenant consistency
--
-- Problem: child tables reference parent tables only on (id), so a row in
-- e.g. edges could carry an org_id that differs from the org_id on its
-- parent analyses row. The RLS policies stop that being visible, but the
-- database itself doesn't enforce it.
--
-- Fix: add (id, org_id) unique constraints to every parent table, then
-- replace the single-column FKs in every child table with composite
-- references that include org_id. Cascade behaviour is preserved.
--
-- Order matters: parents before children, and unique constraints before the
-- FKs that reference them.

-- ─── Step 1: unique (id, org_id) on parent tables ────────────────────────────
-- id is already the primary key so this is essentially a covering index that
-- Postgres needs to satisfy the composite FK references below.

alter table projects
  add constraint projects_id_org_id_unique unique (id, org_id);

alter table analyses
  add constraint analyses_id_org_id_unique unique (id, org_id);

alter table files
  add constraint files_id_org_id_unique unique (id, org_id);

-- ─── Step 2: analyses → projects ─────────────────────────────────────────────
-- analyses.project_id is nullable (analysis can be created before project is
-- confirmed), so we only enforce org consistency when the value is present.

alter table analyses
  drop constraint if exists analyses_project_id_fkey;

alter table analyses
  add constraint analyses_project_id_org_id_fkey
  foreign key (project_id, org_id)
  references projects (id, org_id)
  on delete cascade;

-- ─── Step 3: files → analyses ────────────────────────────────────────────────

alter table files
  drop constraint if exists files_analysis_id_fkey;

alter table files
  add constraint files_analysis_id_org_id_fkey
  foreign key (analysis_id, org_id)
  references analyses (id, org_id)
  on delete cascade;

-- ─── Step 4: edges → analyses + files ────────────────────────────────────────

alter table edges
  drop constraint if exists edges_analysis_id_fkey;

alter table edges
  add constraint edges_analysis_id_org_id_fkey
  foreign key (analysis_id, org_id)
  references analyses (id, org_id)
  on delete cascade;

alter table edges
  drop constraint if exists edges_source_id_fkey;

alter table edges
  add constraint edges_source_id_org_id_fkey
  foreign key (source_id, org_id)
  references files (id, org_id)
  on delete cascade;

alter table edges
  drop constraint if exists edges_target_id_fkey;

alter table edges
  add constraint edges_target_id_org_id_fkey
  foreign key (target_id, org_id)
  references files (id, org_id)
  on delete cascade;

-- ─── Step 5: routes → analyses + files ───────────────────────────────────────

alter table routes
  drop constraint if exists routes_analysis_id_fkey;

alter table routes
  add constraint routes_analysis_id_org_id_fkey
  foreign key (analysis_id, org_id)
  references analyses (id, org_id)
  on delete cascade;

alter table routes
  drop constraint if exists routes_file_id_fkey;

alter table routes
  add constraint routes_file_id_org_id_fkey
  foreign key (file_id, org_id)
  references files (id, org_id)
  on delete cascade;

-- ─── Step 6: explanations → analyses + files ─────────────────────────────────

alter table explanations
  drop constraint if exists explanations_analysis_id_fkey;

alter table explanations
  add constraint explanations_analysis_id_org_id_fkey
  foreign key (analysis_id, org_id)
  references analyses (id, org_id)
  on delete cascade;

alter table explanations
  drop constraint if exists explanations_file_id_fkey;

alter table explanations
  add constraint explanations_file_id_org_id_fkey
  foreign key (file_id, org_id)
  references files (id, org_id)
  on delete cascade;

-- ─── Step 7: file_roles → analyses + files ───────────────────────────────────

alter table file_roles
  drop constraint if exists file_roles_analysis_id_fkey;

alter table file_roles
  add constraint file_roles_analysis_id_org_id_fkey
  foreign key (analysis_id, org_id)
  references analyses (id, org_id)
  on delete cascade;

alter table file_roles
  drop constraint if exists file_roles_file_id_fkey;

alter table file_roles
  add constraint file_roles_file_id_org_id_fkey
  foreign key (file_id, org_id)
  references files (id, org_id)
  on delete cascade;

-- ─── Step 8: insights → analyses ─────────────────────────────────────────────

alter table insights
  drop constraint if exists insights_analysis_id_fkey;

alter table insights
  add constraint insights_analysis_id_org_id_fkey
  foreign key (analysis_id, org_id)
  references analyses (id, org_id)
  on delete cascade;
