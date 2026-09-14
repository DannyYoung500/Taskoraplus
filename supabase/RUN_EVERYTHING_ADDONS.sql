-- =============================================================================
-- TASKORA — RUN IN SUPABASE → SQL Editor → New query → Run
-- Safe to re-run (IF NOT EXISTS). Does NOT delete users/tasks/wallets.
-- Run AFTER core schema (RUN_IN_SUPABASE_SQL_EDITOR.sql) if not already applied.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles extras (if core already ran, these no-op safely)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_id_uidx
  ON public.profiles (telegram_id) WHERE telegram_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Support tickets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets (status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'announcements_read_active'
  ) THEN
    CREATE POLICY announcements_read_active ON public.announcements
      FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Telegram Channel Access Gate
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_gate_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT false,
  channel_id text,
  channel_url text,
  channel_name text NOT NULL DEFAULT 'TASKORA Community',
  title text NOT NULL DEFAULT 'JOIN TASKORA COMMUNITY',
  description text NOT NULL DEFAULT 'Join our official Telegram channel to unlock TASKORA and start earning.',
  join_button_text text NOT NULL DEFAULT 'JOIN TELEGRAM CHANNEL',
  check_button_text text NOT NULL DEFAULT 'CHECK MEMBERSHIP',
  success_message text NOT NULL DEFAULT 'Your TASKORA access has been unlocked.',
  failure_message text NOT NULL DEFAULT 'Please join the official TASKORA channel and try again.',
  check_interval_seconds int NOT NULL DEFAULT 300,
  revoke_on_leave boolean NOT NULL DEFAULT true,
  allow_admins boolean NOT NULL DEFAULT true,
  allow_creators boolean NOT NULL DEFAULT true,
  allow_members boolean NOT NULL DEFAULT true,
  allow_restricted boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS telegram_gate_events_user_checked_idx
  ON public.telegram_gate_events (user_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_gate_bypass (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_gate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_gate_bypass ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Audit logs (if missing)
-- ---------------------------------------------------------------------------
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

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Grants for service role (server functions)
-- ---------------------------------------------------------------------------
GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.announcements TO service_role;
GRANT ALL ON public.telegram_gate_settings TO service_role;
GRANT ALL ON public.telegram_gate_events TO service_role;
GRANT ALL ON public.telegram_gate_bypass TO service_role;
GRANT ALL ON public.audit_logs TO service_role;

-- Done. Enable Telegram Gate from Owner → Platform settings after bot is channel admin.
