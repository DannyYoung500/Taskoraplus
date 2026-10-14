/** Runtime Supabase admin (service role). Use only inside createServerFn handlers. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function build(): SupabaseClient {
  if (_client) return _client;
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SUPABASE_SERVICE_KEY"] ||
    "";
  if (!url || !key) throw new Error("Supabase admin env not configured");
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

/** Eager export for: const { supabaseAdmin } = await import("@/lib/supabase-admin-impl"); */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    const c = build();
    const v = Reflect.get(c, prop, receiver);
    return typeof v === "function" ? v.bind(c) : v;
  },
});
