-- TASKORA: quest claim idempotency + withdrawal tx hash
-- Safe / idempotent

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS tx_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawals_tx_hash
  ON public.withdrawals (tx_hash)
  WHERE tx_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.task_point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  kind TEXT,
  label TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_point_ledger_reference
  ON public.task_point_ledger (reference)
  WHERE reference IS NOT NULL;

COMMENT ON COLUMN public.withdrawals.tx_hash IS 'On-chain transaction hash when marked paid';
