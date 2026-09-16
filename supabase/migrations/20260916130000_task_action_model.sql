-- TASKORA task action model
-- Keeps the existing Advertise UI intact while giving every task a platform-safe action.

DO $$
DECLARE
  value_name TEXT;
BEGIN
  FOREACH value_name IN ARRAY ARRAY[
    'reddit','linkedin','twitch','threads','spotify','soundcloud','audiomack',
    'pinterest','google','website','survey','app_review'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.task_platform ADD VALUE IF NOT EXISTS %L', value_name);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS warning_text TEXT,
  ADD COLUMN IF NOT EXISTS target_url TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'easy',
  ADD COLUMN IF NOT EXISTS screenshots_required INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proof_requirements TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS task_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.tasks
SET target_url = COALESCE(target_url, link)
WHERE target_url IS NULL AND link IS NOT NULL;

UPDATE public.tasks
SET task_type = CASE
  WHEN lower(title) ~ '(watch|video)' AND platform IN ('youtube','tiktok','instagram','facebook','x','telegram','whatsapp','discord','reddit','linkedin','twitch','threads','website') THEN 'watch'
  WHEN lower(title) ~ '(play|plays)' AND platform IN ('spotify','soundcloud','audiomack') THEN 'play'
  WHEN lower(title) ~ '(traffic|click|visit)' AND platform = 'website' THEN 'visit'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%follow%' THEN 'follow'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%subscribe%' THEN 'subscribe'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%repost%' THEN 'repost'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%comment%' THEN 'comment'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%like%' THEN 'like'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%join%' THEN 'join'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%review%' THEN 'review'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%save%' THEN 'save'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%vote%' THEN 'vote'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%sign%' THEN 'signup'
  WHEN lower(COALESCE(steps[2], '')) LIKE '%visit%' THEN 'visit'
  ELSE task_type
END
WHERE task_type IS NULL;

CREATE OR REPLACE FUNCTION public.task_action_allowed(p_platform TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_platform
    WHEN 'telegram' THEN p_action IN ('join','follow','watch','like','comment')
    WHEN 'youtube' THEN p_action IN ('watch','subscribe','like','comment')
    WHEN 'whatsapp' THEN p_action IN ('join','follow','watch')
    WHEN 'x' THEN p_action IN ('follow','like','repost','comment','watch')
    WHEN 'instagram' THEN p_action IN ('follow','like','comment','watch')
    WHEN 'tiktok' THEN p_action IN ('follow','like','comment','watch')
    WHEN 'discord' THEN p_action IN ('join','follow','watch')
    WHEN 'facebook' THEN p_action IN ('follow','like','comment','watch')
    WHEN 'reddit' THEN p_action IN ('follow','like','comment','watch')
    WHEN 'linkedin' THEN p_action IN ('follow','like','comment','watch')
    WHEN 'twitch' THEN p_action IN ('follow','watch','comment')
    WHEN 'threads' THEN p_action IN ('follow','like','repost','comment','watch')
    WHEN 'spotify' THEN p_action IN ('play','follow','like','watch')
    WHEN 'soundcloud' THEN p_action IN ('play','follow','like','watch')
    WHEN 'audiomack' THEN p_action IN ('play','follow','like','watch')
    WHEN 'pinterest' THEN p_action IN ('follow','like','save','watch')
    WHEN 'google' THEN p_action IN ('review','watch')
    WHEN 'website' THEN p_action IN ('visit','signup','watch')
    WHEN 'survey' THEN p_action IN ('vote','signup','watch')
    WHEN 'app_review' THEN p_action IN ('review','watch')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_task_action(p_action TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(regexp_replace(COALESCE(p_action,''), '[[:space:]-]+', '_', 'g')))
    WHEN 'view' THEN 'watch'
    WHEN 'views' THEN 'watch'
    WHEN 'follower' THEN 'follow'
    WHEN 'followers' THEN 'follow'
    WHEN 'subscribers' THEN 'subscribe'
    WHEN 'member' THEN 'join'
    WHEN 'members' THEN 'join'
    WHEN 'reposts' THEN 'repost'
    WHEN 'saves' THEN 'save'
    WHEN 'plays' THEN 'play'
    WHEN 'traffic' THEN 'visit'
    WHEN 'signups' THEN 'signup'
    WHEN 'votes' THEN 'vote'
    ELSE lower(trim(regexp_replace(COALESCE(p_action,''), '[[:space:]-]+', '_', 'g')))
  END;
$$;

UPDATE public.tasks
SET task_type = public.normalize_task_action(task_type)
WHERE task_type IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_task_action()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.task_type := public.normalize_task_action(NEW.task_type);
  IF NEW.task_type IS NOT NULL AND NOT public.task_action_allowed(NEW.platform::TEXT, NEW.task_type) THEN
    RAISE EXCEPTION 'Task action % is not allowed on platform %', NEW.task_type, NEW.platform;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_validate_action ON public.tasks;
CREATE TRIGGER tasks_validate_action
BEFORE INSERT OR UPDATE OF platform, task_type
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_action();

CREATE INDEX IF NOT EXISTS tasks_platform_task_type_active_idx
  ON public.tasks(platform, task_type, is_active);
