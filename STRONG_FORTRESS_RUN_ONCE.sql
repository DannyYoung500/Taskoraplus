-- STRONG_FORTRESS_RUN_ONCE.sql
-- Optional indexes / columns used by fortress + escrow + membership recheck

create index if not exists idx_transactions_user_created
  on transactions(user_id, created_at desc);

create index if not exists idx_submissions_user_status_created
  on submissions(user_id, status, created_at desc);

create index if not exists idx_submissions_task_status
  on submissions(task_id, status);

alter table campaigns add column if not exists last_verification_at timestamptz;
alter table campaigns add column if not exists funding_reserved numeric default 0;

create table if not exists action_velocity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_action_velocity_user_kind_time
  on action_velocity(user_id, kind, created_at desc);

alter table profiles add column if not exists trust_score numeric default 70;
alter table profiles add column if not exists device_fp text;
alter table profiles add column if not exists hold_until timestamptz;
