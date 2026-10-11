-- Migration 0005: framework detection columns and routes extension.
--
-- The routes and file_roles tables already exist from migration 0001.
-- RLS policies are already in place (migration 0001).
-- Composite FKs are already in place (migration 0003).
--
-- This migration:
--   1. Adds analyses.framework — the detected framework key written by the pipeline.
--   2. Adds routes.handler_name — the exported function name for the route handler.
--   3. Adds routes to the supabase_realtime publication so the UI can subscribe.

-- ─── 1. Framework detection result ───────────────────────────────────────────
alter table analyses
  add column if not exists framework text;

comment on column analyses.framework is
  'Framework key written by the pipeline after detection: nextjs | nestjs | react | generic';

-- ─── 2. Route handler name ────────────────────────────────────────────────────
-- routes.path already holds the URL pattern (e.g. /api/users).
-- handler_name stores the exported function name (e.g. GET, createUser).
alter table routes
  add column if not exists handler_name text;

comment on column routes.handler_name is
  'Exported function name for this route (e.g. GET, createUser). Null for legacy rows.';

-- ─── 3. Realtime publication ──────────────────────────────────────────────────
alter publication supabase_realtime add table routes;
