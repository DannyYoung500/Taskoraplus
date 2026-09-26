-- TASKORA strong ops — run once in Supabase SQL editor
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS proof_hash text;
CREATE INDEX IF NOT EXISTS submissions_proof_hash_idx ON public.submissions (proof_hash) WHERE proof_hash IS NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_fp text, ADD COLUMN IF NOT EXISTS last_ip_hint text, ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS profiles_device_fp_idx ON public.profiles (device_fp) WHERE device_fp IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.payout_address_allowlist (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, address)
);
CREATE INDEX IF NOT EXISTS payout_allowlist_user_idx ON public.payout_address_allowlist (user_id);
