alter table public.profiles add column if not exists timezone text;
create index if not exists profiles_timezone_idx on public.profiles(timezone);

create table if not exists public.checkin_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_date date not null,
  slot text not null check (slot in ('morning','night')),
  sent_at timestamptz not null default now(),
  unique (user_id, reminder_date, slot)
);
create index if not exists checkin_reminder_deliveries_date_idx
  on public.checkin_reminder_deliveries(reminder_date, slot);
