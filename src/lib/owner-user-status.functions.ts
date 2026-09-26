import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(userId: string) {
  const { assertOwner, admin } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return admin();
}

async function log(
  adminId: string,
  action: string,
  rest: { targetType?: string; targetId?: string; previous?: unknown; next?: unknown } = {},
) {
  const { audit } = await import("@/lib/owner-guard.server");
  await audit({ adminId, action, ...rest });
}

/**
 * Ban / suspend / activate a user. Verifies the row actually changed.
 * Requires service role (admin client) + ALL_FIXES_RUN_ONCE.sql policies.
 * Owners (TASKORA_OWNER_TELEGRAM_IDS or user_roles.owner) cannot be banned/suspended.
 * Setting status to active = Unban / Unsuspend.
 */
export const ownerSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "active" | "suspended" | "banned" }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    if (!["active", "suspended", "banned"].includes(data.status)) {
      throw new Error("Invalid status. Use active, suspended, or banned.");
    }
    if (data.userId === context.userId) {
      throw new Error("You cannot change your own account status.");
    }

    const { data: prev, error: prevErr } = await db
      .from("profiles")
      .select("id, status, display_name, telegram_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (prevErr) throw new Error(prevErr.message);
    if (!prev) throw new Error("User not found.");

    // Owners can never be banned or suspended
    if (data.status === "banned" || data.status === "suspended") {
      const { isOwnerTelegramId } = await import("@/lib/owner");
      if (isOwnerTelegramId(prev.telegram_id ?? null)) {
        throw new Error("Cannot ban or suspend an owner account.");
      }
      const { data: roleRow } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId)
        .eq("role", "owner")
        .maybeSingle();
      if (roleRow) {
        throw new Error("Cannot ban or suspend an owner account.");
      }
    }

    const { data: updated, error } = await db
      .from("profiles")
      .update({ status: data.status as never, updated_at: new Date().toISOString() })
      .eq("id", data.userId)
      .select("id, status")
      .maybeSingle();

    if (error) throw new Error(`Could not set status: ${error.message}`);
    if (!updated) {
      throw new Error(
        "Update blocked (no row returned). Run supabase/ALL_FIXES_RUN_ONCE.sql in Supabase SQL Editor, then retry.",
      );
    }
    if (String(updated.status) !== data.status) {
      throw new Error(
        `Status did not stick (got ${updated.status}). Run ALL_FIXES_RUN_ONCE.sql in Supabase.`,
      );
    }

    try {
      await log(context.userId, `user.${data.status}`, {
        targetType: "user",
        targetId: data.userId,
        previous: prev.status,
        next: data.status,
      });
    } catch {
      /* audit must not undo ban */
    }

    return { status: data.status, previous: prev.status };
  });
