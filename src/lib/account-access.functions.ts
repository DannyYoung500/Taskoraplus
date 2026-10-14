import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
    const { data, error } = await supabaseAdmin
      .from("account_access_logs")
      .select("id, action, ip_hint, user_agent, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      return { rows: [] as Array<Record<string, unknown>> };
    }
    return { rows: data ?? [] };
  });

export const recordAccountAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action?: string; ipHint?: string; userAgent?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
    try {
      await supabaseAdmin.from("account_access_logs").insert({
        user_id: context.userId,
        action: data.action ?? "session",
        ip_hint: data.ipHint ?? null,
        user_agent: data.userAgent ?? null,
      });
    } catch {
      /* soft */
    }
    return { ok: true };
  });
