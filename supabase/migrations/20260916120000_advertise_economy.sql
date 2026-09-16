create table if not exists public.advertise_service_catalog (
  service_id text primary key,
  platform text not null,
  service_name text not null,
  task_type text not null,
  min_quantity integer not null check (min_quantity > 0),
  max_quantity integer not null check (max_quantity >= min_quantity),
  customer_unit_price numeric(20,8) not null check (customer_unit_price >= 0),
  tasker_unit_reward numeric(20,8) not null check (tasker_unit_reward >= 0),
  taskora_unit_margin numeric(20,8) not null check (taskora_unit_margin >= 0),
  pricing_model text not null default 'unit' check (pricing_model in ('unit','watch_second')),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.advertise_economy_settings (
  id boolean primary key default true check (id = true),
  default_tasker_share_percent numeric(6,3) not null default 70,
  default_taskora_margin_percent numeric(6,3) not null default 30,
  youtube_watch_customer_per_second numeric(20,8) not null default 0.00010,
  youtube_watch_tasker_per_second numeric(20,8) not null default 0.00007,
  youtube_watch_taskora_per_second numeric(20,8) not null default 0.00003,
  youtube_watch_min_seconds integer not null default 1,
  youtube_watch_max_seconds integer not null default 3600,
  global_min_campaign_value_usd numeric(20,8) not null default 0,
  global_max_campaign_value_usd numeric(20,8) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  reason text
);

insert into public.advertise_economy_settings (id) values (true)
on conflict (id) do nothing;

insert into public.advertise_service_catalog
(service_id,platform,service_name,task_type,min_quantity,max_quantity,customer_unit_price,tasker_unit_reward,taskora_unit_margin,pricing_model,active)
values
('instagram','ig_followers','Instagram Followers','follow',100,10000,0.02,0.014,0.006,'unit',true),
('instagram','ig_likes','Instagram Likes','like',100,50000,0.012,0.0084,0.0036,'unit',true),
('instagram','ig_comments','Instagram Comments','comment',20,5000,0.025,0.0175,0.0075,'unit',true),
('instagram','ig_views','Instagram Video Views','view',500,100000,0.0025,0.00175,0.00075,'unit',true),
('youtube','yt_subs','YouTube Subscribers','subscribe',100,10000,0.03,0.021,0.009,'unit',true),
('youtube','yt_views','YouTube Views','view',500,100000,0.003,0.0021,0.0009,'unit',true),
('youtube','yt_likes','YouTube Likes','like',100,50000,0.015,0.0105,0.0045,'unit',true),
('youtube','yt_comments','YouTube Comments','comment',20,5000,0.03,0.021,0.009,'unit',true),
('tiktok','tt_followers','TikTok Followers','follow',100,10000,0.018,0.0126,0.0054,'unit',true),
('tiktok','tt_likes','TikTok Likes','like',100,50000,0.01,0.007,0.003,'unit',true),
('tiktok','tt_views','TikTok Views','view',500,100000,0.002,0.0014,0.0006,'unit',true),
('tiktok','tt_comments','TikTok Comments','comment',20,5000,0.025,0.0175,0.0075,'unit',true),
('x','x_followers','X Followers','follow',100,10000,0.02,0.014,0.006,'unit',true),
('x','x_likes','X Likes','like',100,50000,0.012,0.0084,0.0036,'unit',true),
('x','x_reposts','X Reposts','repost',100,50000,0.015,0.0105,0.0045,'unit',true),
('x','x_comments','X Comments','comment',20,5000,0.025,0.0175,0.0075,'unit',true),
('facebook','fb_page','Facebook Page Likes','like',100,10000,0.015,0.0105,0.0045,'unit',true),
('facebook','fb_post','Facebook Post Likes','like',100,50000,0.012,0.0084,0.0036,'unit',true),
('facebook','fb_followers','Facebook Followers','follow',100,10000,0.02,0.014,0.006,'unit',true),
('facebook','fb_comments','Facebook Comments','comment',20,5000,0.025,0.0175,0.0075,'unit',true),
('linkedin','li_followers','LinkedIn Followers','follow',100,10000,0.03,0.021,0.009,'unit',true),
('linkedin','li_likes','LinkedIn Post Likes','like',100,10000,0.018,0.0126,0.0054,'unit',true),
('linkedin','li_comments','LinkedIn Comments','comment',20,2000,0.03,0.021,0.009,'unit',true),
('threads','th_followers','Threads Followers','follow',100,10000,0.02,0.014,0.006,'unit',true),
('threads','th_likes','Threads Likes','like',100,50000,0.012,0.0084,0.0036,'unit',true),
('threads','th_reposts','Threads Reposts','repost',100,20000,0.015,0.0105,0.0045,'unit',true),
('telegram','tg_members','Telegram Channel Members','join',100,10000,0.025,0.0175,0.0075,'unit',true),
('telegram','tg_group','Telegram Group Members','join',100,10000,0.025,0.0175,0.0075,'unit',true),
('whatsapp','wa_channel','WhatsApp Channel Growth','join',100,5000,0.03,0.021,0.009,'unit',true),
('whatsapp','wa_group','WhatsApp Group Growth','join',100,5000,0.03,0.021,0.009,'unit',true),
('discord','dc_members','Discord Members','join',100,10000,0.025,0.0175,0.0075,'unit',true),
('discord','dc_boost','Discord Engagement','engage',20,5000,0.025,0.0175,0.0075,'unit',true),
('spotify','sp_plays','Spotify Plays','view',500,100000,0.002,0.0014,0.0006,'unit',true),
('spotify','sp_followers','Spotify Followers','follow',100,10000,0.03,0.021,0.009,'unit',true),
('spotify','sp_playlist','Spotify Playlist Promotion','playlist',1,50,1.0,0.7,0.3,'unit',true),
('spotify','sp_saves','Spotify Saves','save',100,20000,0.02,0.014,0.006,'unit',true),
('soundcloud','sc_plays','SoundCloud Plays','view',500,100000,0.002,0.0014,0.0006,'unit',true),
('soundcloud','sc_followers','SoundCloud Followers','follow',100,10000,0.025,0.0175,0.0075,'unit',true),
('soundcloud','sc_likes','SoundCloud Likes','like',100,50000,0.012,0.0084,0.0036,'unit',true),
('audiomack','am_plays','Audiomack Plays','view',500,100000,0.0015,0.00105,0.00045,'unit',true),
('audiomack','am_followers','Audiomack Followers','follow',100,10000,0.02,0.014,0.006,'unit',true),
('audiomack','am_likes','Audiomack Likes','like',100,50000,0.012,0.0084,0.0036,'unit',true),
('app_review','ar_ios','iOS App Reviews','review',10,500,1.5,1.05,0.45,'unit',true),
('app_review','ar_android','Android App Reviews','review',10,500,1.5,1.05,0.45,'unit',true),
('app_review','ar_ratings','App Ratings','rating',20,1000,0.5,0.35,0.15,'unit',true),
('google','gb_reviews','Google Business Reviews','review',10,200,0.25,0.175,0.075,'unit',true),
('google','gb_seo','Local SEO','seo',1,100,1.5,1.05,0.45,'unit',true),
('website','web_traffic','Website Traffic','view',500,100000,0.003,0.0021,0.0009,'unit',true),
('website','web_signups','Website Sign-ups','signup',20,5000,0.04,0.028,0.012,'unit',true),
('website','web_clicks','Website Link Clicks','click',100,50000,0.008,0.0056,0.0024,'unit',true),
('survey','sv_responses','Survey Responses','response',20,5000,1.0,0.7,0.3,'unit',true),
('survey','sv_votes','Poll Votes','vote',20,50000,0.5,0.35,0.15,'unit',true),
('pinterest','pin_followers','Pinterest Followers','follow',100,10000,0.02,0.014,0.006,'unit',true),
('pinterest','pin_saves','Pinterest Saves','save',100,50000,0.015,0.0105,0.0045,'unit',true),
('reddit','rd_upvotes','Reddit Upvotes','upvote',100,10000,0.3,0.21,0.09,'unit',true),
('reddit','rd_comments','Reddit Comments','comment',20,2000,0.5,0.35,0.15,'unit',true),
('twitch','tw_followers','Twitch Followers','follow',100,10000,0.025,0.0175,0.0075,'unit',true),
('twitch','tw_views','Twitch Views','view',500,50000,0.003,0.0021,0.0009,'unit',true),
('twitch','tw_chat','Twitch Chat Engagement','engage',20,5000,0.025,0.0175,0.0075,'unit',true),
('youtube','yt_watch','YouTube Watch (per second)','watch_second',1,3600,0.0001,0.00007,0.00003,'watch_second',true)
on conflict (service_id) do update set
 platform=excluded.platform,
 service_name=excluded.service_name,
 task_type=excluded.task_type,
 min_quantity=excluded.min_quantity,
 max_quantity=excluded.max_quantity,
 customer_unit_price=excluded.customer_unit_price,
 tasker_unit_reward=excluded.tasker_unit_reward,
 taskora_unit_margin=excluded.taskora_unit_margin,
 pricing_model=excluded.pricing_model,
 active=excluded.active,
 updated_at=now();

alter table public.advertise_service_catalog enable row level security;
alter table public.advertise_economy_settings enable row level security;

drop policy if exists "public can read active advertise catalogue" on public.advertise_service_catalog;
create policy "public can read active advertise catalogue" on public.advertise_service_catalog for select using (active = true or public.has_role(auth.uid(),'admin'));
drop policy if exists "admins manage advertise catalogue" on public.advertise_service_catalog;
create policy "admins manage advertise catalogue" on public.advertise_service_catalog for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
drop policy if exists "admins read advertise economy" on public.advertise_economy_settings;
create policy "admins read advertise economy" on public.advertise_economy_settings for select using (public.has_role(auth.uid(),'admin'));
drop policy if exists "admins manage advertise economy" on public.advertise_economy_settings;
create policy "admins manage advertise economy" on public.advertise_economy_settings for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create index if not exists advertise_service_catalog_platform_idx on public.advertise_service_catalog(platform, active);
