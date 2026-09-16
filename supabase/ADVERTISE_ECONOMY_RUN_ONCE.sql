-- TASKORA Advertise Economy — run once in Supabase SQL Editor
-- Aligns with TASKORA_Advertise_Economy_Specification.md

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS campaign_status text DEFAULT 'active';

COMMENT ON COLUMN public.tasks.campaign_status IS 'draft | active | paused | completed | cancelled';

UPDATE public.tasks
SET campaign_status = CASE WHEN is_active THEN 'active' ELSE 'draft' END
WHERE campaign_status IS NULL OR campaign_status = 'active';

CREATE TABLE IF NOT EXISTS public.advertise_economy_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  tasker_share numeric NOT NULL DEFAULT 0.70,
  taskora_share numeric NOT NULL DEFAULT 0.30,
  global_min_campaign_usd numeric NOT NULL DEFAULT 1,
  global_max_campaign_usd numeric NOT NULL DEFAULT 50000,
  youtube_watch_customer_per_sec numeric NOT NULL DEFAULT 0.00010,
  youtube_watch_tasker_per_sec numeric NOT NULL DEFAULT 0.00007,
  youtube_watch_taskora_per_sec numeric NOT NULL DEFAULT 0.00003,
  youtube_watch_min_seconds int NOT NULL DEFAULT 1,
  youtube_watch_max_seconds int NOT NULL DEFAULT 3600,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

INSERT INTO public.advertise_economy_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.advertise_services (
  id text PRIMARY KEY,
  platform text NOT NULL,
  task_type text NOT NULL,
  title text NOT NULL,
  customer_usd numeric NOT NULL,
  tasker_usd numeric NOT NULL,
  taskora_usd numeric NOT NULL,
  unit text NOT NULL,
  min_qty int NOT NULL DEFAULT 1,
  max_qty int NOT NULL DEFAULT 100000,
  is_active boolean NOT NULL DEFAULT true,
  delivery text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advertise_services ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.economy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NULL,
  previous_value jsonb NULL,
  new_value jsonb NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economy_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tasks_active_slots
  ON public.tasks (is_active, slots_left)
  WHERE is_active = true AND slots_left > 0;
