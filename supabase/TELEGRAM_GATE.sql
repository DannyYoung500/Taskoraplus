-- TASKORA Telegram Channel Access Gate — additive only
-- Run in Supabase SQL Editor. Safe to re-run.

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

-- Service role / server functions handle writes. No public client write policies.
GRANT ALL ON public.telegram_gate_settings TO service_role;
GRANT ALL ON public.telegram_gate_events TO service_role;
GRANT ALL ON public.telegram_gate_bypass TO service_role;
