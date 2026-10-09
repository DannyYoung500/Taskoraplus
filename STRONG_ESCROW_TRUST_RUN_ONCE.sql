-- TASKORA strong escrow + trust columns (run once in Supabase SQL editor)

-- Campaign escrow tracking
alter table if exists public.campaigns
  add column if not exists last_verification_at timestamptz,
  add column if not exists funding_status text default 'draft',
  add column if not exists funding_reserved numeric default 0;

-- Profile trust recovery tracking
alter table if exists public.profiles
  add column if not exists trust_score numeric default 70,
  add column if not exists approved_count integer default 0,
  add column if not exists rejected_count integer default 0,
  add column if not exists last_verified_at timestamptz;

-- Velocity table (if not already from STRONG_VELOCITY)
create table if not exists public.action_velocity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists action_velocity_user_kind_created
  on public.action_velocity (user_id, kind, created_at desc);

create table if not exists public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_key text not null,
  last_seen_at timestamptz not null default now(),
  unique (user_id, session_key)
);
create index if not exists active_sessions_user_seen
  on public.active_sessions (user_id, last_seen_at desc);

-- Optional: soft RLS (service role bypasses)
alter table public.action_velocity enable row level security;
alter table public.active_sessions enable row level security;
