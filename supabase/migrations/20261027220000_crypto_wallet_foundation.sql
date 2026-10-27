-- TASKORA production crypto wallet foundation.
-- Additive only: preserves existing profiles, balances, deposits, withdrawals and policies.
begin;

create table if not exists public.crypto_asset_networks (
  id text primary key,
  asset_code text not null,
  asset_name text not null,
  network_code text not null,
  network_name text not null,
  address text,
  memo text,
  token_contract text,
  decimals smallint not null default 8 check (decimals between 0 and 30),
  confirmations_required integer not null default 1 check (confirmations_required >= 1),
  min_deposit_usd numeric(20,8) not null default 5 check (min_deposit_usd >= 0),
  min_withdrawal_usd numeric(20,8) not null default 3 check (min_withdrawal_usd >= 0),
  deposit_enabled boolean not null default false,
  withdrawal_enabled boolean not null default false,
  provider_key text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_code, network_code)
);

alter table public.crypto_asset_networks enable row level security;
revoke all on table public.crypto_asset_networks from public, anon;
grant select on table public.crypto_asset_networks to authenticated;
grant all on table public.crypto_asset_networks to service_role;
drop policy if exists "crypto networks public active read" on public.crypto_asset_networks;
create policy "crypto networks public active read"
  on public.crypto_asset_networks for select to authenticated
  using (deposit_enabled or withdrawal_enabled);
drop policy if exists "crypto networks admin manage" on public.crypto_asset_networks;
create policy "crypto networks admin manage"
  on public.crypto_asset_networks for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

-- Start disabled: no network is advertised until an owner configures a real address/provider.
insert into public.crypto_asset_networks
  (id, asset_code, asset_name, network_code, network_name, decimals, confirmations_required, sort_order)
values
  ('USDT · TRC20', 'USDT', 'Tether USD', 'TRC20', 'Tron', 6, 20, 10),
  ('USDT · BEP20', 'USDT', 'Tether USD', 'BEP20', 'BNB Smart Chain', 18, 15, 20),
  ('USDT · ERC20', 'USDT', 'Tether USD', 'ERC20', 'Ethereum', 6, 12, 30),
  ('TON', 'TON', 'Toncoin', 'TON', 'The Open Network', 9, 1, 40),
  ('BTC', 'BTC', 'Bitcoin', 'BITCOIN', 'Bitcoin', 8, 2, 50),
  ('ETH', 'ETH', 'Ether', 'ERC20', 'Ethereum', 18, 12, 60),
  ('BNB · BEP20', 'BNB', 'BNB', 'BEP20', 'BNB Smart Chain', 18, 15, 70)
on conflict (id) do update set
  asset_code = excluded.asset_code,
  asset_name = excluded.asset_name,
  network_code = excluded.network_code,
  network_name = excluded.network_name,
  decimals = excluded.decimals,
  confirmations_required = excluded.confirmations_required,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table if exists public.deposits
  add column if not exists asset_code text,
  add column if not exists network text,
  add column if not exists tx_hash text,
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists amount_crypto numeric(36,18),
  add column if not exists confirmations integer not null default 0,
  add column if not exists confirmed_at timestamptz;

alter table if exists public.withdrawals
  add column if not exists asset_code text,
  add column if not exists network text,
  add column if not exists tx_hash text,
  add column if not exists provider text,
  add column if not exists provider_payout_id text,
  add column if not exists fee numeric(20,8) not null default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists failure_reason text;

create index if not exists deposits_status_created_crypto_idx
  on public.deposits (status, created_at desc);
create index if not exists withdrawals_status_created_crypto_idx
  on public.withdrawals (status, created_at desc);
create index if not exists deposits_tx_hash_crypto_idx
  on public.deposits (lower(tx_hash))
  where tx_hash is not null and length(trim(tx_hash)) > 0;
create unique index if not exists deposits_provider_payment_unique_idx
  on public.deposits (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;
create index if not exists withdrawals_tx_hash_crypto_idx
  on public.withdrawals (lower(tx_hash))
  where tx_hash is not null and length(trim(tx_hash)) > 0;

-- Idempotency/audit inbox for signed provider webhooks. Raw payload is service-role only.
create table if not exists public.crypto_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payment_reference text,
  tx_hash text,
  network text,
  asset_code text,
  amount_crypto numeric(36,18),
  amount_usd numeric(20,8),
  confirmations integer not null default 0,
  signature_verified boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received','verified','processed','ignored','failed')),
  deposit_id uuid references public.deposits(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  failure_reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);
alter table public.crypto_provider_events enable row level security;
revoke all on table public.crypto_provider_events from public, anon, authenticated;
grant all on table public.crypto_provider_events to service_role;
create index if not exists crypto_provider_events_status_received_idx
  on public.crypto_provider_events (processing_status, received_at desc);
create index if not exists crypto_provider_events_tx_hash_idx
  on public.crypto_provider_events (lower(tx_hash))
  where tx_hash is not null;

commit;
