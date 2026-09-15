-- ============================================================
-- TASKORA — RUN ONCE in Supabase → SQL Editor → Run
-- Does NOT disappear: creates real tables/columns/policies.
-- Safe to re-run (idempotent).
-- ============================================================

-- 1) Ensure user_status enum has all values
DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) profiles.status must use the enum
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'active';

DO $$ BEGIN
  ALTER TABLE public.profiles
    ALTER COLUMN status TYPE public.user_status
    USING (
      CASE
        WHEN status::text IN ('active','suspended','banned') THEN status::text::public.user_status
        ELSE 'active'::public.user_status
      END
    );
EXCEPTION WHEN others THEN NULL;
END $$;

-- 3) Admin can update any profile status
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin update any profile" ON public.profiles;
CREATE POLICY "admin update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- 4) Gate settings + required_chats
CREATE TABLE IF NOT EXISTS public.telegram_gate_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT false,
  chat_type text NOT NULL DEFAULT 'channel',
  channel_id text,
  channel_url text,
  channel_name text NOT NULL DEFAULT 'TASKORA Community',
  title text NOT NULL DEFAULT 'JOIN OUR CHANNELS',
  description text NOT NULL DEFAULT 'Join every required TASKORA Telegram community to unlock the Mini App.',
  join_button_text text NOT NULL DEFAULT 'JOIN',
  check_button_text text NOT NULL DEFAULT 'CONTINUE',
  success_message text NOT NULL DEFAULT 'Your TASKORA access has been unlocked.',
  failure_message text NOT NULL DEFAULT 'Join every required community and try again.',
  check_interval_seconds integer NOT NULL DEFAULT 30,
  revoke_on_leave boolean NOT NULL DEFAULT true,
  allow_admins boolean NOT NULL DEFAULT true,
  allow_creators boolean NOT NULL DEFAULT true,
  allow_members boolean NOT NULL DEFAULT true,
  allow_restricted boolean NOT NULL DEFAULT false,
  required_chats jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS required_chats jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
INSERT INTO public.telegram_gate_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT ALL ON public.telegram_gate_settings TO service_role;
GRANT SELECT ON public.telegram_gate_settings TO authenticated;

-- 5) Dual approval / whitelist / platform settings
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
INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.gate_whitelist (
  telegram_id bigint PRIMARY KEY,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS approval_stage text NOT NULL DEFAULT 'pending';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS first_approved_by uuid;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS first_approved_at timestamptz;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS second_approved_by uuid;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS second_approved_at timestamptz;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS is_first_withdrawal boolean NOT NULL DEFAULT false;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS requires_dual boolean NOT NULL DEFAULT false;

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

-- 6) Verify after Run
SELECT 'profiles by status' AS check_name, status::text AS detail, count(*)::text AS n
FROM public.profiles GROUP BY status;
