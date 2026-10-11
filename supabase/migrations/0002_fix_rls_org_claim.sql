-- Migration 0002: fix RLS policies to read org_id from the correct JWT path.
-- Clerk v2 tokens nest the org under the "o" key: { o: { id: "org_..." } }.
-- The previous policies used auth.jwt() ->> 'org_id' which returns null.
-- This migration drops and recreates every policy with the correct path.

-- ─── projects ────────────────────────────────────────────────────────────────
drop policy if exists "org members read their projects"    on projects;
drop policy if exists "org members insert their projects"  on projects;
drop policy if exists "org members update their projects"  on projects;
drop policy if exists "org members delete their projects"  on projects;

create policy "org members read their projects"
  on projects for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their projects"
  on projects for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their projects"
  on projects for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their projects"
  on projects for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

-- ─── analyses ────────────────────────────────────────────────────────────────
drop policy if exists "org members read their analyses"    on analyses;
drop policy if exists "org members insert their analyses"  on analyses;
drop policy if exists "org members update their analyses"  on analyses;
drop policy if exists "org members delete their analyses"  on analyses;

create policy "org members read their analyses"
  on analyses for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their analyses"
  on analyses for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their analyses"
  on analyses for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their analyses"
  on analyses for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

-- ─── files ───────────────────────────────────────────────────────────────────
drop policy if exists "org members read their files"    on files;
drop policy if exists "org members insert their files"  on files;
drop policy if exists "org members update their files"  on files;
drop policy if exists "org members delete their files"  on files;

create policy "org members read their files"
  on files for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their files"
  on files for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their files"
  on files for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their files"
  on files for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

-- ─── edges ───────────────────────────────────────────────────────────────────
drop policy if exists "org members read their edges"    on edges;
drop policy if exists "org members insert their edges"  on edges;
drop policy if exists "org members update their edges"  on edges;
drop policy if exists "org members delete their edges"  on edges;

create policy "org members read their edges"
  on edges for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their edges"
  on edges for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their edges"
  on edges for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their edges"
  on edges for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

-- ─── routes ──────────────────────────────────────────────────────────────────
drop policy if exists "org members read their routes"    on routes;
drop policy if exists "org members insert their routes"  on routes;
drop policy if exists "org members update their routes"  on routes;
drop policy if exists "org members delete their routes"  on routes;

create policy "org members read their routes"
  on routes for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their routes"
  on routes for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their routes"
  on routes for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their routes"
  on routes for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

-- ─── explanations ────────────────────────────────────────────────────────────
drop policy if exists "org members read their explanations"    on explanations;
drop policy if exists "org members insert their explanations"  on explanations;
drop policy if exists "org members update their explanations"  on explanations;
drop policy if exists "org members delete their explanations"  on explanations;

create policy "org members read their explanations"
  on explanations for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their explanations"
  on explanations for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their explanations"
  on explanations for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their explanations"
  on explanations for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

-- ─── file_roles ───────────────────────────────────────────────────────────────
drop policy if exists "org members read their file_roles"    on file_roles;
drop policy if exists "org members insert their file_roles"  on file_roles;
drop policy if exists "org members update their file_roles"  on file_roles;
drop policy if exists "org members delete their file_roles"  on file_roles;

create policy "org members read their file_roles"
  on file_roles for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their file_roles"
  on file_roles for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their file_roles"
  on file_roles for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their file_roles"
  on file_roles for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

-- ─── insights ────────────────────────────────────────────────────────────────
drop policy if exists "org members read their insights"    on insights;
drop policy if exists "org members insert their insights"  on insights;
drop policy if exists "org members update their insights"  on insights;
drop policy if exists "org members delete their insights"  on insights;

create policy "org members read their insights"
  on insights for select
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members insert their insights"
  on insights for insert
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members update their insights"
  on insights for update
  using (org_id = (auth.jwt() -> 'o' ->> 'id'))
  with check (org_id = (auth.jwt() -> 'o' ->> 'id'));

create policy "org members delete their insights"
  on insights for delete
  using (org_id = (auth.jwt() -> 'o' ->> 'id'));
