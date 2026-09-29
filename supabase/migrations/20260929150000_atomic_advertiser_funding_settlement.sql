-- Atomic advertiser funding settlement for deposits and task completions.
create or replace function public.complete_advertiser_deposit(p_deposit_id uuid,p_admin_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.deposits%rowtype; v numeric;
begin
 select * into d from public.deposits where id=p_deposit_id for update;
 if not found then raise exception 'Deposit not found.'; end if;
 if d.status='completed' then
   select coalesce(available_balance,0) into v from public.advertiser_funding_accounts where advertiser_id=d.user_id;
   return jsonb_build_object('status','completed','balance',coalesce(v,0),'already_completed',true);
 end if;
 update public.deposits set status='completed',verified_at=now(),verified_by=p_admin_id,updated_at=now() where id=d.id;
 insert into public.transactions(user_id,label,amount,kind) values(d.user_id,'Deposit verified — '||d.method,abs(d.amount),'bonus');
 perform public.credit_advertiser_deposit(d.id,d.user_id,abs(d.amount));
 select available_balance into v from public.advertiser_funding_accounts where advertiser_id=d.user_id;
 return jsonb_build_object('status','completed','balance',coalesce(v,0),'already_completed',false);
end $$;

create or replace function public.review_task_submission(p_submission_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_sub public.submissions%rowtype; v_task public.tasks%rowtype; v_campaign public.campaigns%rowtype;
 v_referrer uuid; v_reward numeric; v_customer_cost numeric; v_referral numeric;
begin
 if p_decision not in ('verified','rejected') then raise exception 'Invalid submission decision.'; end if;
 select * into v_sub from public.submissions where id=p_submission_id for update;
 if not found then raise exception 'Submission not found.'; end if;
 if v_sub.status <> 'pending' then raise exception 'Submission already %.',v_sub.status; end if;
 select * into v_task from public.tasks where id=v_sub.task_id for update;
 if not found then raise exception 'Task not found.'; end if;
 if v_task.campaign_id is not null then
   select * into v_campaign from public.campaigns where id=v_task.campaign_id for update;
   if not found then raise exception 'Campaign not found.'; end if;
 end if;
 v_customer_cost:=greatest(0,coalesce((v_task.task_metadata->'pricing_snapshot'->>'customer_per_completion')::numeric,coalesce(v_task.reward,0)));

 if p_decision='rejected' then
   update public.submissions set status='rejected' where id=p_submission_id and status='pending';
   update public.tasks set slots_left=least(coalesce(slots_total,slots_left+1),coalesce(slots_left,0)+1),updated_at=now() where id=v_task.id;
   if v_task.campaign_id is not null and v_customer_cost>0 then
     perform 1 from public.advertiser_funding_accounts where advertiser_id=v_campaign.advertiser_user_id for update;
     update public.advertiser_funding_accounts set reserved_balance=greatest(0,reserved_balance-v_customer_cost),available_balance=available_balance+v_customer_cost,updated_at=now() where advertiser_id=v_campaign.advertiser_user_id;
     insert into public.advertiser_funding_ledger(advertiser_id,campaign_id,entry_type,amount,reference,meta) values(v_campaign.advertiser_user_id,v_campaign.id,'campaign_release',v_customer_cost,'submission-release:'||p_submission_id::text,jsonb_build_object('submission_id',p_submission_id,'reason',coalesce(p_reason,'')));
   end if;
   return jsonb_build_object('status','rejected','reward',0,'customer_cost_released',v_customer_cost);
 end if;

 if v_task.campaign_id is not null and v_customer_cost>0 then
   perform 1 from public.advertiser_funding_accounts where advertiser_id=v_campaign.advertiser_user_id for update;
   if (select reserved_balance from public.advertiser_funding_accounts where advertiser_id=v_campaign.advertiser_user_id) < v_customer_cost then raise exception 'Campaign has insufficient reserved budget for this completion.'; end if;
   update public.advertiser_funding_accounts set reserved_balance=greatest(0,reserved_balance-v_customer_cost),spent_balance=spent_balance+v_customer_cost,updated_at=now() where advertiser_id=v_campaign.advertiser_user_id;
   insert into public.advertiser_funding_ledger(advertiser_id,campaign_id,entry_type,amount,reference,meta) values(v_campaign.advertiser_user_id,v_campaign.id,'campaign_spend',v_customer_cost,'submission:'||p_submission_id::text,jsonb_build_object('submission_id',p_submission_id,'task_id',v_task.id));
   update public.campaigns set funding_spent=funding_spent+v_customer_cost,amount_spent=coalesce(amount_spent,0)+v_customer_cost,funding_status=case when funding_spent+v_customer_cost >= funding_reserved then 'depleted' else 'funded' end,updated_at=now() where id=v_campaign.id;
 end if;

 update public.submissions set status='verified' where id=p_submission_id and status='pending';
 v_reward:=greatest(0,coalesce(v_task.reward,0));
 if v_reward>0 then
   insert into public.transactions(user_id,label,amount,kind) values(v_sub.user_id,'Verified — '||coalesce(v_task.advertiser,'task'),v_reward,'reward');
   select referred_by into v_referrer from public.profiles where id=v_sub.user_id;
   if v_referrer is not null then
     v_referral:=round(v_reward*0.10,2);
     if v_referral>0 then insert into public.transactions(user_id,label,amount,kind) values(v_referrer,'Referral share',v_referral,'referral'); end if;
   end if;
 end if;
 return jsonb_build_object('status','verified','reward',v_reward,'customer_cost',v_customer_cost);
end $$;

revoke execute on function public.complete_advertiser_deposit(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.review_task_submission(uuid,text,text) from public,anon,authenticated;