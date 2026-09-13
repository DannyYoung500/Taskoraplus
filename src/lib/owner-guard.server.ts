/**
 * Server-only owner/admin authorization + audit logging helpers.
 * Never import this from a component or a module-scope of a client-reachable file.
 */
import { isOwnerTelegramId } from "@/lib/owner";

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
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
