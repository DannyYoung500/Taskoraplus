-- Optional columns for next-wave strong options (safe to re-run)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS device_fp_v2 text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 70;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_count integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejected_count integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_frozen boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_frozen_reason text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_frozen_at timestamptz;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS proof_perceptual_key text;
CREATE INDEX IF NOT EXISTS idx_submissions_proof_perceptual
  ON submissions (proof_perceptual_key)
  WHERE proof_perceptual_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_device_fp ON profiles (device_fp) WHERE device_fp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_device_fp_v2 ON profiles (device_fp_v2) WHERE device_fp_v2 IS NOT NULL;
