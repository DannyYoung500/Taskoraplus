/**
 * Strong P6 - next-tier anti-fraud / ops for TASKORA
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(userId: string) {
  const { assertOwner: ao } = await import("@/lib/owner-guard-impl");
  await ao(userId);
}

async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

export const mintLivenessChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ context, data }) => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    try {
      const s = await admin();
      await s.from("liveness_challenges").upsert({
        user_id: context.userId,
        task_id: data.taskId,
        code_hash: code,
        code_plain: code,
        expires_at: expiresAt,
        consumed: false,
      } as never, { onConflict: "user_id,task_id" } as never);
    } catch { /* soft */ }
    return {
      required: true as const,
      code,
      expiresAt,
      instruction: `Type this code in your proof text: ${code}`,
      ttlSec: 600,
    };
  });

export async function assertLivenessChallenge(opts: {
  userId: string;
  taskId: string;
  proofText?: string | null;
  rewardUsd: number;
  proofMode: string;
}): Promise<void> {
  const mode = String(opts.proofMode || "").toLowerCase();
  if (mode === "auto" || mode === "automatic" || mode === "membership") return;
  if (Number(opts.rewardUsd) < 0.2) return;
  const text = String(opts.proofText || "").toUpperCase();
  try {
    const s = await admin();
    const { data: row } = await s
      .from("liveness_challenges")
      .select("code_plain, expires_at, consumed")
      .eq("user_id", opts.userId)
      .eq("task_id", opts.taskId)
      .maybeSingle();
    if (!row) return;
    const r = row as { code_plain?: string; expires_at?: string; consumed?: boolean };
    if (r.consumed) throw new Error("Liveness challenge already used. Re-open the task for a new code.");
    if (r.expires_at && r.expires_at < new Date().toISOString()) {
      throw new Error("Liveness challenge expired. Re-open the task and get a new code.");
    }
    const expected = String(r.code_plain || "").toUpperCase();
    if (expected && !text.includes(expected)) {
      throw new Error(`Include the live code ${expected} in your proof text (or visible in the screenshot).`);
    }
    try {
      await s.from("liveness_challenges").update({ consumed: true, consumed_at: new Date().toISOString() } as never)
        .eq("user_id", opts.userId).eq("task_id", opts.taskId);
    } catch { /* soft */ }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("Liveness") || e.message.includes("live code") || e.message.includes("Include"))) throw e;
  }
}

export async function getDeviceAttestationScore(opts: { userId: string }) {
  let score = 70;
  const factors: string[] = [];
  try {
    const s = await admin();
    const { data: profile } = await s.from("profiles").select("created_at, device_fp, trust_score, status").eq("id", opts.userId).maybeSingle();
    const p = profile as { created_at?: string; device_fp?: string; trust_score?: number; status?: string } | null;
    if (!p) return { score: 50, factors: ["no_profile"], dualSuggested: true, holdSuggested: false };
    if (String(p.status || "active") !== "active") { score -= 30; factors.push("status_not_active"); }
    const trust = Number(p.trust_score ?? 50);
    if (trust >= 80) { score += 15; factors.push("high_trust"); }
    else if (trust < 40) { score -= 20; factors.push("low_trust"); }
    if (p.created_at) {
      const ageH = (Date.now() - new Date(p.created_at).getTime()) / 3600_000;
      if (ageH < 24) { score -= 25; factors.push("account_lt_24h"); }
      else if (ageH > 720) { score += 10; factors.push("account_mature"); }
    }
    if (p.device_fp) {
      const { count } = await s.from("profiles").select("id", { count: "exact", head: true }).eq("device_fp", p.device_fp).neq("id", opts.userId);
      if ((count ?? 0) >= 2) { score -= 25; factors.push("device_cluster"); }
      else { score += 5; factors.push("unique_device"); }
    } else { score -= 8; factors.push("missing_device_fp"); }
  } catch { factors.push("score_error"); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, factors, dualSuggested: score < 40, holdSuggested: score < 25 };
}

export async function assertDeviceScoreForWithdraw(opts: { userId: string }) {
  const r = await getDeviceAttestationScore({ userId: opts.userId });
  if (r.holdSuggested) {
    throw new Error("This device needs a short security review before withdrawals. Keep earning - contact support if this persists.");
  }
  return { score: r.score, dualRequired: r.dualSuggested };
}

export async function computeEscrowReleaseLadder(opts: { campaignId: string }) {
  return {
    totalBudget: 0,
    releasedUsd: 0,
    holdUsd: 0,
    stages: [
      { stage: 1, label: "fill", fraction: 0.3, unlocked: false, amount: 0 },
      { stage: 2, label: "leave_check_48h", fraction: 0.4, unlocked: false, amount: 0 },
      { stage: 3, label: "reject_ok_7d", fraction: 0.3, unlocked: false, amount: 0 },
    ],
  };
}

export const ownerGetEscrowLadder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return computeEscrowReleaseLadder({ campaignId: data.campaignId });
  });

export async function assertDestinationFingerprint(opts: { userId: string; address: string }) {
  const addr = String(opts.address || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!addr || addr.length < 10) return { clusterSize: 1, dualRequired: false };
  let clusterSize = 1;
  try {
    const s = await admin();
    const { data: rows } = await s.from("withdrawals").select("user_id").ilike("address", addr).neq("status", "rejected").limit(40);
    const users = new Set<string>([opts.userId]);
    for (const r of rows ?? []) {
      const uid = String((r as { user_id?: string }).user_id || "");
      if (uid) users.add(uid);
    }
    clusterSize = users.size;
    if (clusterSize >= 3) {
      throw new Error("This wallet address is linked to too many accounts. Use a personal address you control.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("linked to too many")) throw e;
  }
  return { clusterSize, dualRequired: clusterSize >= 2 };
}

/** Velocity: only hard-pause at extreme rates (default 40+/h). Soft flag at 15+/h. */
export async function checkCampaignVelocityCircuit(opts: {
  taskId: string;
  platform?: string;
  hardPauseThreshold?: number;
}) {
  const s = await admin();
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  let rate = 0;
  let median = 0;
  let paused = false;
  const hard = Math.max(40, Number(opts.hardPauseThreshold ?? 40));
  try {
    const { count } = await s.from("submissions").select("id", { count: "exact", head: true })
      .eq("task_id", opts.taskId).in("status", ["verified", "approved", "auto_approved"] as never).gte("created_at", since);
    rate = count ?? 0;
    if (rate >= hard) {
      await s.from("tasks").update({
        is_active: false,
        status: "paused",
        review_note: `Velocity circuit: ${rate}/h (threshold ${hard})`,
      } as never).eq("id", opts.taskId);
      paused = true;
    } else if (rate >= 15) {
      try {
        await s.from("tasks").update({ review_note: `Velocity watch: ${rate}/h` } as never).eq("id", opts.taskId);
      } catch { /* soft */ }
    }
  } catch { /* soft */ }
  return { paused, rate, median, hard };
}

/** Owner: re-enable tasks paused by velocity / reject-spike / status paused. */
export async function reactivatePausedTasks(opts?: { limit?: number; onlyVelocity?: boolean }) {
  const s = await admin();
  const limit = Math.min(200, Math.max(1, Number(opts?.limit ?? 100)));
  const { data: rows } = await s.from("tasks").select("id, review_note, status, is_active").eq("is_active", false).limit(limit);
  let reactivated = 0;
  for (const row of rows ?? []) {
    const r = row as { id: string; review_note?: string | null; status?: string };
    const note = String(r.review_note || "");
    if (opts?.onlyVelocity && !note.toLowerCase().includes("velocity") && String(r.status) !== "paused") {
      continue;
    }
    try {
      await s.from("tasks").update({
        is_active: true,
        status: "active",
        review_note: note ? `${note} · reactivated` : "reactivated",
      } as never).eq("id", r.id);
      reactivated += 1;
    } catch { /* soft */ }
  }
  return { scanned: (rows ?? []).length, reactivated };
}

export const ownerReactivatePausedTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { onlyVelocity?: boolean }) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return reactivatePausedTasks({
      onlyVelocity: Boolean((data as { onlyVelocity?: boolean })?.onlyVelocity),
      limit: 150,
    });
  });

export const ownerRunVelocityCircuits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const s = await admin();
    const { data: tasks } = await s.from("tasks").select("id, platform").eq("is_active", true).limit(40);
    let paused = 0;
    for (const t of tasks ?? []) {
      const r = await checkCampaignVelocityCircuit({
        taskId: String((t as { id: string }).id),
        platform: String((t as { platform?: string }).platform || ""),
      });
      if (r.paused) paused += 1;
    }
    return { checked: (tasks ?? []).length, paused };
  });

export async function rankTasksByTrustTier<T extends { reward?: number | null; proof?: string | null }>(opts: {
  userId: string;
  tasks: T[];
}): Promise<T[]> {
  if (!opts.tasks.length) return opts.tasks;
  let trust = 50;
  try {
    const s = await admin();
    const { data: profile } = await s.from("profiles").select("trust_score").eq("id", opts.userId).maybeSingle();
    trust = Number((profile as { trust_score?: number } | null)?.trust_score ?? 50);
  } catch { /* soft */ }
  const isAuto = (t: T) => {
    const p = String(t.proof || "").toLowerCase();
    return p === "auto" || p === "automatic" || p === "membership";
  };
  return [...opts.tasks].sort((a, b) => {
    const ra = Number(a.reward ?? 0);
    const rb = Number(b.reward ?? 0);
    if (trust >= 75) return rb - ra;
    if (trust < 40) {
      const aa = isAuto(a) ? 1 : 0;
      const ab = isAuto(b) ? 1 : 0;
      if (ab !== aa) return ab - aa;
      return ra - rb;
    }
    const aa = isAuto(a) ? 1 : 0;
    const ab = isAuto(b) ? 1 : 0;
    if (ab !== aa) return ab - aa;
    return rb - ra;
  });
}

export async function enforceProofUploadToken(opts: {
  userId: string;
  proofMode: string;
  token?: string | null;
}): Promise<void> {
  const mode = String(opts.proofMode || "").toLowerCase();
  if (mode === "auto" || mode === "automatic" || mode === "membership") return;
  if (mode !== "screenshot" && mode !== "manual" && mode !== "image") return;
  const token = String(opts.token || "").trim();
  if (!token) return;
  try {
    const { assertProofUploadToken } = await import("@/lib/strong-p5.functions");
    await assertProofUploadToken({ userId: opts.userId, token });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Proof upload")) throw e;
  }
}

export const ownerGetSlaSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const s = await admin();
    const since7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
    let pendingReviews = 0;
    let pendingWithdrawals = 0;
    let verified24h = 0;
    let rejected24h = 0;
    try {
      const { count } = await s.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingReviews = count ?? 0;
    } catch { /* soft */ }
    try {
      const { count } = await s.from("withdrawals").select("id", { count: "exact", head: true }).in("status", ["pending", "processing", "needs_dual"] as never);
      pendingWithdrawals = count ?? 0;
    } catch { /* soft */ }
    try {
      const { count: v } = await s.from("submissions").select("id", { count: "exact", head: true }).in("status", ["verified", "approved", "auto_approved"] as never).gte("created_at", since24);
      const { count: r } = await s.from("submissions").select("id", { count: "exact", head: true }).eq("status", "rejected").gte("created_at", since24);
      verified24h = v ?? 0;
      rejected24h = r ?? 0;
    } catch { /* soft */ }
    return {
      pendingReviews,
      medianReviewHours: null as number | null,
      pendingWithdrawals,
      medianPayHours: null as number | null,
      leaveRate7d: null as number | null,
      verified24h,
      rejected24h,
      since7,
    };
  });

export const ownerGetDeviceScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return getDeviceAttestationScore({ userId: data.userId });
  });
