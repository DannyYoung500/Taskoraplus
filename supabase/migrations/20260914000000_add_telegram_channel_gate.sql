create table if not exists public.telegram_gate_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default false,
  channel_id text,
  channel_url text,
  channel_name text not null default 'TASKORA Community',
  title text not null default 'JOIN TASKORA COMMUNITY',
  description text not null default 'Join our official Telegram channel to unlock TASKORA and start earning.',
  join_button_text text not null default 'JOIN TELEGRAM CHANNEL',
  check_button_text text not null default 'CHECK MEMBERSHIP',
  success_message text not null default 'Your TASKORA access has been unlocked.',
  failure_message text not null default 'Please join the official TASKORA channel and try again.',
  check_interval_seconds integer not null default 300 check (check_interval_seconds between 30 and 86400),
  revoke_on_leave boolean not null default true,
  allow_admins boolean not null default true,
  allow_creators boolean not null default true,
  allow_members boolean not null default true,
  allow_restricted boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.telegram_gate_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.telegram_gate_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  telegram_id bigint,
  status text not null check (status in ('verified','not_member','error','bypassed')),
  membership_status text,
  error_code text,
  checked_at timestamptz not null default now()
);

alter table public.telegram_gate_settings enable row level security;
alter table public.telegram_gate_events enable row level security;

revoke all on public.telegram_gate_settings from anon, authenticated;
revoke all on public.telegram_gate_events from anon, authenticated;

create or replace function public.set_telegram_gate_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists telegram_gate_settings_updated_at on public.telegram_gate_settings;
create trigger telegram_gate_settings_updated_at
before update on public.telegram_gate_settings
for each row execute function public.set_telegram_gate_updated_at();
