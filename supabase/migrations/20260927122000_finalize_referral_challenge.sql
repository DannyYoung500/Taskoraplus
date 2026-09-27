-- Finalize referral challenge requirements, USD rewards, and Telegram notification delivery.
alter table public.referral_challenge_rewards
  add column if not exists notified_at timestamptz;

alter table public.referral_challenge_members
  add column if not exists valid_notified_at timestamptz;

update public.app_settings
set value = jsonb_build_object(
  'enabled', true,
  'task_target', 5,
  'video_target', 20,
  'game_target', 5,
  'ad_target', 20,
  'join_bonus_usd', 0.0012,
  'task_bonus_usd', 0.0040,
  'video_bonus_usd', 0.0060,
  'game_bonus_usd', 0.0050,
  'ad_bonus_usd', 0.0072,
  'withdrawal_commission_percent', 10
)
where key = 'referral_challenge';

update public.referral_challenge_rewards
set notified_at = coalesce(notified_at, now())
where milestone not in ('join','tasks','videos','games','ads');

update public.referral_challenge_members
set valid_notified_at = coalesce(valid_notified_at, now())
where valid_referral = true;

create or replace function public.refresh_referral_challenge(p_referred_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  p profiles%rowtype;
  cfg jsonb;
  inviter uuid;
  joined boolean := false;
  task_count integer := 0;
  video_count integer := 0;
  game_count integer := 0;
  ad_count integer := 0;
  valid_now boolean := false;
  bonus numeric;
  reward_id uuid;
begin
  select * into p from profiles where id = p_referred_user_id;
  if not found or p.referred_by is null then return; end if;
  inviter := p.referred_by;

  select value into cfg from app_settings where key = 'referral_challenge';
  if coalesce((cfg->>'enabled')::boolean, true) = false then return; end if;

  select exists(
    select 1 from telegram_gate_events
    where user_id = p_referred_user_id
      and lower(coalesce(status,'')) in ('verified','success','passed')
      and lower(coalesce(membership_status,'')) in ('member','administrator','creator','owner','joined','success')
      and checked_at >= coalesce(p.created_at, now())
  ) into joined;

  select count(*) into task_count from submissions
    where user_id=p_referred_user_id and status='verified';

  select count(*) into video_count from watch_video_sessions
    where user_id=p_referred_user_id and status='completed';

  select count(*) into game_count from game_rounds
    where user_id=p_referred_user_id and status='completed';

  select count(*) into ad_count from watch_completions
    where user_id=p_referred_user_id;

  valid_now := joined
    and task_count >= coalesce((cfg->>'task_target')::int,5)
    and video_count >= coalesce((cfg->>'video_target')::int,20)
    and game_count >= coalesce((cfg->>'game_target')::int,5)
    and ad_count >= coalesce((cfg->>'ad_target')::int,20);

  insert into referral_challenge_members(
    referred_user_id,inviter_user_id,joined_verified,tasks_completed,videos_watched,games_played,ads_watched,valid_referral,unlocked_at,updated_at
  ) values (
    p_referred_user_id,inviter,joined,task_count,video_count,game_count,ad_count,valid_now,
    case when valid_now then now() else null end,now()
  )
  on conflict(referred_user_id) do update set
    joined_verified=excluded.joined_verified,
    tasks_completed=excluded.tasks_completed,
    videos_watched=excluded.videos_watched,
    games_played=excluded.games_played,
    ads_watched=excluded.ads_watched,
    valid_referral=excluded.valid_referral or referral_challenge_members.valid_referral,
    unlocked_at=case when referral_challenge_members.unlocked_at is not null then referral_challenge_members.unlocked_at when excluded.valid_referral then now() else null end,
    updated_at=now();

  if joined then
    bonus := coalesce((cfg->>'join_bonus_usd')::numeric,0.0012);
    insert into referral_challenge_rewards(referred_user_id,inviter_user_id,milestone,amount_usd)
    values(p_referred_user_id,inviter,'join',bonus) on conflict do nothing;
  end if;

  if task_count >= coalesce((cfg->>'task_target')::int,5) then
    bonus := coalesce((cfg->>'task_bonus_usd')::numeric,0.004);
    insert into referral_challenge_rewards(referred_user_id,inviter_user_id,milestone,amount_usd)
    values(p_referred_user_id,inviter,'tasks',bonus) on conflict do nothing;
  end if;

  if video_count >= coalesce((cfg->>'video_target')::int,20) then
    bonus := coalesce((cfg->>'video_bonus_usd')::numeric,0.006);
    insert into referral_challenge_rewards(referred_user_id,inviter_user_id,milestone,amount_usd)
    values(p_referred_user_id,inviter,'videos',bonus) on conflict do nothing;
  end if;

  if game_count >= coalesce((cfg->>'game_target')::int,5) then
    bonus := coalesce((cfg->>'game_bonus_usd')::numeric,0.005);
    insert into referral_challenge_rewards(referred_user_id,inviter_user_id,milestone,amount_usd)
    values(p_referred_user_id,inviter,'games',bonus) on conflict do nothing;
  end if;

  if ad_count >= coalesce((cfg->>'ad_target')::int,20) then
    bonus := coalesce((cfg->>'ad_bonus_usd')::numeric,0.0072);
    insert into referral_challenge_rewards(referred_user_id,inviter_user_id,milestone,amount_usd)
    values(p_referred_user_id,inviter,'ads',bonus) on conflict do nothing;
  end if;

  for reward_id in
    select r.id from referral_challenge_rewards r
    where r.referred_user_id=p_referred_user_id and r.inviter_user_id=inviter
  loop
    insert into transactions(user_id,label,amount,kind)
    select inviter,
      'Referral Challenge — '||r.milestone||' — '||r.referred_user_id::text,
      r.amount_usd,'referral'
    from referral_challenge_rewards r
    where r.id=reward_id
      and not exists (
        select 1 from transactions t
        where t.user_id=inviter
          and t.label='Referral Challenge — '||r.milestone||' — '||r.referred_user_id::text
          and t.amount=r.amount_usd
          and t.kind='referral'
      );
  end loop;
end;
$function$;

create or replace function public.referral_withdrawal_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  inviter uuid;
  valid_ref boolean;
  pct numeric;
  commission numeric;
begin
  if new.status <> 'paid' or coalesce(old.status,'') = 'paid' then return new; end if;
  select referred_by into inviter from profiles where id=new.user_id;
  if inviter is null then return new; end if;
  select valid_referral into valid_ref from referral_challenge_members where referred_user_id=new.user_id;
  if coalesce(valid_ref,false) = false then return new; end if;
  select coalesce((value->>'withdrawal_commission_percent')::numeric,10) into pct from app_settings where key='referral_challenge';
  commission := round(abs(new.amount) * pct / 100, 8);
  if commission <= 0 then return new; end if;
  if exists (
    select 1 from transactions where user_id=inviter and kind='referral'
      and label='Referral withdrawal commission — '||new.id::text
  ) then return new; end if;
  insert into transactions(user_id,label,amount,kind)
  values(inviter,'Referral withdrawal commission — '||new.id::text,commission,'referral');
  return new;
end;
$function$;

drop trigger if exists referral_withdrawal_commission on public.withdrawals;
create trigger referral_withdrawal_commission
after update of status on public.withdrawals
for each row execute function public.referral_withdrawal_commission();
