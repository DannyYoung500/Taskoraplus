-- Additional page-query indexes for worker submission history and owner payout queues.
-- Additive only: no data or access-policy changes.
CREATE INDEX IF NOT EXISTS submissions_user_created_idx
  ON public.submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS withdrawals_status_created_idx
  ON public.withdrawals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS verification_cases_status_updated_idx
  ON public.verification_cases (status, updated_at DESC);
