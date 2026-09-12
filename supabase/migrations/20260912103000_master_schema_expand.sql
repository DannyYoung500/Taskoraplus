-- TASKORA master schema expansion (campaigns, connected accounts, telegram id, watch, audit)
-- Apply with Supabase CLI / dashboard. Does not fabricate balances.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS xp INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_num INT NOT NULL DEFAULT 1;

CREATE TYPE public.campaign_status AS ENUM (
  'draft','pending_funding','pending_review','active','paused','completed','rejected','expired','cancelled'
);

CREATE TYPE public.connected_status AS ENUM ('pending','verified','rejected','revoked');

CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  platform public.task_platform NOT NULL,
  handle TEXT NOT NULL,
  profile_url TEXT,
  status public.connected_status NOT NULL DEFAULT 'pending',
  external_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connected accounts" ON public.connected_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  platform public.task_platform NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  target_url TEXT,
  reward NUMERIC(10,2) NOT NULL CHECK (reward > 0),
  slots INT NOT NULL CHECK (slots > 0),
  remaining_slots INT NOT NULL,
  budget NUMERIC(12,2) NOT NULL CHECK (budget >= 0),
  amount_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY "admins manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_type TEXT;

CREATE TABLE IF NOT EXISTS public.watch_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  reward_per_video NUMERIC(10,2) NOT NULL DEFAULT 0,
  daily_limit INT NOT NULL DEFAULT 0,
  cooldown_seconds INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.watch_settings (id, enabled) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.watch_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider_tx_id TEXT NOT NULL,
  reward NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_tx_id)
);
ALTER TABLE public.watch_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watch completions" ON public.watch_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.owner_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
