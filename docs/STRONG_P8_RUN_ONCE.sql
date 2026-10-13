-- Strong P8 schema (run once in Supabase SQL editor)

create table if not exists public.proof_watermarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  task_id uuid not null,
  code text not null,
  expires_at timestamptz,
  consumed boolean default false,
  consumed_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, task_id)
);

create table if not exists public.task_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  task_id uuid not null,
  notified boolean default false,
  notified_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, task_id)
);

create index if not exists idx_waitlist_task_notified
  on public.task_waitlist (task_id, notified)
  where notified = false;
