-- =============================================================================
-- TASKORA — RUN THIS IN SUPABASE DASHBOARD → SQL EDITOR → New query → Run
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where possible.
-- Project: cyczvbhcfwzmmisslvwz
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums (ignore errors if already exist by using DO blocks)
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','advertiser','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_platform AS ENUM ('telegram','youtube','whatsapp','x','instagram','tiktok','discord','facebook'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.proof_type AS ENUM ('auto','screenshot','username'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.submission_status AS ENUM ('pending','verified','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tx_kind AS ENUM ('reward','referral','bonus','withdrawal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.withdrawal_status AS ENUM ('pending','processing','paid','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campaign_status AS ENUM ('draft','pending_funding','pending_review','active','paused','completed','rejected','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.connected_status AS ENUM ('pending','verified','rejected','revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Tasker',
  username TEXT,
  level TEXT NOT NULL DEFAULT 'Starter Tasker',
  referral_code TEXT NOT NULL UNIQUE,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  streak INT NOT NULL DEFAULT 0,
  last_checkin DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS xp INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_num INT NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_id_uidx ON public.profiles (telegram_id) WHERE telegram_id IS NOT NULL;

-- Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email,''),'@',1), 'Tasker'),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(COALESCE(NEW.email,''),'@',1)),
    'TASKORA-' || upper(substr(replace(NEW.id::text,'-',''),1,6))
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform public.task_platform NOT NULL,
  title TEXT NOT NULL,
  advertiser TEXT NOT NULL,
  reward NUMERIC(10,2) NOT NULL CHECK (reward > 0),
  seconds INT NOT NULL DEFAULT 30,
  slots_left INT NOT NULL DEFAULT 100,
  steps TEXT[] NOT NULL DEFAULT '{}',
  proof public.proof_type NOT NULL DEFAULT 'auto',
  link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_type TEXT;

-- Campaigns (before campaign_id FK on tasks)
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

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Submissions
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status public.submission_status NOT NULL DEFAULT 'pending',
  proof_text TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  kind public.tx_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  method TEXT NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 10),
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Connected accounts
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

-- Watch & Earn
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

-- Audit + settings
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.owner_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies (drop + recreate for idempotency)
DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "active tasks are public" ON public.tasks;
CREATE POLICY "active tasks are public" ON public.tasks FOR SELECT TO anon, authenticated USING (is_active);
DROP POLICY IF EXISTS "admins manage tasks" ON public.tasks;
CREATE POLICY "admins manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "own submissions read" ON public.submissions;
CREATE POLICY "own submissions read" ON public.submissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own submissions insert" ON public.submissions;
CREATE POLICY "own submissions insert" ON public.submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins update submissions" ON public.submissions;
CREATE POLICY "admins update submissions" ON public.submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "own transactions read" ON public.transactions;
CREATE POLICY "own transactions read" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "own withdrawals read" ON public.withdrawals;
CREATE POLICY "own withdrawals read" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "own connected accounts" ON public.connected_accounts;
CREATE POLICY "own connected accounts" ON public.connected_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "public read active campaigns" ON public.campaigns;
CREATE POLICY "public read active campaigns" ON public.campaigns FOR SELECT TO authenticated USING (status = 'active' OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admins manage campaigns" ON public.campaigns;
CREATE POLICY "admins manage campaigns" ON public.campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "own watch completions" ON public.watch_completions;
CREATE POLICY "own watch completions" ON public.watch_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read audit" ON public.audit_logs;
CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.tasks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.submissions TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Optional: seed demo tasks only if table is empty
INSERT INTO public.tasks (platform, title, advertiser, reward, seconds, slots_left, steps, proof, link)
SELECT * FROM (VALUES
  ('telegram'::public.task_platform,'Join the Alpha Signals channel','Alpha Signals',0.42,30,184,ARRAY['Open the channel','Tap Join','Stay joined for 7 days'],'auto'::public.proof_type,'https://t.me/telegram'),
  ('youtube'::public.task_platform,'Watch & like the launch video','Nova Wallet',0.85,90,62,ARRAY['Watch at least 60 seconds','Like the video','Return and submit'],'screenshot'::public.proof_type,'https://youtube.com'),
  ('x'::public.task_platform,'Follow @taskora and repost the pinned post','TASKORA',0.55,45,310,ARRAY['Follow the account','Repost the pinned post','Enter your handle'],'username'::public.proof_type,'https://x.com')
) AS v(platform, title, advertiser, reward, seconds, slots_left, steps, proof, link)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks LIMIT 1);

-- Done. After first Telegram login with TASKORA_OWNER_TELEGRAM_IDS set, admin role is auto-granted.
