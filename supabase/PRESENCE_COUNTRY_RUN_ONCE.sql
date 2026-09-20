-- TASKORA: presence + country columns for owner user list
-- Safe / idempotent — run once in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_code TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_last_active
  ON public.profiles (last_active_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_profiles_country_code
  ON public.profiles (country_code)
  WHERE country_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.last_active_at IS 'Updated on login + dashboard heartbeat for owner online status';
COMMENT ON COLUMN public.profiles.country IS 'Display country name (edge geo preferred, else language signal)';
COMMENT ON COLUMN public.profiles.country_code IS 'ISO 3166-1 alpha-2 when known';
COMMENT ON COLUMN public.profiles.language_code IS 'Telegram WebApp language_code';
