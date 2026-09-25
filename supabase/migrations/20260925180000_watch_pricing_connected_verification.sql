-- Taskora pricing, watch duration, connected verification, and video storage hardening.
update public.advertise_economy_settings
set default_tasker_share_percent=70,
    default_taskora_margin_percent=30,
    youtube_watch_customer_per_second=0.000300,
    youtube_watch_tasker_per_second=0.000210,
    youtube_watch_taskora_per_second=0.000090,
    youtube_watch_max_seconds=7200,
    updated_at=now(),
    reason='Taskora Watch pricing: $0.000300/sec with 70/30 split'
where id=true;

update public.advertise_service_catalog
set customer_unit_price=0.000300,
    tasker_unit_reward=0.000210,
    taskora_unit_margin=0.000090,
    min_quantity=1,
    max_quantity=7200,
    pricing_model='watch_second',
    task_type='watch',
    service_name='YouTube Watch',
    updated_at=now()
where service_id='yt_watch';

alter table public.connected_accounts
  add column if not exists verification_token text,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists verification_attempts integer not null default 0;

create unique index if not exists connected_accounts_verification_token_uidx
  on public.connected_accounts(verification_token)
  where verification_token is not null;

create unique index if not exists connected_accounts_verified_profile_uidx
  on public.connected_accounts(platform, profile_url)
  where status='verified' and profile_url is not null;

insert into storage.buckets(id,name,public)
values('taskora-videos','taskora-videos',true)
on conflict (id) do update set public=true;

drop policy if exists "taskora videos authenticated upload own folder" on storage.objects;
create policy "taskora videos authenticated upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id='taskora-videos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists "taskora videos public read" on storage.objects;
create policy "taskora videos public read"
on storage.objects for select to public
using (bucket_id='taskora-videos');