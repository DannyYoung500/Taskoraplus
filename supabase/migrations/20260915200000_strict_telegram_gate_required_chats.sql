create table if not exists public.telegram_gate_settings (
  id boolean primary key default true,
  enabled boolean not null default false,
  chat_type text not null default 'channel',
  channel_id text,
  channel_url text,
  channel_name text not null default 'TASKORA Community',
  title text not null default 'JOIN TASKORA COMMUNITY',
  description text not null default 'Join the official TASKORA Telegram community to unlock the Mini App.',
  join_button_text text not null default 'JOIN TELEGRAM',
  check_button_text text not null default 'CHECK MEMBERSHIP',
  success_message text not null default 'Access unlocked.',
  failure_message text not null default 'Join every required Telegram community to continue.',
  check_interval_seconds integer not null default 30,
  revoke_on_leave boolean not null default true,
  allow_admins boolean not null default true,
  allow_creators boolean not null default true,
  allow_members boolean not null default true,
  allow_restricted boolean not null default false,
  required_chats jsonb not null default '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.telegram_gate_settings add column if not exists required_chats jsonb not null default '[]'::jsonb;
alter table public.telegram_gate_settings add column if not exists revoke_on_leave boolean not null default true;
alter table public.telegram_gate_settings add column if not exists check_interval_seconds integer not null default 30;

update public.telegram_gate_settings
set required_chats = case
  when jsonb_array_length(required_chats) > 0 then required_chats
  when nullif(trim(coalesce(channel_id,'')), '') is not null then jsonb_build_array(jsonb_build_object(
    'id', channel_id,
    'type', chat_type,
    'url', channel_url,
    'name', channel_name
  ))
  else '[]'::jsonb
end
where id = true;

create table if not exists public.telegram_gate_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  telegram_id bigint,
  status text not null,
  membership_status text,
  error_code text,
  checked_at timestamptz not null default now()
);

alter table public.telegram_gate_events enable row level security;

create index if not exists telegram_gate_events_user_checked_idx
  on public.telegram_gate_events(user_id, checked_at desc);
