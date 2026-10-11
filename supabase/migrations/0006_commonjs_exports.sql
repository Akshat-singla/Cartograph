-- Migration 0006: preserve parser export names for CommonJS-aware analyses.
alter table files
  add column if not exists exports jsonb not null default '[]'::jsonb;

comment on column files.exports is
  'Export names read statically from ESM and CommonJS source syntax.';
