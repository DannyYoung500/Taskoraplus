-- ============================================================
-- TASKORA Strong Elite — trust score, quality, perceptual proof
-- Safe to re-run in Supabase SQL Editor
-- ============================================================

-- Trust / quality columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 70;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejected_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quality_score integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_fp text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip_hint text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id bigint;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_device_fp_idx ON public.profiles (device_fp) WHERE device_fp IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_trust_score_idx ON public.profiles (trust_score);
CREATE INDEX IF NOT EXISTS profiles_telegram_id_idx ON public.profiles (telegram_id) WHERE telegram_id IS NOT NULL;

-- Proof hash + perceptual key on submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS proof_hash text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS proof_perceptual_key text;
CREATE INDEX IF NOT EXISTS submissions_proof_hash_idx ON public.submissions (proof_hash) WHERE proof_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS submissions_perceptual_idx ON public.submissions (proof_perceptual_key) WHERE proof_perceptual_key IS NOT NULL;

-- Bonus ad one-time session tokens (optional dedicated table; also soft-fails if missing)
CREATE TABLE IF NOT EXISTS public.bonus_ad_sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS bonus_ad_sessions_user_idx ON public.bonus_ad_sessions (user_id, created_at DESC);

-- Fraud flags table (if not present)
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE INDEX IF NOT EXISTS fraud_flags_status_idx ON public.fraud_flags (status, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_flags_user_idx ON public.fraud_flags (user_id);

-- Soft clamp trust scores already outside range
UPDATE public.profiles SET trust_score = 70 WHERE trust_score IS NULL;
UPDATE public.profiles SET trust_score = GREATEST(0, LEAST(100, trust_score));
