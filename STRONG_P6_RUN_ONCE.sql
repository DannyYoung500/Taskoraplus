-- STRONG_P6_RUN_ONCE.sql
-- Optional tables for P6 liveness + proof tokens (soft-fail if missing)

create table if not exists public.liveness_challenges (
  user_id uuid not null,
  task_id uuid not null,
  code_hash text not null,
  code_plain text,
  expires_at timestamptz not null,
  consumed boolean default false,
  consumed_at timestamptz,
  created_at timestamptz default now(),
  primary key (user_id, task_id)
);

create index if not exists idx_liveness_expires on public.liveness_challenges (expires_at);

create table if not exists public.proof_upload_tokens (
  user_id uuid primary key,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

do $$ begin
  alter table public.profiles add column if not exists device_fp text;
  alter table public.profiles add column if not exists last_ip_hint text;
  alter table public.profiles add column if not exists trust_score numeric default 50;
  alter table public.profiles add column if not exists shadowbanned boolean default false;
  alter table public.profiles add column if not exists connected_count int default 0;
exception when others then null;
end $$;
