create table if not exists public.taskora_notification_settings(
  id boolean primary key default true check(id),
  task_channel_username text not null default '@TaskoraPlusNoti',
  official_channel_username text not null default '@TaskoraPlus',
  community_username text not null default '@TaskoraCommunity',
  bot_username text not null default '@TaskoraPlusBot',
  payout_image_url text,
  payout_image_file_name text,
  payout_message_template text not null default '✅ <b>Payout Successful!</b>\\n\\n💰 Amount: #amount USDT\\n📍 Network: #method\\n🧾 Ref: #reference\\n\\n🎉 Payment completed successfully.\\n🕐 Time: #time',
  updated_at timestamptz not null default now()
);
alter table public.taskora_notification_settings enable row level security;
insert into public.taskora_notification_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.telegram_notification_log(
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'sending' check(status in('sending','sent','failed')),
  telegram_message_id bigint,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.telegram_notification_log enable row level security;

do $$
declare img text; fname text; tpl text;
begin
  if to_regclass('public.payout_proof_settings') is not null then
    select payout_image_url,payout_image_file_name,message_template into img,fname,tpl
    from public.payout_proof_settings where id=true limit 1;
    update public.taskora_notification_settings
      set payout_image_url=coalesce(img,payout_image_url),
          payout_image_file_name=coalesce(fname,payout_image_file_name),
          payout_message_template=coalesce(tpl,payout_message_template),
          updated_at=now()
      where id=true;
    drop table public.payout_proof_settings;
  end if;
end $$;
