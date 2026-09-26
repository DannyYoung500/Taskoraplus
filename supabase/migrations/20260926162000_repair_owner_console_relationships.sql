-- Repair the owner console relational schema.
-- All user-owned owner pages depend on these relationships for Supabase nested selects.
begin;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='submissions_user_id_profiles_fkey') then
    alter table public.submissions add constraint submissions_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='withdrawals_user_id_profiles_fkey') then
    alter table public.withdrawals add constraint withdrawals_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='deposits_user_id_profiles_fkey') then
    alter table public.deposits add constraint deposits_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='transactions_user_id_profiles_fkey') then
    alter table public.transactions add constraint transactions_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='user_roles_user_id_profiles_fkey') then
    alter table public.user_roles add constraint user_roles_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='connected_accounts_user_id_profiles_fkey') then
    alter table public.connected_accounts add constraint connected_accounts_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='fraud_flags_user_id_profiles_fkey') then
    alter table public.fraud_flags add constraint fraud_flags_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='support_tickets_user_id_profiles_fkey') then
    alter table public.support_tickets add constraint support_tickets_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='notifications_user_id_profiles_fkey') then
    alter table public.notifications add constraint notifications_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists submissions_user_id_created_at_idx on public.submissions(user_id, created_at desc);
create index if not exists withdrawals_user_id_created_at_idx on public.withdrawals(user_id, created_at desc);
create index if not exists deposits_user_id_created_at_idx on public.deposits(user_id, created_at desc);
create index if not exists transactions_user_id_created_at_idx on public.transactions(user_id, created_at desc);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists connected_accounts_user_id_idx on public.connected_accounts(user_id);
create index if not exists fraud_flags_user_id_created_at_idx on public.fraud_flags(user_id, created_at desc);
create index if not exists support_tickets_user_id_created_at_idx on public.support_tickets(user_id, created_at desc);
create index if not exists notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);

commit;