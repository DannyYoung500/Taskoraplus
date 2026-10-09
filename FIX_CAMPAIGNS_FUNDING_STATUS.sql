-- TASKORA: expand campaigns.funding_status check so owner-free + draft work
-- Run once in Supabase SQL editor

-- Allow common funding states used by app + owner-sponsored posts
do $$
begin
  -- Drop old check if present
  if exists (
    select 1 from pg_constraint
    where conname = 'campaigns_funding_status_check'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns drop constraint campaigns_funding_status_check;
  end if;

  alter table public.campaigns
    add constraint campaigns_funding_status_check
    check (
      funding_status is null
      or funding_status in (
        'draft',
        'unfunded',
        'reserved',
        'funded',
        'sponsored',
        'released',
        'spent',
        'completed',
        'cancelled'
      )
    );
end $$;

-- Optional owner-sponsored flag
alter table if exists public.campaigns
  add column if not exists owner_sponsored boolean default false;

-- Ensure defaults are safe
alter table if exists public.campaigns
  alter column funding_status set default 'draft';
