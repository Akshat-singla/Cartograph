-- Persist import coverage and prevent concurrent duplicate analyses.
alter table insights
  add column if not exists total_imports integer not null default 0,
  add column if not exists resolved_imports integer not null default 0,
  add column if not exists external_imports integer not null default 0,
  add column if not exists excluded_imports integer not null default 0,
  add column if not exists failed_imports integer not null default 0;

create unique index if not exists analyses_one_per_project
  on analyses (project_id)
  where project_id is not null;
