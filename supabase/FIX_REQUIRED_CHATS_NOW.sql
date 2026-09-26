-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR (one click) — fixes gate save error
-- "Could not find the 'required_chats' column of 'telegram_gate_settings'"
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

-- Add missing columns on existing table (idempotent)
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS chat_type text NOT NULL DEFAULT 'channel';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS required_chats jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS revoke_on_leave boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS check_interval_seconds integer NOT NULL DEFAULT 30;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_admins boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_creators boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_members boolean NOT NULL DEFAULT true;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS allow_restricted boolean NOT NULL DEFAULT false;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'JOIN OUR CHANNELS';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT 'Join every required TASKORA Telegram community to unlock the Mini App.';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS join_button_text text NOT NULL DEFAULT 'JOIN';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS check_button_text text NOT NULL DEFAULT 'CONTINUE';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS success_message text NOT NULL DEFAULT 'Your TASKORA access has been unlocked.';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS failure_message text NOT NULL DEFAULT 'Join every required community and try again.';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS channel_id text;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS channel_url text;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS channel_name text NOT NULL DEFAULT 'TASKORA Community';
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.telegram_gate_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Migrate legacy single-channel into required_chats when empty
UPDATE public.telegram_gate_settings
SET required_chats = jsonb_build_array(
  jsonb_build_object(
    'id', coalesce(channel_id, ''),
    'url', coalesce(channel_url, ''),
    'name', coalesce(channel_name, 'TASKORA Community'),
    'type', coalesce(chat_type, 'channel')
  )
)
WHERE (required_chats IS NULL OR required_chats = '[]'::jsonb)
  AND (channel_id IS NOT NULL OR channel_url IS NOT NULL);
