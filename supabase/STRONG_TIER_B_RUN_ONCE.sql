-- Tier B: amendment queue + submission columns
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS amendment_count integer DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS amendment_deadline timestamptz;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS amendment_reason text;

CREATE TABLE IF NOT EXISTS submission_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES profiles(id),
  worker_id uuid NOT NULL REFERENCES profiles(id),
  task_id uuid REFERENCES tasks(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  deadline timestamptz,
  resubmitted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amendments_worker_open ON submission_amendments(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_amendments_submission ON submission_amendments(submission_id);
