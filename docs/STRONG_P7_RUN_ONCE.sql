-- Strong P7 schema (run once in Supabase SQL editor)
-- Safe: IF NOT EXISTS / exception handlers

-- Profiles: soft KYC
do $$ begin
  alter table public.profiles add column if not exists kyc_status text default 'none';
  alter table public.profiles add column if not exists selfie_passed boolean default false;
  alter table public.profiles add column if not exists kyc_at timestamptz;
exception when others then null;
end $$;

-- Campaigns: bond tracking
do $$ begin
  alter table public.campaigns add column if not exists bond_usd numeric default 0;
  alter table public.campaigns add column if not exists bond_slashed_usd numeric default 0;
  alter table public.campaigns add column if not exists review_note text;
exception when others then null;
end $$;

-- Submissions: leave / clawback flags
do $$ begin
  alter table public.submissions add column if not exists clawback boolean default false;
  alter table public.submissions add column if not exists left_channel boolean default false;
exception when others then null;
end $$;

create index if not exists idx_withdrawals_paid_status
  on public.withdrawals (status, updated_at desc)
  where status in ('paid', 'completed', 'success');

create table if not exists public.task_cooldown_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  task_id uuid,
  advertiser_key text,
  device_fp text,
  created_at timestamptz default now()
);
create index if not exists idx_cooldown_device_adv
  on public.task_cooldown_events (device_fp, advertiser_key, created_at desc);
