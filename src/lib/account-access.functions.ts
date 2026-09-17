import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessState =
  | { state: "ok" }
  | { state: "banned"; reason: string }
  | { state: "suspended"; reason: string; until: string | null }
  | { state: "maintenance"; message: string };

/** Public: is the whole platform in maintenance? */
export const getMaintenanceMode = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance")
      .maybeSingle();
    const v = (data?.value ?? {}) as { enabled?: boolean; message?: string };
    return {
      enabled: Boolean(v.enabled),
      message:
        v.message?.trim() ||
        "We are currently performing scheduled maintenance to improve your experience.",
    };
  } catch {
    return { enabled: false, message: "" };
  }
});

/** Authenticated: user status + global maintenance (owners always pass). */
export const getAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isOwnerTelegramId } = await import("@/lib/owner");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("status, telegram_id, display_name")
      .eq("id", context.userId)
      .maybeSingle();

    const tg = (profile as { telegram_id?: number | string | null } | null)?.telegram_id;
    const isOwner = isOwnerTelegramId(tg ?? null);

    const { data: maint } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance")
      .maybeSingle();
    const mv = (maint?.value ?? {}) as { enabled?: boolean; message?: string };
    if (mv.enabled && !isOwner) {
      return {
        state: "maintenance",
        message:
          mv.message?.trim() ||
          "We are currently performing scheduled maintenance to improve your experience.",
      };
    }

    const status = String((profile as { status?: string } | null)?.status ?? "active").toLowerCase();
    if (status === "banned") {
      return {
        state: "banned",
        reason: "Violation of Terms of Service",
      };
    }
    if (status === "suspended") {
      return {
        state: "suspended",
        reason:
          "Your account has been suspended due to a violation of our Terms of Service. This action is temporary and may be reviewed.",
        until: null,
      };
    }
    return { state: "ok" };
  });

export const ownerSetMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean; message?: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner, admin, audit } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const db = admin();
    const value = {
      enabled: Boolean(data.enabled),
      message:
        (data.message ?? "").trim() ||
        "We are currently performing scheduled maintenance to improve your experience.",
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("app_settings").upsert(
      {
        key: "maintenance",
        value: value as never,
        is_public: true,
        updated_at: value.updated_at,
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await audit({
      adminId: context.userId,
      action: data.enabled ? "maintenance.on" : "maintenance.off",
      targetType: "settings",
      targetId: "maintenance",
      next: value,
    });
    return { ok: true as const, ...value };
  });
