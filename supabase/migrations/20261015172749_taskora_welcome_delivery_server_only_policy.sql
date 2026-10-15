-- The Telegram welcome-delivery log contains Telegram identifiers and is internal-only.
-- Keep the table inaccessible to browser roles and explicitly deny their RLS operations.
ALTER TABLE public.telegram_welcome_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.telegram_welcome_deliveries FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "welcome delivery log is server only" ON public.telegram_welcome_deliveries;
CREATE POLICY "welcome delivery log is server only"
ON public.telegram_welcome_deliveries
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
