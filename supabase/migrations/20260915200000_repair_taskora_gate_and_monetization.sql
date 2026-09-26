-- Repair existing TASKORA Telegram Gate and monetization provider schemas without resetting data.
-- This migration is additive and safe to run on an existing database.

alter table public.telegram_gate_settings
  add column if not exists required_chats jsonb not null default '[]'::jsonb;

update public.telegram_gate_settings
set required_chats = jsonb_build_array(
  jsonb_build_object(
    'id', channel_id,
    'type', case when coalesce(channel_id, '') <> '' then 'channel' else 'channel' end,
    'url', coalesce(channel_url, ''),
    'name', coalesce(channel_name, 'TASKORA Community'),
    'username', null,
    'description', null,
    'memberCount', null,
    'verified', false
  )
)
where channel_id is not null
  and btrim(channel_id) <> ''
  and (required_chats = '[]'::jsonb or required_chats is null);

insert into public.monetization_providers (category, provider_key, provider_name, priority)
values
  ('ads', 'adsgram', 'AdsGram', 10),
  ('ads', 'monetag', 'Monetag', 20),
  ('ads', 'onclicka', 'OnClickA', 30),
  ('ads', 'richads', 'RichAds', 40),
  ('ads', 'gigapub', 'GigaPub', 50),
  ('ads', 'tads', 'TADS', 60)
on conflict (provider_key) do update
set category = excluded.category,
    provider_name = excluded.provider_name;

create index if not exists telegram_gate_settings_required_chats_gin_idx
  on public.telegram_gate_settings using gin (required_chats);
