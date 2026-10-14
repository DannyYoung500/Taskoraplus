-- Strong P9 schema helpers (run once in Supabase SQL editor)
-- Soft: columns may already exist

alter table public.profiles
  add column if not exists device_fp text,
  add column if not exists payout_address text,
  add column if not exists payout_address_changed_at timestamptz,
  add column if not exists freeze_reason text,
  add column if not exists trust_score numeric default 0,
  add column if not exists selfie_verified_at timestamptz,
  add column if not exists status text default 'active';

create index if not exists profiles_device_fp_idx on public.profiles (device_fp)
  where device_fp is not null;

create table if not exists public.payout_receipts (
  withdrawal_id uuid primary key,
  tx_hash text,
  receipt_hash text,
  recorded_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.join_proofs (
  user_id uuid not null,
  task_id uuid not null,
  token text not null,
  expires_at timestamptz not null,
  primary key (user_id, task_id)
);
