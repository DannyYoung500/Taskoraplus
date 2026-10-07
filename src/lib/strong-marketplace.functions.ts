/**
 * TASKORA marketplace strength layer (real production):
 * 1 Trust Score updates
 * 2 Smart withdrawal risk hold
 * 3 Anti-farm referral (pending → release after activity)
 * 5 Campaign auto-pause on fraud/completion collapse
 * 6 Advertiser analytics
 * 7 Smart task feed ranking
 * 8 Worker + advertiser reputation
 *
 * Escrow already lives in advertise.functions (reserve_campaign_budget).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** 1 · Apply trust delta and clamp 0–100. */
export async function applyTrustScoreDelta(opts: {
  userId: string;
  delta: number;
  reason?: string;
}): Promise<{ trust: number }> {
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("trust_score")
      .eq("id", opts.userId)
      .maybeSingle();
    const prev = Number((profile as { trust_score?: number } | null)?.trust_score ?? 70);
    const next = Math.max(0, Math.min(100, Math.round(prev + opts.delta)));
    await s.from("profiles").update({ trust_score: next } as never).eq("id", opts.userId);
    return { trust: next };
  } catch {
    return { trust: 70 };
  }
}

/** On verified submission: +trust; on reject: −trust. */
export async function onSubmissionReviewed(opts: {
  userId: string;
  decision: "verified" | "approved" | "rejected";
}): Promise<void> {
  if (opts.decision === "rejected") {
    await applyTrustScoreDelta({ userId: opts.userId, delta: -8, reason: "reject" });
    try {
      const s = await adminClient();
      await s.rpc("increment_profile_counter", {
        p_user_id: opts.userId,
        p_field: "rejected_count",
      } as never);
    } catch {
      try {
        const s = await adminClient();
        const { data: p } = await s.from("profiles").select("rejected_count").eq("id", opts.userId).maybeSingle();
        const n = Number((p as { rejected_count?: number } | null)?.rejected_count ?? 0) + 1;
        await s.from("profiles").update({ rejected_count: n } as never).eq("id", opts.userId);
      } catch {
        /* soft */
      }
    }
  } else {
    await applyTrustScoreDelta({ userId: opts.userId, delta: 3, reason: "verified" });
    try {
      const s = await adminClient();
      const { data: p } = await s.from("profiles").select("approved_count").eq("id", opts.userId).maybeSingle();
      const n = Number((p as { approved_count?: number } | null)?.approved_count ?? 0) + 1;
      await s.from("profiles").update({ approved_count: n } as never).eq("id", opts.userId);
    } catch {
      /* soft */
    }
  }
}

/** 2 · Smart withdrawal risk hold tiers. */
export type WdRiskDecision = {
  action: "auto" | "hold" | "owner_review" | "block";
  holdHours: number;
  score: number;
  signals: string[];
  message?: string;
};

export async function decideWithdrawalRisk(opts: {
  userId: string;
  amount: number;
}): Promise<WdRiskDecision> {
  const { computeCompositeFraudScore } = await import("@/lib/strong-score.functions");
  const r = await computeCompositeFraudScore(opts.userId);
  const score = r.score;
  const signals = r.signals;

  if (r.action === "block" || score >= 75) {
    return {
      action: "block",
      holdHours: 0,
      score,
      signals,
      message: "Withdrawal blocked by risk engine. Contact support.",
    };
  }
  if (r.action === "hold" || score >= 55) {
    return {
      action: "owner_review",
      holdHours: 0,
      score,
      signals,
      message: "High risk — owner review required before payout.",
    };
  }
  if (score >= 35 || opts.amount >= 25) {
    return {
      action: "hold",
      holdHours: score >= 45 ? 24 : 6,
      score,
      signals,
      message: `Security hold ~${score >= 45 ? 24 : 6}h while we verify this payout.`,
    };
  }
  return { action: "auto", holdHours: 0, score, signals };
}

/** Apply risk decision into withdrawal insert fields. */
export async function applySmartWithdrawalHold(opts: {
  userId: string;
  amount: number;
  requiresDual: boolean;
}): Promise<{ requiresDual: boolean; holdUntil: string | null; riskAction: string; score: number }> {
  const d = await decideWithdrawalRisk({ userId: opts.userId, amount: opts.amount });
  if (d.action === "block") {
    throw new Error(d.message ?? "Withdrawal blocked by risk engine.");
  }
  let requiresDual = opts.requiresDual;
  if (d.action === "owner_review" || d.action === "hold") requiresDual = true;
  const holdUntil =
    d.holdHours > 0
      ? new Date(Date.now() + d.holdHours * 3600_000).toISOString()
      : null;
  return { requiresDual, holdUntil, riskAction: d.action, score: d.score };
}

/** 3 · Anti-farm referral: credit to pending table, release after real activity. */
export async function creditReferralPending(opts: {
  inviterId: string;
  refereeId: string;
  amount: number;
  label?: string;
}): Promise<{ pending: boolean }> {
  if (opts.amount <= 0) return { pending: false };
  try {
    const s = await adminClient();
    await s.from("referral_pending").insert({
      inviter_id: opts.inviterId,
      referee_id: opts.refereeId,
      amount: opts.amount,
      label: opts.label ?? "Referral share",
      status: "pending",
      created_at: new Date().toISOString(),
    } as never);
    return { pending: true };
  } catch {
    // Table may not exist — fall back to immediate (caller handles)
    return { pending: false };
  }
}

/** Release pending referral shares when referee has real activity. */
export async function releasePendingReferralsForReferee(opts: {
  refereeId: string;
}): Promise<{ released: number }> {
  try {
    const s = await adminClient();
    const { count: tasks } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.refereeId)
      .in("status", ["verified", "approved", "auto_approved"]);
    const { count: watches } = await s
      .from("watch_video_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.refereeId)
      .eq("status", "completed");
    if ((tasks ?? 0) < 3 || (watches ?? 0) < 5) return { released: 0 };

    const { data: pending } = await s
      .from("referral_pending")
      .select("id, inviter_id, amount, label")
      .eq("referee_id", opts.refereeId)
      .eq("status", "pending")
      .limit(20);
    let released = 0;
    for (const row of pending ?? []) {
      const amount = Number((row as { amount?: number }).amount ?? 0);
      const inviterId = String((row as { inviter_id: string }).inviter_id);
      if (amount <= 0) continue;
      const { error } = await s.from("transactions").insert({
        user_id: inviterId,
        label: String((row as { label?: string }).label ?? "Referral share"),
        amount,
        kind: "referral",
      });
      if (!error) {
        await s
          .from("referral_pending")
          .update({ status: "released", released_at: new Date().toISOString() } as never)
          .eq("id", (row as { id: string }).id);
        released += 1;
      }
    }
    return { released };
  } catch {
    return { released: 0 };
  }
}

/** 5 · Campaign auto-pause when fraud/reject spikes. */
export async function maybeAutoPauseCampaign(opts: {
  taskId: string;
}): Promise<{ paused: boolean; reason?: string }> {
  try {
    const s = await adminClient();
    const { data: task } = await s
      .from("tasks")
      .select("id, is_active, status, created_by, slots_left")
      .eq("id", opts.taskId)
      .maybeSingle();
    if (!task || !(task as { is_active?: boolean }).is_active) return { paused: false };

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: rows } = await s
      .from("submissions")
      .select("status")
      .eq("task_id", opts.taskId)
      .gte("created_at", since)
      .limit(50);
    const samples = (rows ?? []).length;
    if (samples < 8) return { paused: false };
    const rejected = (rows ?? []).filter((r) => String((r as { status?: string }).status) === "rejected").length;
    const ratio = rejected / samples;
    if (ratio >= 0.45) {
      await s
        .from("tasks")
        .update({
          is_active: false,
          status: "paused",
        } as never)
        .eq("id", opts.taskId);
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(
          `⏸️ <b>Campaign auto-paused</b>\nTask <code>${opts.taskId.slice(0, 8)}</code>\nReject rate ${(ratio * 100).toFixed(0)}% (${rejected}/${samples} in 24h)`,
        );
      } catch {
        /* soft */
      }
      return { paused: true, reason: `reject_rate_${(ratio * 100).toFixed(0)}` };
    }
    return { paused: false };
  } catch {
    return { paused: false };
  }
}

/** 6 · Advertiser analytics for a user. */
export const getMyAdvertiserAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await adminClient();
    const { data: tasks } = await s
      .from("tasks")
      .select("id, title, reward, slots_total, slots_left, is_active, status, budget, created_at")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);

    const taskIds = (tasks ?? []).map((t) => t.id);
    let submissions: { task_id: string; status: string; created_at: string }[] = [];
    if (taskIds.length) {
      const { data: subs } = await s
        .from("submissions")
        .select("task_id, status, created_at")
        .in("task_id", taskIds)
        .limit(500);
      submissions = (subs ?? []) as typeof submissions;
    }

    const byTask = (tasks ?? []).map((t) => {
      const mine = submissions.filter((x) => x.task_id === t.id);
      const starts = mine.length;
      const verified = mine.filter((x) =>
        ["verified", "approved", "auto_approved"].includes(x.status),
      ).length;
      const rejected = mine.filter((x) => x.status === "rejected").length;
      const pending = mine.filter((x) => x.status === "pending").length;
      const reward = Number(t.reward ?? 0);
      const spent = verified * reward;
      const slotsTotal = Number(t.slots_total ?? 0);
      const slotsLeft = Number(t.slots_left ?? 0);
      return {
        id: t.id,
        title: String(t.title ?? ""),
        active: Boolean(t.is_active),
        status: String(t.status ?? ""),
        reward,
        starts,
        completions: verified,
        rejected,
        pending,
        completionRate: starts > 0 ? verified / starts : 0,
        spent,
        remainingBudget: Math.max(0, slotsLeft * reward),
        slotsLeft,
        slotsTotal,
        costPerCompletion: verified > 0 ? spent / verified : reward,
      };
    });

    return {
      campaigns: byTask,
      totals: {
        campaigns: byTask.length,
        active: byTask.filter((c) => c.active).length,
        completions: byTask.reduce((s, c) => s + c.completions, 0),
        spent: byTask.reduce((s, c) => s + c.spent, 0),
        rejected: byTask.reduce((s, c) => s + c.rejected, 0),
      },
    };
  });

/** 7 · Smart task feed — rank by reward, slots, success, platform fit. */
export const listSmartTasks = createServerFn({ method: "GET" })
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

    const ranked = (tasks ?? [])
      .filter((t) => !done.has(t.id))
      .map((t) => {
        const reward = Number(t.reward ?? 0);
        const slotsLeft = Number(t.slots_left ?? 0);
        const slotsTotal = Math.max(1, Number(t.slots_total ?? slotsLeft));
        const fill = 1 - slotsLeft / slotsTotal;
        // Prefer higher reward, fresher, more remaining slots, higher trust users get premium tasks
        let score = reward * 10 + Math.min(slotsLeft, 50) * 0.2 - fill * 5;
        if (trust >= 80 && reward >= 0.05) score += 5;
        if (String(t.proof ?? "") === "auto") score += 2;
        return { ...t, _rank: score };
      })
      .sort((a, b) => b._rank - a._rank)
      .slice(0, 40)
      .map(({ _rank, ...rest }) => rest);

    const availableRewards = ranked.reduce((s, t) => s + Number(t.reward ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const newToday = ranked.filter((t) => String(t.created_at ?? "").startsWith(today)).length;

    return {
      tasks: ranked,
      meta: {
        available: ranked.length,
        availableRewardsUsd: Math.round(availableRewards * 100) / 100,
        newToday,
      },
    };
  });

/** 8 · Worker reputation snapshot. */
export async function getWorkerReputation(userId: string): Promise<{
  trust: number;
  approved: number;
  rejected: number;
  reputation: number;
}> {
  try {
    const s = await adminClient();
    const { data: p } = await s
      .from("profiles")
      .select("trust_score, approved_count, rejected_count")
      .eq("id", userId)
      .maybeSingle();
    const trust = Number((p as { trust_score?: number } | null)?.trust_score ?? 70);
    const approved = Number((p as { approved_count?: number } | null)?.approved_count ?? 0);
    const rejected = Number((p as { rejected_count?: number } | null)?.rejected_count ?? 0);
    const total = approved + rejected;
    const quality = total > 0 ? approved / total : 0.7;
    const reputation = Math.round(trust * 0.6 + quality * 100 * 0.4);
    return { trust, approved, rejected, reputation };
  } catch {
    return { trust: 70, approved: 0, rejected: 0, reputation: 70 };
  }
}

export const getMyReputation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getWorkerReputation(context.userId));

/** Public availability strip for home. */
export const getTaskAvailabilityStrip = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const s = await adminClient();
    const { data: tasks } = await s
      .from("tasks")
      .select("id, reward, created_at, slots_left")
      .eq("is_active", true)
      .gt("slots_left", 0)
      .limit(200);
    const available = (tasks ?? []).length;
    const availableRewardsUsd = (tasks ?? []).reduce((sum, t) => sum + Number(t.reward ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const newToday = (tasks ?? []).filter((t) => String(t.created_at ?? "").startsWith(today)).length;
    return {
      available,
      availableRewardsUsd: Math.round(availableRewardsUsd * 100) / 100,
      newToday,
    };
  } catch {
    return { available: 0, availableRewardsUsd: 0, newToday: 0 };
  }
});
