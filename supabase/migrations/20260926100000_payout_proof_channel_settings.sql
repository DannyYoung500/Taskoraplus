-- Owner payout proof channel, profile preview, image and message template.
create table if not exists public.payout_proof_settings (
  id boolean primary key default true check (id),
  channel_id text not null default '',
  channel_username text,
  channel_title text,
  channel_description text,
  channel_photo_file_id text,
  channel_photo_url text,
  payout_image_url text,
  payout_image_file_name text,
  message_template text not null default '✅ <b>PAYOUT COMPLETE</b>\\n\\nAmount: <b>#amount</b> USDT\\nNetwork: #method\\nUser: #name\\nUsername: #username\\nTo: <code>#address</code>\\nTx: <code>#tx_hash</code>\\nRef: <code>#reference</code>\\nTime: #time',
  updated_at timestamptz not null default now()
);
alter table public.payout_proof_settings enable row level security;
insert into public.payout_proof_settings(id) values(true) on conflict(id) do nothing;
insert into storage.buckets(id,name,public) values('payout-proofs','payout-proofs',true) on conflict(id) do update set public=true;
drop policy if exists "Public payout proof images are readable" on storage.objects;
create policy "Public payout proof images are readable" on storage.objects for select using(bucket_id='payout-proofs');
insert into public.payout_proof_settings(id,channel_id)
select true,coalesce(value->>'channel_id',value->>'chat_id','') from public.app_settings where key='payout_channel'
on conflict(id) do update set channel_id=excluded.channel_id where public.payout_proof_settings.channel_id='';
