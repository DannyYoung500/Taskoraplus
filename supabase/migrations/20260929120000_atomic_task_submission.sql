-- Production task submission integrity: prevent duplicate claims and make slot consumption atomic.
do $$
begin
  if exists (
    select 1 from public.submissions
    where user_id is not null and task_id is not null
    group by user_id, task_id
    having count(*) > 1
  ) then
    delete from public.submissions s
    using public.submissions older
    where s.user_id = older.user_id
      and s.task_id = older.task_id
      and s.created_at > older.created_at;
  end if;
end $$;

create unique index if not exists submissions_user_task_unique
  on public.submissions(user_id, task_id);

create or replace function public.claim_task_submission(
  p_user_id uuid,
  p_task_id uuid,
  p_proof_text text default null,
  p_proof_url text default null,
  p_proof_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_slots integer;
begin
  select slots_left into v_slots
  from public.tasks
  where id = p_task_id and is_active = true
  for update;

  if not found then raise exception 'This task is no longer available.'; end if;
  if coalesce(v_slots, 0) <= 0 then raise exception 'All slots for this task are taken.'; end if;

  if exists (select 1 from public.submissions where user_id = p_user_id and task_id = p_task_id) then
    raise exception 'You already submitted this task.';
  end if;

  insert into public.submissions(user_id, task_id, status, proof_text, proof_url, proof_hash)
  values (p_user_id, p_task_id, 'pending',
          nullif(trim(p_proof_text), ''),
          nullif(trim(p_proof_url), ''),
          nullif(trim(p_proof_hash), ''))
  returning id into v_submission_id;

  update public.tasks
  set slots_left = greatest(0, slots_left - 1), updated_at = now()
  where id = p_task_id;

  return v_submission_id;
exception
  when unique_violation then raise exception 'You already submitted this task.';
end;
$$;

revoke all on function public.claim_task_submission(uuid, uuid, text, text, text) from public, anon, authenticated;
