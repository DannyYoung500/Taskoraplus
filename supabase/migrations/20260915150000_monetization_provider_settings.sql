create extension if not exists supabase_vault with schema vault;

create table if not exists public.monetization_providers (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('games','ads','videos','offerwalls','payments','other')),
  provider_key text not null unique,
  provider_name text not null,
  enabled boolean not null default false,
  priority integer not null default 100,
  api_base_url text,
  public_id text,
  placement_id text,
  postback_url text,
  webhook_url text,
  revenue_share_percent numeric(6,3),
  user_reward_share_percent numeric(6,3),
  minimum_payout_usd numeric(20,8),
  settings jsonb not null default '{}'::jsonb,
  secret_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists monetization_providers_category_idx on public.monetization_providers(category, enabled, priority);

alter table public.monetization_providers enable row level security;
drop policy if exists "admins manage monetization providers" on public.monetization_providers;
create policy "admins manage monetization providers" on public.monetization_providers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.owner_monetization_save_secret(p_name text, p_secret text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare result_id uuid;
begin
  if p_name is null or length(trim(p_name)) < 3 then raise exception 'Invalid secret name'; end if;
  if p_secret is null or length(p_secret) = 0 then raise exception 'Secret cannot be empty'; end if;
  select id into result_id from vault.secrets where name = p_name limit 1;
  if result_id is null then
    result_id := vault.create_secret(p_secret, p_name, p_description);
  else
    perform vault.update_secret(result_id, p_secret, p_name, p_description);
  end if;
  return result_id;
end;
$$;
revoke all on function public.owner_monetization_save_secret(text,text,text) from public, anon, authenticated;
grant execute on function public.owner_monetization_save_secret(text,text,text) to service_role;

insert into public.monetization_providers (category,provider_key,provider_name,priority) values
('games','playgama','Playgama Partners',10),
('games','gamezop','Gamezop',20),
('games','gamedistribution','GameDistribution',30),
('games','gamemonetize','GameMonetize',40),
('games','gamepix','GamePix',50),
('ads','admob','Google AdMob',10),
('ads','applovin_max','AppLovin MAX',20),
('ads','unity_levelplay','Unity LevelPlay',30),
('ads','unity_ads','Unity Ads',40),
('videos','youtube','YouTube',10),
('videos','tiktok','TikTok',20),
('videos','x','X',30),
('videos','instagram','Instagram',40),
('videos','facebook','Facebook',50),
('offerwalls','adgem','AdGem',10),
('offerwalls','offerwall_gg','Offerwall.GG',20),
('offerwalls','adswedmedia','AdswedMedia',30),
('offerwalls','kooads','KooAds',40)
on conflict (provider_key) do update set provider_name=excluded.provider_name, category=excluded.category;
