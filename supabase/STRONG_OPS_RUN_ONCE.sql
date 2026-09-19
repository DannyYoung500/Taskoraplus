-- TASKORA strong ops — run once in Supabase SQL editor
-- Safe / idempotent

CREATE INDEX IF NOT EXISTS idx_fraud_flags_status_created
  ON public.fraud_flags (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user
  ON public.fraud_flags (user_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_address_lower
  ON public.withdrawals ((lower(trim(address))));
CREATE INDEX IF NOT EXISTS idx_submissions_user_status
  ON public.submissions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_created
  ON public.submissions (created_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_checkin date;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0;

COMMENT ON TABLE public.fraud_flags IS 'TASKORA owner fraud flags — shared wallet, high rejects, velocity';
COMMENT ON TABLE public.audit_logs IS 'Owner/admin action audit trail';
