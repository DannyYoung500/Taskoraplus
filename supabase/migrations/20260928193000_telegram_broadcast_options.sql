alter table public.telegram_broadcasts
  add column if not exists disable_notification boolean not null default false,
  add column if not exists protect_content boolean not null default false;

create index if not exists telegram_broadcasts_created_by_idx
  on public.telegram_broadcasts(created_by, created_at desc);
