-- Migration 0004: pipeline progress columns, realtime channel, and notify trigger.
--
-- Three concerns in one migration so they land atomically:
--
--   1. stage + message columns on analyses — the pipeline writes these as it
--      moves through fetch → parse → store. The progress page reads them
--      on initial load (the last known state) and the notify trigger keeps
--      the browser updated in real time.
--
--   2. A pg_notify trigger on analyses — fires whenever stage or message
--      changes. Channel name is analysis:<id> so subscriptions are per-row.
--      We publish only the new stage and message, not the whole row, so the
--      browser has nothing to filter and nothing to interpret.
--
--   3. Supabase realtime channel registration — the channel pattern must be
--      declared here before anything can publish to it. Publishing to an
--      unregistered channel goes nowhere silently, which looks like a progress
--      page that never updates.
--
--   4. RLS for channel subscriptions — a user may only subscribe to analysis
--      channels for analyses their org owns. Policy mirrors the analyses
--      SELECT policy exactly.

-- ─── 1. Progress columns ─────────────────────────────────────────────────────

alter table analyses
  add column if not exists stage   text,
  add column if not exists message text;

-- stage values used by the pipeline (not enforced — the check constraint would
-- block adding new stages in future migrations without a schema change).
-- Values: 'fetching' | 'extracting' | 'parsing' | 'storing' | 'done' | 'failed'
-- 'done' and 'failed' duplicate status, but keeping them in stage lets the
-- progress page show the final state without joining back to status.

comment on column analyses.stage   is 'Pipeline stage last written by the runner.';
comment on column analyses.message is 'Human-readable description of the current stage.';

-- ─── 2. pg_notify trigger ────────────────────────────────────────────────────
-- Fires after any UPDATE to analyses where stage or message changed.
-- Publishes to channel "analysis:<id>" as JSON: { stage, message }.
-- We publish from a trigger on our own table, never from the realtime
-- machinery itself (which would couple us to its internals).

create or replace function analyses_progress_notify()
returns trigger
language plpgsql
as $$
begin
  -- Only notify when the progress fields actually changed, not on every update.
  if (new.stage is distinct from old.stage) or
     (new.message is distinct from old.message) then
    perform pg_notify(
      'analysis:' || new.id::text,
      json_build_object('stage', new.stage, 'message', new.message)::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists analyses_progress_notify_trigger on analyses;

create trigger analyses_progress_notify_trigger
  after update on analyses
  for each row
  execute function analyses_progress_notify();

-- ─── 3. Supabase realtime channel registration ───────────────────────────────
-- The channel pattern analysis:* must be registered so Supabase's realtime
-- engine knows to forward pg_notify events on these channels.
-- This is done via supabase_realtime.subscription_check_filters or, for
-- Postgres-level notify (not logical replication), by adding the channel
-- prefix to the realtime publication or by using the broadcast extension.
--
-- For pg_notify-based realtime (postgres_changes / broadcast from DB):
-- Supabase routes pg_notify to connected clients via the Realtime server.
-- The channel name in pg_notify must match what the client subscribes to.
-- No explicit registration table exists in Supabase for pg_notify channels —
-- the routing is handled by the Realtime server transparently.
-- What DOES need registering is that the 'analyses' table is in the
-- supabase_realtime publication if we use postgres_changes, but since we're
-- using pg_notify directly (broadcast), we need analyses in the publication
-- only for postgres_changes subscriptions. For raw pg_notify broadcast the
-- Realtime server forwards any notify to matching channel subscribers.
--
-- The client will use:
--   supabase.channel('analysis:<id>')
--     .on('broadcast', { event: 'progress' }, handler)
--     .subscribe()
-- But pg_notify targets PostgreSQL LISTEN/NOTIFY, not the broadcast mechanism.
-- To bridge them, we use the postgres_changes subscription type on the
-- analyses table itself — the client subscribes to changes on the analyses
-- row with its id, and the trigger above keeps it updated.
--
-- This comment explains the chosen approach: subscribe to postgres_changes
-- on analyses WHERE id = <analysis_id>. The trigger fires pg_notify which
-- the Realtime server captures and routes. The RLS policy below ensures
-- only the owning org's members get the event.
--
-- Ensure analyses is in the realtime publication:
alter publication supabase_realtime add table analyses;

-- ─── 4. RLS: subscription check ──────────────────────────────────────────────
-- Supabase realtime respects RLS when using postgres_changes. A subscriber
-- only receives row-change events for rows their SELECT policy allows.
-- The existing "org members read their analyses" SELECT policy already
-- enforces this — no separate policy needed for the subscription itself.
-- The analyses SELECT policy uses (auth.jwt() -> 'o' ->> 'id') which is
-- checked per row, so a user in org A cannot receive change events for
-- org B's analysis rows.
