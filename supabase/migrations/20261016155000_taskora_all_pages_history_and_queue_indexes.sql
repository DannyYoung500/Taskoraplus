-- TaskoraPlus: additional page-history and admin-queue indexes.
-- All indexes are additive; no rows, balances, RLS policies, or page layouts are changed.

CREATE INDEX IF NOT EXISTS watch_completions_user_created_idx
  ON public.watch_completions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS connected_accounts_user_created_idx
  ON public.connected_accounts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS telegram_notification_log_user_created_idx
  ON public.telegram_notification_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deposits_status_created_idx
  ON public.deposits (status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON public.support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS campaigns_advertiser_created_idx
  ON public.campaigns (advertiser_id, created_at DESC);
