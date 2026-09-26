-- TASKORA: wallet freeze columns for owner risk controls
-- Safe / idempotent — run once in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_frozen boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_frozen_reason text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_frozen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_wallet_frozen
  ON public.profiles (wallet_frozen)
  WHERE wallet_frozen = true;

COMMENT ON COLUMN public.profiles.wallet_frozen IS 'When true, user cannot request withdrawals';
COMMENT ON COLUMN public.profiles.wallet_frozen_reason IS 'Owner-visible reason shown to user on withdraw attempt';
COMMENT ON COLUMN public.profiles.wallet_frozen_at IS 'When freeze was applied';
