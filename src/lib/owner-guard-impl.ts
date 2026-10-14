/**
 * Owner/admin authorization + audit (implementation).
 * Safe for dynamic import from createServerFn handlers.
 */
import { isOwnerTelegramId } from "@/lib/owner";

async function admin() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SUPABASE_SERVICE_KEY"] ||
    "";
  if (!url || !key) throw new Error("Supabase admin env not configured");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function assertOwner(userId: string) {
  const db = await admin();
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return;

  const { data: profile } = await db
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  if (isOwnerTelegramId(profile?.telegram_id ?? null)) {
    await db
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    return;
  }
  throw new Error("Owner/admin authorization required.");
}

export async function audit(params: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  previous?: unknown;
  next?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const db = await admin();
  const { data: profile } = await db
    .from("profiles")
    .select("display_name, username")
    .eq("id", params.adminId)
    .maybeSingle();
  await db.from("audit_logs").insert({
    admin_id: params.adminId,
    admin_label: profile?.username ?? profile?.display_name ?? params.adminId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    previous_value: (params.previous ?? null) as never,
    new_value: (params.next ?? null) as never,
    metadata: (params.metadata ?? null) as never,
  });
}
