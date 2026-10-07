/**
 * Enhanced smart feed + referral credit with Tier A/B guards.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Referral credit with cluster + depth + fine kill-switch. */
export async function creditReferralPendingGuarded(opts: {
  inviterId: string;
  refereeId: string;
  amount: number;
  label?: string;
}): Promise<{ pending: boolean; blocked?: string }> {
  if (opts.amount <= 0) return { pending: false };
  try {
    const { assertFineSwitch } = await import("@/lib/strong-tier-b.functions");
    await assertFineSwitch("referral_payouts_paused");
  } catch (e) {
    if (e instanceof Error && e.message.includes("paused")) {
      return { pending: false, blocked: e.message };
    }
  }
  try {
    const { assertReferralClusterOk } = await import("@/lib/strong-tier-a.functions");
    const cluster = await assertReferralClusterOk({
      inviterId: opts.inviterId,
      refereeId: opts.refereeId,
    });
    if (!cluster.ok) {
      return { pending: false, blocked: cluster.reason ?? "referral_cluster" };
    }
  } catch {
    /* soft */
  }
  try {
    const { assertReferralDepthOk } = await import("@/lib/strong-next.functions");
    const depth = await assertReferralDepthOk({
      inviterId: opts.inviterId,
      refereeId: opts.refereeId,
    });
    if (!depth.ok) {
      return { pending: false, blocked: depth.reason ?? "referral_depth" };
    }
  } catch {
    /* soft */
  }
  const { creditReferralPending } = await import("@/lib/strong-marketplace.functions");
  return creditReferralPending(opts);
}

/** Smart feed with task quality score boost/penalty. */
export const listSmartTasksEnhanced = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await adminClient();
    const { data: tasks } = await s
      .from("tasks")
      .select("id, title, platform, reward, slots_left, slots_total, is_active, status, created_at, proof, task_type")
      .eq("is_active", true)
      .gt("slots_left", 0)
      .order("created_at", { ascending: false })
      .limit(80);

    const { data: mySubs } = await s
      .from("submissions")
      .select("task_id, status")
      .eq("user_id", context.userId)
      .limit(200);
    const done = new Set((mySubs ?? []).map((x) => x.task_id));

    const { data: profile } = await s
      .from("profiles")
      .select("country_code, trust_score")
      .eq("id", context.userId)
      .maybeSingle();
    const trust = Number((profile as { trust_score?: number } | null)?.trust_score ?? 70);

    const { qualityRankBoost } = await import("@/lib/strong-tier-a.functions");

    const candidates = (tasks ?? []).filter((t) => !done.has(t.id));
    const ranked: Array<Record<string, unknown> & { _rank: number }> = [];
    for (const t of candidates) {
      const reward = Number(t.reward ?? 0);
      const slotsLeft = Number(t.slots_left ?? 0);
      const slotsTotal = Math.max(1, Number(t.slots_total ?? slotsLeft));
      const fill = 1 - slotsLeft / slotsTotal;
      let score = reward * 10 + Math.min(slotsLeft, 50) * 0.2 - fill * 5;
      if (trust >= 80 && reward >= 0.05) score += 5;
      if (trust < 50 && reward >= 0.08) score -= 4;
      if (String(t.proof ?? "") === "auto") score += 2;
      try {
        score += await qualityRankBoost(t.id);
      } catch {
        /* soft */
      }
      ranked.push({ ...t, _rank: score });
    }
    ranked.sort((a, b) => b._rank - a._rank);
    const top = ranked.slice(0, 40).map(({ _rank, ...rest }) => rest);

    const availableRewards = top.reduce((sum, t) => sum + Number((t as { reward?: number }).reward ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const newToday = top.filter((t) => String((t as { created_at?: string }).created_at ?? "").startsWith(today)).length;

    return {
      tasks: top,
      meta: {
        available: top.length,
        availableRewardsUsd: Math.round(availableRewards * 100) / 100,
        newToday,
        trustBand: trust >= 80 ? "high" : trust >= 55 ? "mid" : "low",
      },
    };
  });
