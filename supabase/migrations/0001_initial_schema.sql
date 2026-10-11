-- Migration 0001: initial schema
-- Every table owns its rows through org_id. Deleting an organization cascades
-- through the whole tree. RLS is enabled on all tables; a table with security
-- on and no policy returns nothing, which is the safe failure mode.

-- ─── projects ────────────────────────────────────────────────────────────────
-- One row per GitHub repository URL an organization has mapped.
create table projects (
  id         uuid primary key default gen_random_uuid(),
  org_id     text not null,
  repo_url   text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, repo_url)
);

alter table projects enable row level security;

-- ─── analyses ────────────────────────────────────────────────────────────────
-- One row per parse run. Status tracks progress from queued through to done or
-- failed. project_id is nullable so an analysis can exist before its project
-- row is confirmed (rare, but avoids a race).
create table analyses (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null,
  project_id  uuid references projects (id) on delete cascade,
  status      text not null default 'queued'
                check (status in ('queued', 'running', 'done', 'failed')),
  commit_sha  text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table analyses enable row level security;

-- ─── files ───────────────────────────────────────────────────────────────────
-- One row per source file found in the repository for a given analysis.
create table files (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null,
  analysis_id uuid not null references analyses (id) on delete cascade,
  path        text not null,
  language    text,
  line_count  integer,
  created_at  timestamptz not null default now(),
  unique (analysis_id, path)
);

alter table files enable row level security;

-- ─── edges ───────────────────────────────────────────────────────────────────
-- A directed import edge between two files. source_id imports target_id.
-- kind distinguishes static imports, re-exports and dynamic imports.
create table edges (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null,
  analysis_id uuid not null references analyses (id) on delete cascade,
  source_id   uuid not null references files (id) on delete cascade,
  target_id   uuid not null references files (id) on delete cascade,
  kind        text not null default 'import'
                check (kind in ('import', 'reexport', 'dynamic', 'require')),
  created_at  timestamptz not null default now()
);

alter table edges enable row level security;

-- ─── routes ──────────────────────────────────────────────────────────────────
-- HTTP routes recovered from framework adapters. Both method and path must be
-- known; approximate routes are never stored (absent beats approximate).
create table routes (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null,
  analysis_id uuid not null references analyses (id) on delete cascade,
  file_id     uuid not null references files (id) on delete cascade,
  method      text not null,
  path        text not null,
  created_at  timestamptz not null default now()
);

alter table routes enable row level security;

-- ─── explanations ────────────────────────────────────────────────────────────
-- AI-generated paragraph explaining a file. The prompt_hash enables the cache
-- check inside the traced AI call — matching hash means a cache hit, no model
-- call needed.
create table explanations (
  id           uuid primary key default gen_random_uuid(),
  org_id       text not null,
  analysis_id  uuid not null references analyses (id) on delete cascade,
  file_id      uuid not null references files (id) on delete cascade,
  prompt_hash  text not null,
  content      text not null,
  model        text,
  created_at   timestamptz not null default now(),
  unique (file_id, prompt_hash)
);

alter table explanations enable row level security;

-- ─── file_roles ───────────────────────────────────────────────────────────────
-- What kind of thing a file is: page, component, util, etc. Populated by
-- framework adapters from convention, or by AI labelling when convention fails.
create table file_roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null,
  analysis_id uuid not null references analyses (id) on delete cascade,
  file_id     uuid not null references files (id) on delete cascade,
  role        text not null,
  source      text not null default 'convention'
                check (source in ('convention', 'ai')),
  created_at  timestamptz not null default now(),
  unique (file_id)
);

alter table file_roles enable row level security;

-- ─── insights ────────────────────────────────────────────────────────────────
-- Coverage and parse statistics for an analysis: how many files were parsed,
-- how many were skipped, and why the skipped ones failed.
create table insights (
  id              uuid primary key default gen_random_uuid(),
  org_id          text not null,
  analysis_id     uuid not null references analyses (id) on delete cascade,
  total_files     integer not null default 0,
  parsed_files    integer not null default 0,
  skipped_files   integer not null default 0,
  skip_reasons    jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  unique (analysis_id)
);

alter table insights enable row level security;

-- ─── Row-level security policies ─────────────────────────────────────────────
-- Every policy reads org_id off the Clerk JWT through auth.jwt(). Supabase
-- verifies the JWT against SUPABASE_JWT_SECRET before any policy runs.
-- The claim path is auth.jwt() -> 'org_id', which Clerk sets on every session
-- token when the user has an active organization.
--
-- Using (auth.jwt() ->> 'org_id') means the predicate is evaluated per row
-- entirely inside the database — application code can never bypass it.

-- projects
create policy "org members read their projects"
  on projects for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their projects"
  on projects for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their projects"
  on projects for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their projects"
  on projects for delete
  using (org_id = (auth.jwt() ->> 'org_id'));

-- analyses
create policy "org members read their analyses"
  on analyses for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their analyses"
  on analyses for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their analyses"
  on analyses for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their analyses"
  on analyses for delete
  using (org_id = (auth.jwt() ->> 'org_id'));

-- files
create policy "org members read their files"
  on files for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their files"
  on files for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their files"
  on files for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their files"
  on files for delete
  using (org_id = (auth.jwt() ->> 'org_id'));

-- edges
create policy "org members read their edges"
  on edges for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their edges"
  on edges for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their edges"
  on edges for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their edges"
  on edges for delete
  using (org_id = (auth.jwt() ->> 'org_id'));

-- routes
create policy "org members read their routes"
  on routes for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their routes"
  on routes for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their routes"
  on routes for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their routes"
  on routes for delete
  using (org_id = (auth.jwt() ->> 'org_id'));

-- explanations
create policy "org members read their explanations"
  on explanations for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their explanations"
  on explanations for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their explanations"
  on explanations for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their explanations"
  on explanations for delete
  using (org_id = (auth.jwt() ->> 'org_id'));

-- file_roles
create policy "org members read their file_roles"
  on file_roles for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their file_roles"
  on file_roles for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their file_roles"
  on file_roles for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their file_roles"
  on file_roles for delete
  using (org_id = (auth.jwt() ->> 'org_id'));

-- insights
create policy "org members read their insights"
  on insights for select
  using (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members insert their insights"
  on insights for insert
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members update their insights"
  on insights for update
  using (org_id = (auth.jwt() ->> 'org_id'))
  with check (org_id = (auth.jwt() ->> 'org_id'));

create policy "org members delete their insights"
  on insights for delete
  using (org_id = (auth.jwt() ->> 'org_id'));
