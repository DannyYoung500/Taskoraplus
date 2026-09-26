-- =============================================================================
-- TASKORA — RUN ALL OWNER SQL (safe to re-run)
-- Supabase Dashboard → SQL Editor → paste → Run
-- Does NOT delete users, tasks, wallets, or campaigns.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles extras
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risk_band TEXT DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS freeze_withdrawals boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS freeze_spending boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS restrict_tasks boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_id_uidx
  ON public.profiles (telegram_id) WHERE telegram_id IS NOT NULL;

-- Support
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text DEFAULT 'normal',
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Telegram Gate
CREATE TABLE IF NOT EXISTS public.telegram_gate_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT false,
  chat_type text NOT NULL DEFAULT 'channel',
  channel_id text,
  channel_url text,
  channel_name text NOT NULL DEFAULT 'TASKORA Community',
  title text NOT NULL DEFAULT 'JOIN TASKORA COMMUNITY',
  description text NOT NULL DEFAULT 'Join our official Telegram community to unlock TASKORA.',
  join_button_text text NOT NULL DEFAULT 'JOIN TELEGRAM',
  check_button_text text NOT NULL DEFAULT 'CHECK MEMBERSHIP',
  success_message text NOT NULL DEFAULT 'Your TASKORA access has been unlocked.',
  failure_message text NOT NULL DEFAULT 'Please join and try again.',
  check_interval_seconds int NOT NULL DEFAULT 300,
  revoke_on_leave boolean NOT NULL DEFAULT true,
  allow_admins boolean NOT NULL DEFAULT true,
  allow_creators boolean NOT NULL DEFAULT true,
  allow_members boolean NOT NULL DEFAULT true,
  allow_restricted boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.telegram_gate_settings
  ADD COLUMN IF NOT EXISTS chat_type text NOT NULL DEFAULT 'channel';

INSERT INTO public.telegram_gate_settings (id, enabled)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.telegram_gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  telegram_id bigint,
  status text NOT NULL,
  membership_status text,
  error_code text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_gate_bypass (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Owner documents
CREATE TABLE IF NOT EXISTS public.owner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  category text NOT NULL DEFAULT 'general',
  is_public boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'owner-docs', 'owner-docs', false, 26214400,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Audit
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users ON DELETE SET NULL,
  admin_id uuid REFERENCES auth.users ON DELETE SET NULL,
  admin_label text,
  action text NOT NULL,
  entity text,
  entity_id text,
  target_type text,
  target_id text,
  previous_value jsonb,
  new_value jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Economy
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
INSERT INTO public.economy_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

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
INSERT INTO public.maintenance_modes (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Connected accounts verification history
CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text,
  profile_url text,
  platform_account_id text,
  verification_status text NOT NULL DEFAULT 'pending',
  verification_method text,
  verification_code text,
  last_checked_at timestamptz,
  metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  correlation_id text,
  entry_type text NOT NULL,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  reference text,
  balance_after numeric,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_user_idx ON public.ledger_entries (user_id, created_at DESC);

-- Staff roles matrix (beyond owner)
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_gate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_gate_bypass ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_price_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.announcements TO service_role;
GRANT ALL ON public.telegram_gate_settings TO service_role;
GRANT ALL ON public.telegram_gate_events TO service_role;
GRANT ALL ON public.telegram_gate_bypass TO service_role;
GRANT ALL ON public.owner_documents TO service_role;
GRANT ALL ON public.audit_logs TO service_role;
GRANT ALL ON public.economy_settings TO service_role;
GRANT ALL ON public.task_price_catalog TO service_role;
GRANT ALL ON public.feature_flags TO service_role;
GRANT ALL ON public.maintenance_modes TO service_role;
GRANT ALL ON public.connected_accounts TO service_role;
GRANT ALL ON public.ledger_entries TO service_role;
GRANT ALL ON public.staff_permissions TO service_role;

-- Long task text
ALTER TABLE IF EXISTS public.tasks
  ALTER COLUMN description TYPE text;
ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS brief_document_id uuid;

-- Done
