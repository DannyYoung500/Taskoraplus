-- Strong velocity + session integrity tables (run once in Supabase SQL editor)
create table if not exists action_velocity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_action_velocity_user_kind_time
  on action_velocity(user_id, kind, created_at desc);

create table if not exists active_sessions (
  user_id uuid not null references profiles(id),
  session_key text not null,
  last_seen timestamptz not null default now(),
  primary key (user_id, session_key)
);
