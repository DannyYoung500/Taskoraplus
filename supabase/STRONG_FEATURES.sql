-- ============================================================
-- TASKORA strong features — dual approval, first withdrawal, gate whitelist
-- Safe to re-run in Supabase SQL Editor
-- ============================================================

-- Platform economy / withdrawal rules
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  dual_approval_enabled boolean NOT NULL DEFAULT true,
  dual_approval_threshold_usd numeric NOT NULL DEFAULT 20,
  first_withdrawal_max_usd numeric NOT NULL DEFAULT 5,
  first_withdrawal_extra_review boolean NOT NULL DEFAULT true,
  min_withdrawal_usd numeric NOT NULL DEFAULT 1,
  max_withdrawal_usd numeric NOT NULL DEFAULT 500,
  payouts_paused boolean NOT NULL DEFAULT false,
  reward_multiplier numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Gate whitelist (testers / partners skip channel gate)
CREATE TABLE IF NOT EXISTS public.gate_whitelist (
  telegram_id bigint PRIMARY KEY,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dual approval columns on withdrawals
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS approval_stage text NOT NULL DEFAULT 'pending';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS first_approved_by uuid;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS first_approved_at timestamptz;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS second_approved_by uuid;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS second_approved_at timestamptz;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS is_first_withdrawal boolean NOT NULL DEFAULT false;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS requires_dual boolean NOT NULL DEFAULT false;

-- Payment webhook events (idempotent)
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_provider ON public.payment_webhook_events (provider, created_at DESC);

-- RLS: owner-only for whitelist / settings (service role used in server fns)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
