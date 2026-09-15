-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR (one click)
-- Fixes: Could not find the 'required_chats' column of 'telegram_gate_settings'
-- Safe to re-run.
-- ============================================================

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

ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS chat_type text NOT NULL DEFAULT 'channel';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS required_chats jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS revoke_on_leave boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS check_interval_seconds integer NOT NULL DEFAULT 30;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_admins boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_creators boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_members boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_restricted boolean NOT NULL DEFAULT false;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'JOIN OUR CHANNELS';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT 'Join every required community.';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS join_button_text text NOT NULL DEFAULT 'JOIN';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS check_button_text text NOT NULL DEFAULT 'CONTINUE';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS success_message text NOT NULL DEFAULT 'Access unlocked.';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS failure_message text NOT NULL DEFAULT 'Join every required community.';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS channel_id text;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS channel_url text;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS channel_name text NOT NULL DEFAULT 'TASKORA Community';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.telegram_gate_settings (id, enabled)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

UPDATE public.telegram_gate_settings
SET required_chats = CASE
  WHEN required_chats IS NOT NULL AND jsonb_typeof(required_chats) = 'array' AND jsonb_array_length(required_chats) > 0
    THEN required_chats
  WHEN nullif(trim(coalesce(channel_id, '')), '') IS NOT NULL THEN
    jsonb_build_array(jsonb_build_object(
      'id', channel_id,
      'type', coalesce(chat_type, 'channel'),
      'url', channel_url,
      'name', coalesce(channel_name, 'TASKORA Community')
    ))
  ELSE '[]'::jsonb
END
WHERE id = true;

CREATE TABLE IF NOT EXISTS public.telegram_gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  telegram_id bigint,
  status text NOT NULL,
  membership_status text,
  error_code text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_gate_events_user_checked_idx
  ON public.telegram_gate_events (user_id, checked_at DESC);

ALTER TABLE public.telegram_gate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_gate_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.telegram_gate_settings TO service_role;
GRANT ALL ON public.telegram_gate_events TO service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'OK: required_chats column is ready' AS status;
