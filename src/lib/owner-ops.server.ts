/** Server-only access shim for owner operations. Keep privileged Supabase client imports isolated here. */
export { supabaseAdmin } from "@/integrations/supabase/client.server";
