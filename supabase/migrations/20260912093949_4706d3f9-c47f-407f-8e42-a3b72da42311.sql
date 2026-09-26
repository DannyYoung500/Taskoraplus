
CREATE TYPE public.app_role AS ENUM ('admin','advertiser','user');
CREATE TYPE public.task_platform AS ENUM ('telegram','youtube','whatsapp','x','instagram','tiktok','discord','facebook');
CREATE TYPE public.proof_type AS ENUM ('auto','screenshot','username');
CREATE TYPE public.submission_status AS ENUM ('pending','verified','rejected');
CREATE TYPE public.tx_kind AS ENUM ('reward','referral','bonus','withdrawal');
CREATE TYPE public.withdrawal_status AS ENUM ('pending','processing','paid','rejected');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
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
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

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
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), 'Tasker'),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    'TASKORA-' || upper(substr(replace(NEW.id::text,'-',''),1,6))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.tasks (
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
GRANT SELECT ON public.tasks TO anon, authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active tasks are public" ON public.tasks FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "admins manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.submissions (
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
GRANT SELECT, INSERT, UPDATE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own submissions read" ON public.submissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own submissions insert" ON public.submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update submissions" ON public.submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER submissions_updated BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  kind public.tx_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  method TEXT NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 10),
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals read" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER withdrawals_updated BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tasks (platform, title, advertiser, reward, seconds, slots_left, steps, proof, link) VALUES
('telegram','Join the Alpha Signals channel','Alpha Signals',0.42,30,184,ARRAY['Open the channel','Tap Join','Stay joined for 7 days'],'auto','https://t.me/telegram'),
('youtube','Watch & like the launch video','Nova Wallet',0.85,90,62,ARRAY['Watch at least 60 seconds','Like the video','Return and submit'],'screenshot','https://youtube.com'),
('x','Follow @taskora and repost the pinned post','TASKORA',0.55,45,310,ARRAY['Follow the account','Repost the pinned post','Enter your handle'],'username','https://x.com'),
('whatsapp','Join the merchant community group','PayLink Africa',0.60,40,45,ARRAY['Open the invite link','Join the group','Send the join code'],'screenshot','https://whatsapp.com'),
('tiktok','Follow the creator account','Loop Studio',0.38,25,120,ARRAY['Open the profile','Tap Follow','Enter your username'],'username','https://tiktok.com'),
('discord','Join the community server','Zenith Labs',0.70,60,128,ARRAY['Open the invite','Verify in #welcome','Submit your Discord tag'],'username','https://discord.com'),
('instagram','Follow and save the brand post','Aurum Wear',0.50,35,91,ARRAY['Follow the page','Save the pinned post','Upload a screenshot'],'screenshot','https://instagram.com');
