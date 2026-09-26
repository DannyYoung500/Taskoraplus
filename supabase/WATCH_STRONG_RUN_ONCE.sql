-- Watch strong ops: heartbeat columns + one completion uniqueness (run once in Supabase SQL)
alter table if exists public.watch_video_sessions
  add column if not exists qualified_seconds integer default 0,
  add column if not exists last_heartbeat_at timestamptz;

-- Prevent double reward races (one completed session per user+video)
create unique index if not exists watch_video_sessions_one_complete
  on public.watch_video_sessions (user_id, video_id)
  where status = 'completed';

-- Helpful index for active sessions
create index if not exists watch_video_sessions_active_user
  on public.watch_video_sessions (user_id, video_id, status);
