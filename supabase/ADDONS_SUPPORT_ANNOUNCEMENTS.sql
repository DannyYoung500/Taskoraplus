-- Additive only. Safe to re-run.
-- Support tickets + announcements for TASKORA owner ops.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;
alter table public.announcements enable row level security;

-- Service role / server functions handle access; optional read policies:
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'announcements' and policyname = 'announcements_read_active'
  ) then
    create policy announcements_read_active on public.announcements
      for select using (is_active = true);
  end if;
end $$;
