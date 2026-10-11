-- Seed data for development and acceptance testing.
-- Two organizations with analyses in different states.
-- Run as service role (bypasses RLS) to insert.

-- ─── delete old placeholder rows ─────────────────────────────────────────────
delete from analyses where org_id in ('org_alpha', 'org_beta');
delete from projects  where org_id in ('org_alpha', 'org_beta');

-- ─── org 1: org_3KBuNSfAaxPeSRLTOzZKifZjgNS ─────────────────────────────────
insert into projects (id, org_id, repo_url, name) values
  ('00000000-0000-0000-0000-000000000001', 'org_3KBuNSfAaxPeSRLTOzZKifZjgNS',
   'https://github.com/vercel/next.js', 'next.js'),
  ('00000000-0000-0000-0000-000000000002', 'org_3KBuNSfAaxPeSRLTOzZKifZjgNS',
   'https://github.com/supabase/supabase', 'supabase')
on conflict do nothing;

insert into analyses (id, org_id, project_id, status, commit_sha) values
  ('00000000-0000-0000-0001-000000000001', 'org_3KBuNSfAaxPeSRLTOzZKifZjgNS',
   '00000000-0000-0000-0000-000000000001', 'done',    'abc1234'),
  ('00000000-0000-0000-0001-000000000002', 'org_3KBuNSfAaxPeSRLTOzZKifZjgNS',
   '00000000-0000-0000-0000-000000000001', 'failed',  'def5678'),
  ('00000000-0000-0000-0001-000000000003', 'org_3KBuNSfAaxPeSRLTOzZKifZjgNS',
   '00000000-0000-0000-0000-000000000002', 'running', null)
on conflict do nothing;

-- ─── org 2: org_3KByoqKFHxJ2Lb9TGl14GXXyvwW ─────────────────────────────────
insert into projects (id, org_id, repo_url, name) values
  ('00000000-0000-0000-0000-000000000003', 'org_3KByoqKFHxJ2Lb9TGl14GXXyvwW',
   'https://github.com/facebook/react', 'react')
on conflict do nothing;

insert into analyses (id, org_id, project_id, status, commit_sha) values
  ('00000000-0000-0000-0001-000000000004', 'org_3KByoqKFHxJ2Lb9TGl14GXXyvwW',
   '00000000-0000-0000-0000-000000000003', 'done',   '9f0e123'),
  ('00000000-0000-0000-0001-000000000005', 'org_3KByoqKFHxJ2Lb9TGl14GXXyvwW',
   '00000000-0000-0000-0000-000000000003', 'queued', null)
on conflict do nothing;
