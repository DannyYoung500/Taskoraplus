-- Taskora country targeting for advertiser campaigns and worker eligibility.
alter table public.campaigns
  add column if not exists target_country_code text,
  add column if not exists target_country_name text,
  add column if not exists allow_other_countries_if_unavailable boolean not null default true;

alter table public.tasks
  add column if not exists target_country_code text,
  add column if not exists target_country_name text,
  add column if not exists allow_other_countries_if_unavailable boolean not null default true;

create index if not exists tasks_target_country_code_idx
  on public.tasks(target_country_code)
  where target_country_code is not null;

create index if not exists profiles_active_country_code_idx
  on public.profiles(country_code)
  where country_code is not null and status = 'active';
