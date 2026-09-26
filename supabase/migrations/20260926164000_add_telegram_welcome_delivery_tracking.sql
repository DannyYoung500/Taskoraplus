create table if not exists public.telegram_welcome_deliveries (
  telegram_id bigint primary key,
  referral_code text,
  inviter_profile_id uuid references public.profiles(id) on delete set null,
  inviter_name text,
  sent_at timestamptz not null default now()
);

create index if not exists telegram_welcome_deliveries_inviter_idx
  on public.telegram_welcome_deliveries(inviter_profile_id);
