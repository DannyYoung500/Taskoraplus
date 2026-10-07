-- Tier A: dual reviews table (optional; soft-fail if missing)
CREATE TABLE IF NOT EXISTS dual_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES profiles(id),
  role text NOT NULL CHECK (role IN ('worker', 'advertiser')),
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  revealed boolean DEFAULT false,
  revealed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (submission_id, role)
);
CREATE INDEX IF NOT EXISTS idx_dual_reviews_submission ON dual_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_dual_reviews_rater ON dual_reviews(rater_id);
