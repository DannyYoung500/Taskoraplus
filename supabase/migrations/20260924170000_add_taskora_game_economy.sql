-- TASKORA game economy

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score integer not null default 0 check (score >= 0),
  awarded_points integer not null default 0 check (awarded_points >= 0),
  status text not null default 'started' check (status in ('started','completed','expired')),
  created_at timestamptz not null default now()
);

create index if not exists game_rounds_user_created_idx
  on public.game_rounds(user_id, created_at desc);

create unique index if not exists game_rounds_one_started_per_user_idx
  on public.game_rounds(user_id)
  where status = 'started';

alter table public.game_rounds enable row level security;
revoke all on table public.game_rounds from anon, authenticated;
grant all on table public.game_rounds to service_role;

create or replace function public.complete_taskora_game_round(
  _round_id uuid,
  _user_id uuid,
  _score integer
)
returns table (awarded_points integer, total_points integer, daily_points integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.game_rounds%rowtype;
  elapsed_seconds integer;
  max_score integer;
  used_today integer;
  reward integer;
  new_total integer;
begin
  if _user_id is null or _round_id is null then raise exception 'Invalid game session.'; end if;
  if _score < 0 then raise exception 'Invalid score.'; end if;

  select * into r
  from public.game_rounds
  where id = _round_id and user_id = _user_id
  for update;

  if not found then raise exception 'Game session not found.'; end if;

  if r.status = 'completed' then
    select coalesce(p.task_points, 0), coalesce(sum(g.awarded_points) filter (
      where g.status = 'completed' and g.created_at >= date_trunc('day', now())
    ), 0)::integer
    into new_total, daily_points
    from public.profiles p
    left join public.game_rounds g on g.user_id = p.id and g.game_key = r.game_key
    where p.id = _user_id
    group by p.task_points;
    return query select r.awarded_points, new_total, daily_points;
    return;
  end if;

  if r.status <> 'started' then raise exception 'Game session is no longer active.'; end if;

  elapsed_seconds := greatest(0, floor(extract(epoch from (now() - r.started_at)))::integer);
  if elapsed_seconds < 25 then raise exception 'Finish the 30-second round before claiming points.'; end if;

  if elapsed_seconds > 180 then
    update public.game_rounds
    set status = 'expired', completed_at = now(), score = least(_score, 9999)
    where id = r.id;
    raise exception 'Game session expired. Start a new round.';
  end if;

  max_score := elapsed_seconds * 5;
  if _score > max_score then raise exception 'Score exceeds the verified play window.'; end if;

  select coalesce(sum(g.awarded_points), 0)::integer into used_today
  from public.game_rounds g
  where g.user_id = _user_id
    and g.game_key = r.game_key
    and g.status = 'completed'
    and g.created_at >= date_trunc('day', now());

  reward := least(20, 5 + floor(_score / 10));
  reward := greatest(0, least(reward, 100 - used_today));

  update public.game_rounds
  set status = 'completed', completed_at = now(), score = _score, awarded_points = reward
  where id = r.id and status = 'started';

  if not found then raise exception 'Game session was already completed.'; end if;

  if reward > 0 then
    new_total := public.award_task_points(
      _user_id, reward, 'game', 'Taskora Tap Rush', 'game:' || r.id::text
    );
  else
    select coalesce(p.task_points, 0) into new_total
    from public.profiles p where p.id = _user_id;
  end if;

  daily_points := used_today + reward;
  return query select reward, coalesce(new_total, 0), daily_points;
end;
$$;

revoke execute on function public.complete_taskora_game_round(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.complete_taskora_game_round(uuid, uuid, integer) to service_role;
