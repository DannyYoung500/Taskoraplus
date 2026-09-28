create table if not exists public.verification_scans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.verification_cases(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  scan_status text not null default 'completed' check (scan_status in ('completed','error')),
  outcome text not null default 'review' check (outcome in ('clear','review','high_risk')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  signals jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  scanned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists verification_scans_case_created_idx on public.verification_scans(case_id,created_at desc);
create index if not exists verification_scans_subject_created_idx on public.verification_scans(subject_type,subject_id,created_at desc);
alter table public.verification_scans enable row level security;
drop policy if exists "verification_scans_owner_read" on public.verification_scans;
create policy "verification_scans_owner_read" on public.verification_scans for select to authenticated using (coalesce(public.has_role(auth.uid(),'admin'),false));
drop policy if exists "verification_scans_owner_insert" on public.verification_scans;
create policy "verification_scans_owner_insert" on public.verification_scans for insert to authenticated with check (coalesce(public.has_role(auth.uid(),'admin'),false) and scanned_by=auth.uid());

create or replace function public.enforce_reward_provider_confirmation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_provider text;
begin
  select provider_key into v_provider from public.daily_missions where id=new.mission_id;
  if lower(coalesce(v_provider,''))='adsgram' and new.status='completed' and coalesce(trim(new.provider_event_id),'')='' then
    raise exception 'AdsGram reward cannot be completed without provider confirmation';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_reward_provider_confirmation on public.daily_mission_claims;
create trigger enforce_reward_provider_confirmation
before insert or update on public.daily_mission_claims
for each row execute function public.enforce_reward_provider_confirmation();