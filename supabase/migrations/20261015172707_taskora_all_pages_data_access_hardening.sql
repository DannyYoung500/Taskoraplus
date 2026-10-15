-- TaskoraPlus page-access hardening.
-- The welcome-delivery table contains Telegram identifiers and is written by trusted server jobs only.
ALTER TABLE public.telegram_welcome_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.telegram_welcome_deliveries FROM PUBLIC, anon, authenticated;

-- Game round completion credits rewards and is called by the authenticated server function
-- through the service-role client. Do not expose this SECURITY DEFINER function as a direct RPC.
REVOKE EXECUTE ON FUNCTION public.complete_taskora_game_round(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_taskora_game_round(uuid, uuid, integer) TO service_role;
