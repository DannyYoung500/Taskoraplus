-- TASKORA Task Points economy
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='xp')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='task_points') THEN
    ALTER TABLE public.profiles RENAME COLUMN xp TO task_points;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='task_points') THEN
    ALTER TABLE public.profiles ADD COLUMN task_points INT NOT NULL DEFAULT 0;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.task_point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount > 0), kind TEXT NOT NULL, label TEXT NOT NULL, reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_point_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own task point ledger read" ON public.task_point_ledger;
CREATE POLICY "own task point ledger read" ON public.task_point_ledger FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.award_task_points(_user_id UUID,_amount INT,_kind TEXT,_label TEXT,_reference TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted_id UUID; total INT;
BEGIN
  IF _amount <= 0 THEN SELECT task_points INTO total FROM public.profiles WHERE id=_user_id; RETURN COALESCE(total,0); END IF;
  INSERT INTO public.task_point_ledger(user_id,amount,kind,label,reference) VALUES(_user_id,_amount,_kind,_label,_reference)
  ON CONFLICT(reference) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NOT NULL THEN UPDATE public.profiles SET task_points=COALESCE(task_points,0)+_amount WHERE id=_user_id; END IF;
  SELECT task_points INTO total FROM public.profiles WHERE id=_user_id; RETURN COALESCE(total,0);
END $$;
GRANT EXECUTE ON FUNCTION public.award_task_points(UUID,INT,TEXT,TEXT,TEXT) TO service_role;
