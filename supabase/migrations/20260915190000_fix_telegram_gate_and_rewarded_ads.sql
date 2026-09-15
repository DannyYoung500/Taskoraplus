alter table public.telegram_gate_settings
  add column if not exists required_chats jsonb not null default '[]'::jsonb;

update public.telegram_gate_settings
set required_chats = case
  when jsonb_array_length(coalesce(required_chats, '[]'::jsonb)) = 0 and nullif(trim(channel_id), '') is not null then
    jsonb_build_array(jsonb_build_object(
      'id', channel_id,
      'type', coalesce(chat_type, 'channel'),
      'url', coalesce(channel_url, ''),
      'name', coalesce(channel_name, 'TASKORA Community'),
      'verified', false
    ))
  else coalesce(required_chats, '[]'::jsonb)
end
where id = true;

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

-- Keep the Telegram Mini App ad catalog authoritative. Native-only ad SDK rows are not used here.
delete from public.monetization_providers
where category = 'ads'
  and provider_key in ('admob', 'applovin_max', 'unity_levelplay', 'unity_ads');
