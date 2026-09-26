-- TASKORA — Owner PDF library + Telegram Gate group support
-- Run in Supabase SQL Editor. Safe to re-run.

-- Gate: allow channel OR group / supergroup
ALTER TABLE IF EXISTS public.telegram_gate_settings
  ADD COLUMN IF NOT EXISTS chat_type text NOT NULL DEFAULT 'channel';

COMMENT ON COLUMN public.telegram_gate_settings.chat_type IS
  'channel | group | supergroup — bot must be admin in that chat';

-- Owner document library (PDFs / long briefs)
CREATE TABLE IF NOT EXISTS public.owner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  category text NOT NULL DEFAULT 'general',
  is_public boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_documents_created_idx
  ON public.owner_documents (created_at DESC);

ALTER TABLE public.owner_documents ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.owner_documents TO service_role;

-- Storage bucket for owner PDFs (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'owner-docs',
  'owner-docs',
  false,
  26214400,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No open public policies; server uses service role for signed URLs

-- Long task briefs: ensure description is unlimited text
ALTER TABLE IF EXISTS public.tasks
  ALTER COLUMN description TYPE text;

ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS brief_document_id uuid REFERENCES public.owner_documents(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS instructions text;
