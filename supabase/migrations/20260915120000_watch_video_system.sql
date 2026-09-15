create extension if not exists pgcrypto;

create table if not exists public.watch_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  video_url text,
  source_type text not null default 'owner_uploaded' check (source_type in ('owner_uploaded','external_provider')),
  provider_name text,
  provider_video_id text,
  reward_usdt numeric(20,8) not null default 0 check (reward_usdt >= 0),
  reward_points integer not null default 0 check (reward_points >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  daily_limit integer,
  max_views integer,
  views_count integer not null default 0,
  provider_revenue_usd numeric(20,8) not null default 0,
  user_paid_usd numeric(20,8) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watch_videos_active_idx on public.watch_videos(status, starts_at, ends_at);
create index if not exists watch_videos_source_idx on public.watch_videos(source_type, provider_name);

create table if not exists public.watch_video_sessions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.watch_videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'started' check (status in ('started','completed','rejected')),
  reward_usdt numeric(20,8) not null default 0,
  reward_points integer not null default 0,
  provider_transaction_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists watch_video_provider_tx_unique on public.watch_video_sessions(provider_transaction_id) where provider_transaction_id is not null;
create index if not exists watch_video_sessions_user_idx on public.watch_video_sessions(user_id, created_at desc);

alter table public.watch_videos enable row level security;
alter table public.watch_video_sessions enable row level security;

drop policy if exists "watch videos public active read" on public.watch_videos;
create policy "watch videos public active read" on public.watch_videos for select to authenticated
using (status = 'active' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()) and (max_views is null or views_count < max_views));

drop policy if exists "admins manage watch videos" on public.watch_videos;
create policy "admins manage watch videos" on public.watch_videos for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "users read own watch sessions" on public.watch_video_sessions;
create policy "users read own watch sessions" on public.watch_video_sessions for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

drop policy if exists "admins manage watch sessions" on public.watch_video_sessions;
create policy "admins manage watch sessions" on public.watch_video_sessions for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('taskora-videos', 'taskora-videos', true, 524288000, array['video/mp4','video/webm','video/quicktime']::text[])
on conflict (id) do update set public = true, file_size_limit = 524288000, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "taskora video public read" on storage.objects;
create policy "taskora video public read" on storage.objects for select to public using (bucket_id = 'taskora-videos');

drop policy if exists "taskora video admin upload" on storage.objects;
create policy "taskora video admin upload" on storage.objects for insert to authenticated with check (bucket_id = 'taskora-videos' and public.has_role(auth.uid(),'admin'));

drop policy if exists "taskora video admin update" on storage.objects;
create policy "taskora video admin update" on storage.objects for update to authenticated using (bucket_id = 'taskora-videos' and public.has_role(auth.uid(),'admin')) with check (bucket_id = 'taskora-videos' and public.has_role(auth.uid(),'admin'));

drop policy if exists "taskora video admin delete" on storage.objects;
create policy "taskora video admin delete" on storage.objects for delete to authenticated using (bucket_id = 'taskora-videos' and public.has_role(auth.uid(),'admin'));
