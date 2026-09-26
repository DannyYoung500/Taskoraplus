-- TASKORA Owner Dashboard (Master Spec) — additive, safe to re-run

CREATE TABLE IF NOT EXISTS public.economy_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  min_withdrawal numeric NOT NULL DEFAULT 10,
  min_advertiser_deposit numeric NOT NULL DEFAULT 5,
  referral_commission_pct numeric NOT NULL DEFAULT 5,
  daily_checkin_xp int NOT NULL DEFAULT 10,
  daily_checkin_cash numeric NOT NULL DEFAULT 0,
  withdrawal_fee_pct numeric NOT NULL DEFAULT 0,
  version int NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

INSERT INTO public.economy_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.task_price_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  action text NOT NULL,
  user_reward numeric NOT NULL,
  advertiser_price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, action)
);

INSERT INTO public.task_price_catalog (platform, action, user_reward, advertiser_price) VALUES
  ('x', 'like', 0.005, 0.008),
  ('x', 'follow', 0.010, 0.015),
  ('x', 'repost', 0.008, 0.013),
  ('x', 'comment', 0.015, 0.023),
  ('instagram', 'like', 0.005, 0.008),
  ('instagram', 'follow', 0.010, 0.015),
  ('instagram', 'comment', 0.015, 0.023),
  ('tiktok', 'like', 0.005, 0.008),
  ('tiktok', 'follow', 0.010, 0.015),
  ('tiktok', 'view', 0.003, 0.005),
  ('youtube', 'like', 0.007, 0.011),
  ('youtube', 'subscribe', 0.015, 0.023),
  ('youtube', 'comment', 0.015, 0.023),
  ('youtube', 'share', 0.010, 0.015),
  ('youtube', 'view', 0.003, 0.005),
  ('telegram', 'join', 0.010, 0.015),
  ('telegram', 'group_join', 0.010, 0.015),
  ('facebook', 'like', 0.005, 0.008),
  ('facebook', 'follow', 0.010, 0.015),
  ('facebook', 'comment', 0.015, 0.023),
  ('website', 'visit', 0.005, 0.008),
  ('website', 'registration', 0.020, 0.030),
  ('app', 'install', 0.50, 0.75)
ON CONFLICT (platform, action) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  label text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.feature_flags (key, enabled, label) VALUES
  ('marketplace', true, 'Task marketplace'),
  ('withdrawals', true, 'Withdrawals'),
  ('deposits', true, 'Deposits'),
  ('social_verification', true, 'Social verification'),
  ('youtube_watch', true, 'YouTube Watch'),
  ('app_tasks', true, 'App tasks'),
  ('kyc_campaigns', false, 'KYC campaigns'),
  ('ads', true, 'Watch ads'),
  ('sponsored_video', true, 'Sponsored video'),
  ('referrals', true, 'Referrals'),
  ('daily_checkin', true, 'Daily check-in'),
  ('telegram_gate', true, 'Telegram Gate')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.maintenance_modes (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  read_only boolean NOT NULL DEFAULT false,
  withdrawals_paused boolean NOT NULL DEFAULT false,
  deposits_paused boolean NOT NULL DEFAULT false,
  task_creation_paused boolean NOT NULL DEFAULT false,
  verification_paused boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.maintenance_modes (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.economy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_price_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_modes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.economy_settings TO service_role;
GRANT ALL ON public.task_price_catalog TO service_role;
GRANT ALL ON public.feature_flags TO service_role;
GRANT ALL ON public.maintenance_modes TO service_role;
