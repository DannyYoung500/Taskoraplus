-- Marketplace strong layer
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 70;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_count integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejected_count integer DEFAULT 0;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS hold_until timestamptz;

CREATE TABLE IF NOT EXISTS referral_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES profiles(id),
  referee_id uuid NOT NULL REFERENCES profiles(id),
  amount numeric NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  released_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_referral_pending_referee ON referral_pending(referee_id, status);
