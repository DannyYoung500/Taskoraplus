import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner-only RPC wrappers. Database and crypto helpers live in strong-plus-impl.ts. */
export const ownerRunStuckTaskSla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { hours?: number; autoPause?: boolean }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner-guard-impl");
    await assertOwner(context.userId);
    const { runStuckTaskSla } = await import("@/lib/strong-plus-impl");
    return runStuckTaskSla({
      hours: Number((data as { hours?: number })?.hours ?? 48),
      autoPause: (data as { autoPause?: boolean })?.autoPause !== false,
    });
  });

export const ownerGetCompletionsHeatMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard-impl");
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
    const { data: subs } = await supabaseAdmin
      .from("submissions")
      .select("user_id, status, created_at")
      .in("status", ["verified", "approved", "auto_approved"])
      .order("created_at", { ascending: false })
      .limit(3000);
    const userIds = [...new Set((subs ?? []).map((s) => String((s as { user_id: string }).user_id)))];
    const countryMap = new Map<string, number>();
    if (userIds.length) {
      for (let i = 0; i < userIds.length; i += 100) {
        const chunk = userIds.slice(i, i + 100);
        const { data: profiles } = await supabaseAdmin.from("profiles").select("id, country_code, country").in("id", chunk);
        const byId = new Map((profiles ?? []).map((p) => [
          p.id,
          String((p as { country_code?: string }).country_code ?? (p as { country?: string }).country ?? "Unknown").trim().toUpperCase() || "UNKNOWN",
        ]));
        for (const s of subs ?? []) {
          const uid = String((s as { user_id: string }).user_id);
          if (!chunk.includes(uid)) continue;
          const cc = byId.get(uid) ?? "UNKNOWN";
          countryMap.set(cc, (countryMap.get(cc) ?? 0) + 1);
        }
      }
    }
    const rows = [...countryMap.entries()].map(([country, completions]) => ({ country, completions })).sort((a, b) => b.completions - a.completions).slice(0, 40);
    return { total: rows.reduce((s, r) => s + r.completions, 0), rows };
  });

export const ownerRunAdvertiserReputation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { advertiserId?: string; autoPause?: boolean }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner-guard-impl");
    await assertOwner(context.userId);
    const { ownerRunAdvertiserReputationInternal } = await import("@/lib/strong-plus-impl");
    return ownerRunAdvertiserReputationInternal(data as { advertiserId?: string; autoPause?: boolean });
  });
