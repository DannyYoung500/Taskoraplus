create table if not exists public.telegram_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  media_url text,
  button_text text,
  button_url text,
  audience text not null default 'all_active',
  status text not null default 'queued' check (status in ('queued','sending','completed','paused','failed')),
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  blocked_count integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create table if not exists public.telegram_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.telegram_broadcasts(id) on delete cascade,
  telegram_id bigint not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','blocked')),
  attempts integer not null default 0,
  error_message text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broadcast_id, telegram_id)
);
create index if not exists telegram_broadcast_recipients_pending_idx on public.telegram_broadcast_recipients(broadcast_id, status, next_attempt_at, id);
create index if not exists telegram_broadcasts_status_idx on public.telegram_broadcasts(status, created_at desc);
alter table public.telegram_broadcasts enable row level security;
alter table public.telegram_broadcast_recipients enable row level security;
