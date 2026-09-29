-- TASKORA: posted YouTube watch analytics + self-completion protection
-- Re-runnable production SQL. Run after watch/campaign schema changes.

create schema if not exists private;

alter table public.tasks
  add column if not exists youtube_video_id text,
  add column if not exists youtube_view_count bigint not null default 0,
  add column if not exists youtube_view_count_updated_at timestamptz,
  add column if not exists watch_completion_count integer not null default 0,
  add column if not exists watch_reward_paid numeric(18,8) not null default 0;

create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_campaign_id_idx on public.tasks(campaign_id);
create index if not exists tasks_youtube_video_id_idx on public.tasks(youtube_video_id);
create index if not exists tasks_watch_stats_idx on public.tasks(created_by, task_type, status);

create or replace function private.reject_self_task_submission()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare creator uuid;
begin
  select created_by into creator from public.tasks where id = new.task_id;
  if creator is not null and creator = new.user_id then
    raise exception 'You cannot complete your own posted task.';
  end if;
  return new;
end;
$$;

revoke execute on function private.reject_self_task_submission() from public, anon, authenticated;
drop trigger if exists trg_reject_self_task_submission on public.submissions;
create trigger trg_reject_self_task_submission
before insert or update of user_id, task_id on public.submissions
for each row execute function private.reject_self_task_submission();

create or replace function private.reject_self_watch_session()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare creator uuid;
begin
  select created_by into creator from public.watch_videos where id = new.video_id;
  if creator is not null and creator = new.user_id then
    raise exception 'You cannot watch your own posted video for a reward.';
  end if;
  return new;
end;
$$;

revoke execute on function private.reject_self_watch_session() from public, anon, authenticated;
drop trigger if exists trg_reject_self_watch_session on public.watch_video_sessions;
create trigger trg_reject_self_watch_session
before insert or update of user_id, video_id on public.watch_video_sessions
for each row execute function private.reject_self_watch_session();

create or replace function private.sync_posted_watch_task_stats()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op = 'INSERT' then
    if (select task_type from public.tasks where id = new.task_id) = 'video_watch'
       and new.status = 'verified' then
      update public.tasks
      set watch_completion_count = watch_completion_count + 1,
          watch_reward_paid = watch_reward_paid + coalesce(reward,0),
          updated_at = now()
      where id = new.task_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if (select task_type from public.tasks where id = new.task_id) = 'video_watch'
       and old.status is distinct from 'verified'
       and new.status = 'verified' then
      update public.tasks
      set watch_completion_count = watch_completion_count + 1,
          watch_reward_paid = watch_reward_paid + coalesce(reward,0),
          updated_at = now()
      where id = new.task_id;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_posted_watch_task_stats() from public, anon, authenticated;
drop trigger if exists trg_sync_posted_watch_task_stats on public.submissions;
create trigger trg_sync_posted_watch_task_stats
after insert or update of status on public.submissions
for each row execute function private.sync_posted_watch_task_stats();

alter table public.tasks drop constraint if exists tasks_watch_reward_positive_ck;
alter table public.tasks add constraint tasks_watch_reward_positive_ck
check (task_type <> 'video_watch' or reward >= 0);

alter table public.tasks drop constraint if exists tasks_watch_seconds_ck;
alter table public.tasks add constraint tasks_watch_seconds_ck
check (task_type <> 'video_watch' or (seconds is not null and seconds >= 1 and seconds <= 10800));

update public.tasks t
set watch_completion_count = coalesce(s.verified_count,0),
    watch_reward_paid = coalesce(s.verified_reward,0)
from (
  select task_id,
         count(*) filter (where status='verified')::integer as verified_count,
         coalesce(sum(case when status='verified'
           then coalesce((select reward from public.tasks tt where tt.id=s2.task_id),0)
           else 0 end),0) as verified_reward
  from public.submissions s2
  group by task_id
) s
where t.id=s.task_id
  and t.task_type='video_watch';

update public.advertise_economy_settings
set default_tasker_share_percent=70,
    default_taskora_margin_percent=30,
    youtube_watch_customer_per_second=0.00030000,
    youtube_watch_tasker_per_second=0.00021000,
    youtube_watch_taskora_per_second=0.00009000,
    youtube_watch_min_seconds=1,
    youtube_watch_max_seconds=10800,
    updated_at=now()
where id=true;

select
  count(*) filter (where task_type='video_watch') as posted_watch_tasks,
  coalesce(sum(watch_completion_count) filter (where task_type='video_watch'),0) as verified_watch_completions,
  coalesce(sum(watch_reward_paid) filter (where task_type='video_watch'),0) as watch_rewards_paid,
  (select youtube_watch_customer_per_second from public.advertise_economy_settings where id=true) as customer_per_second,
  (select youtube_watch_tasker_per_second from public.advertise_economy_settings where id=true) as tasker_per_second,
  (select youtube_watch_taskora_per_second from public.advertise_economy_settings where id=true) as taskora_per_second
from public.tasks;
