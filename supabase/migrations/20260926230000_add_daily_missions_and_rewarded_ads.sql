
create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  mission_type text not null check (mission_type in ('task','rewarded_ad')),
  task_id uuid references public.tasks(id) on delete set null,
  provider_key text,
  reward_usdt numeric(18,8) not null default 0 check (reward_usdt >= 0),
  reward_points integer not null default 0 check (reward_points >= 0),
  daily_limit integer not null default 1 check (daily_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((mission_type = 'task' and task_id is not null) or (mission_type = 'rewarded_ad' and provider_key is not null))
);
create index if not exists daily_missions_active_idx on public.daily_missions(is_active, starts_at, ends_at);
create index if not exists daily_missions_task_idx on public.daily_missions(task_id);
create table if not exists public.daily_mission_claims (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.daily_missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_date date not null,
  status text not null default 'completed' check (status in ('pending','completed','rejected')),
  reward_usdt numeric(18,8) not null default 0,
  reward_points integer not null default 0,
  provider_event_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (mission_id, user_id, mission_date)
);
create index if not exists daily_mission_claims_user_date_idx on public.daily_mission_claims(user_id, mission_date);
create unique index if not exists daily_mission_claims_provider_event_idx on public.daily_mission_claims(provider_event_id) where provider_event_id is not null;
alter table public.daily_missions enable row level security;
alter table public.daily_mission_claims enable row level security;
drop policy if exists "daily_missions_public_read" on public.daily_missions;
create policy "daily_missions_public_read" on public.daily_missions for select to authenticated using (is_active = true);
drop policy if exists "daily_mission_claims_own_read" on public.daily_mission_claims;
create policy "daily_mission_claims_own_read" on public.daily_mission_claims for select to authenticated using (user_id = auth.uid());
insert into public.app_settings(key,value) values ('daily_missions','{"enabled":true,"daily_ad_limit":5,"default_ad_reward_usdt":0.01,"default_ad_reward_points":0}'::jsonb) on conflict (key) do nothing;
