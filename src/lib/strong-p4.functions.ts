/**
 * Strong P4 — production anti-fraud / ops layer for TASKORA
 * - Shared wallet cluster soft-hold (3+ accounts same payout address)
 * - Campaign hard budget stop (pause when pending + paid ≥ budget)
 * - IP velocity on signup
 * - Screenshot / proof size sanity
 * - Referral unlock audit + clawback helper
 * - Advertiser reputation score
 * Soft-fail friendly where schema columns may be missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
async function assertOwner(userId: string) {
  const { assertOwner: ao } = await import("@/lib/owner-guard-impl");
  await ao(userId);
}

const WALLET_CLUSTER_SOFT = 2;
const WALLET_CLUSTER_HARD = 3;
const WALLET_CLUSTER_MAX_FIRST_WD = 5;
const IP_SIGNUP_MAX_24H = 5;
const PROOF_URL_MIN_LEN = 12;
const PROOF_URL_MAX_LEN = 2048;
const REFERRAL_MIN_TASKS_FOR_UNLOCK = 3;
const REFERRAL_LOOKBACK_DAYS = 30;

async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

function normalizeAddr(a: string): string {
  return String(a || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** Soft-hold / hard-block when the same payout address is used by multiple accounts. */
export async function assertWalletClusterHold(opts: {
  userId: string;
  address: string;
  amount: number;
  isFirstWithdrawal?: boolean;
}): Promise<{ dualRequired: boolean; clusterSize: number }> {
  const addr = normalizeAddr(opts.address);
  if (!addr || addr.length < 10) return { dualRequired: false, clusterSize: 1 };
  let clusterSize = 1;
  try {
    const s = await admin();
    const { data: wdRows } = await s
      .from("withdrawals")
      .select("user_id")
      .ilike("address", addr)
      .neq("status", "rejected")
      .limit(50);
    const ids = new Set<string>([opts.userId]);
    for (const r of wdRows ?? []) {
      const uid = String((r as { user_id?: string }).user_id || "");
      if (uid) ids.add(uid);
    }
    try {
      const { data: profs } = await s
        .from("profiles")
        .select("id")
        .ilike("payout_address", addr)
        .limit(20);
      for (const p of profs ?? []) {
        const uid = String((p as { id?: string }).id || "");
        if (uid) ids.add(uid);
      }
    } catch {
      /* column may not exist */
    }
    clusterSize = ids.size;
    if (clusterSize >= WALLET_CLUSTER_HARD) {
      throw new Error(
        "This wallet is linked to too many accounts. Contact support before withdrawing.",
      );
    }
    if (clusterSize >= WALLET_CLUSTER_SOFT) {
      if (opts.isFirstWithdrawal && opts.amount > WALLET_CLUSTER_MAX_FIRST_WD) {
        throw new Error(
          `Shared wallet detected. First withdrawal max is $${WALLET_CLUSTER_MAX_FIRST_WD} until support reviews.`,
        );
      }
      return { dualRequired: true, clusterSize };
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("wallet") || e.message.includes("Shared"))) {
      throw e;
    }
  }
  return { dualRequired: false, clusterSize };
}

/** Hard-stop a task when paid + pending rewards would exceed campaign budget. */
export async function assertCampaignBudgetRemaining(opts: {
  taskId: string;
  rewardUsd: number;
}): Promise<void> {
  const reward = Math.max(0, Number(opts.rewardUsd) || 0);
  if (reward <= 0) return;
  try {
    const s = await admin();
    const { data: task } = await s
      .from("tasks")
      .select("id, budget, slots_left, reward, is_active, campaign_id")
      .eq("id", opts.taskId)
      .maybeSingle();
    if (!task) return;
    const t = task as {
      budget?: number | null;
      slots_left?: number;
      reward?: number;
      is_active?: boolean;
      campaign_id?: string | null;
    };
    if (!t.is_active) throw new Error("This task is no longer active.");
    if (Number(t.slots_left ?? 0) <= 0) throw new Error("All slots for this task are taken.");

    const budget = Number(t.budget ?? 0);
    if (budget > 0) {
      const { data: subs } = await s
        .from("submissions")
        .select("status")
        .eq("task_id", opts.taskId)
        .in("status", ["pending", "verified", "approved", "auto_approved"] as never)
        .limit(500);
      const count = (subs ?? []).length;
      const committed = count * Number(t.reward ?? reward);
      if (committed + reward > budget + 0.001) {
        try {
          await s
            .from("tasks")
            .update({ is_active: false, status: "budget_exhausted" } as never)
            .eq("id", opts.taskId);
        } catch {
          /* soft */
        }
        throw new Error("Campaign budget exhausted. Task paused.");
      }
    }

    if (t.campaign_id) {
      try {
        const { data: camp } = await s
          .from("campaigns")
          .select("budget, amount_spent, status")
          .eq("id", t.campaign_id)
          .maybeSingle();
        const c = camp as {
          budget?: number;
          amount_spent?: number;
          status?: string;
        } | null;
        if (c && Number(c.budget ?? 0) > 0) {
          const spent = Number(c.amount_spent ?? 0);
          if (spent + reward > Number(c.budget) + 0.001) {
            try {
              await s
                .from("tasks")
                .update({ is_active: false, status: "budget_exhausted" } as never)
                .eq("id", opts.taskId);
            } catch {
              /* soft */
            }
            throw new Error("Campaign budget exhausted. Task paused.");
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("budget exhausted")) throw e;
      }
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("budget") ||
        e.message.includes("slots") ||
        e.message.includes("no longer active"))
    ) {
      throw e;
    }
  }
}

/** Cap new account creation per IP hint (24h). Soft-shadow when exceeded. */
export async function assertIpSignupVelocity(opts: {
  ipHint: string | null | undefined;
  userId?: string;
}): Promise<{ ok: boolean; count: number; shadowed: boolean }> {
  const ip = String(opts.ipHint || "").trim();
  if (!ip || ip === "0.0.0.0" || ip === "127.0.0.1") {
    return { ok: true, count: 0, shadowed: false };
  }
  try {
    const s = await admin();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await s
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("last_ip_hint", ip)
      .gte("created_at", since);
    const n = count ?? 0;
    if (n >= IP_SIGNUP_MAX_24H) {
      if (opts.userId) {
        try {
          await s
            .from("profiles")
            .update({
              status: "review",
              review_note: `IP velocity: ${n} accounts on ${ip} in 24h`,
            } as never)
            .eq("id", opts.userId);
        } catch {
          /* soft */
        }
      }
      return { ok: false, count: n, shadowed: true };
    }
    return { ok: true, count: n, shadowed: false };
  } catch {
    return { ok: true, count: 0, shadowed: false };
  }
}

/** Reject obviously bad proof URLs. */
export async function assertProofSanity(opts: {
  proofUrl?: string | null;
  proofText?: string | null;
}): Promise<void> {
  const url = String(opts.proofUrl || "").trim();
  const text = String(opts.proofText || "").trim();
  if (!url && !text) return;
  if (url) {
    if (url.length < PROOF_URL_MIN_LEN) {
      throw new Error("Proof link is too short. Upload a real screenshot.");
    }
    if (url.length > PROOF_URL_MAX_LEN) {
      throw new Error("Proof link is too long.");
    }
    if (/^data:image\/[^;]+;base64,/i.test(url) && url.length < 500) {
      throw new Error("Screenshot looks incomplete. Re-upload a full image.");
    }
    if (/placeholder|example\.com|test\.png|dummy/i.test(url)) {
      throw new Error("Invalid proof URL. Use a real screenshot upload.");
    }
  }
  if (text && !url && text.length < 4 && !text.startsWith("auto:")) {
    throw new Error("Proof text is too short.");
  }
}

/** Referral unlock audit. */
export async function auditReferralUnlock(opts: {
  userId: string;
  clawback?: boolean;
}): Promise<{
  referredBy: string | null;
  completedTasks: number;
  ok: boolean;
  clawed: boolean;
}> {
  const out = {
    referredBy: null as string | null,
    completedTasks: 0,
    ok: true,
    clawed: false,
  };
  try {
    const s = await admin();
    const { data: profile } = await s
      .from("profiles")
      .select("referred_by, created_at")
      .eq("id", opts.userId)
      .maybeSingle();
    const ref = String(
      (profile as { referred_by?: string | null } | null)?.referred_by || "",
    ).trim();
    if (!ref) return out;
    out.referredBy = ref;

    const since = new Date(
      Date.now() - REFERRAL_LOOKBACK_DAYS * 24 * 3600_000,
    ).toISOString();
    const { count } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .in("status", ["verified", "approved", "auto_approved"] as never)
      .gte("created_at", since);
    out.completedTasks = count ?? 0;
    out.ok = out.completedTasks >= REFERRAL_MIN_TASKS_FOR_UNLOCK;

    if (!out.ok && opts.clawback) {
      try {
        const label = `Referral clawback — inactive referee ${opts.userId.slice(0, 8)}`;
        const { data: existing } = await s
          .from("transactions")
          .select("id")
          .eq("user_id", ref)
          .eq("label", label)
          .maybeSingle();
        if (!existing) {
          await s.from("transactions").insert({
            user_id: ref,
            label,
            amount: -0.1,
            kind: "adjustment",
          } as never);
          out.clawed = true;
        }
      } catch {
        /* soft */
      }
    }
  } catch {
    /* soft */
  }
  return out;
}

/** Advertiser reputation 0–100. */
export async function getAdvertiserReputation(opts: {
  advertiser: string;
}): Promise<{
  score: number;
  verified: number;
  rejected: number;
  clawbacks: number;
  flags: string[];
}> {
  const adv = String(opts.advertiser || "").trim();
  const out = {
    score: 70,
    verified: 0,
    rejected: 0,
    clawbacks: 0,
    flags: [] as string[],
  };
  if (!adv) return out;
  try {
    const s = await admin();
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data: tasks } = await s
      .from("tasks")
      .select("id")
      .ilike("advertiser", adv)
      .limit(50);
    const taskIds = (tasks ?? []).map((t) => String((t as { id: string }).id));
    if (taskIds.length === 0) return out;

    const { data: subs } = await s
      .from("submissions")
      .select("status")
      .in("task_id", taskIds)
      .gte("created_at", since)
      .limit(500);
    for (const row of subs ?? []) {
      const st = String((row as { status?: string }).status || "");
      if (["verified", "approved", "auto_approved"].includes(st)) out.verified += 1;
      if (st === "rejected") out.rejected += 1;
    }

    try {
      const { count } = await s
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "membership_clawback")
        .gte("created_at", since)
        .limit(1);
      out.clawbacks = count ?? 0;
    } catch {
      /* soft */
    }

    const total = out.verified + out.rejected;
    let score = 70;
    if (total > 0) {
      const rejectRate = out.rejected / total;
      score = Math.round(100 - rejectRate * 80 - Math.min(out.clawbacks, 10) * 3);
    }
    score = Math.max(0, Math.min(100, score));
    out.score = score;
    if (score < 40) out.flags.push("low_reputation");
    if (out.rejected >= 10 && out.rejected > out.verified) out.flags.push("high_reject_rate");
    if (out.clawbacks >= 5) out.flags.push("clawback_heavy");
  } catch {
    /* soft */
  }
  return out;
}

export const ownerRunReferralAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clawback?: boolean; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const s = await admin();
    const limit = Math.min(100, Math.max(10, Number(data.limit ?? 40)));
    const since = new Date(
      Date.now() - REFERRAL_LOOKBACK_DAYS * 24 * 3600_000,
    ).toISOString();
    const { data: refs } = await s
      .from("profiles")
      .select("id, referred_by")
      .not("referred_by", "is", null)
      .gte("created_at", since)
      .limit(limit);
    let checked = 0;
    let failed = 0;
    let clawed = 0;
    for (const r of refs ?? []) {
      const uid = String((r as { id: string }).id);
      const res = await auditReferralUnlock({
        userId: uid,
        clawback: Boolean(data.clawback),
      });
      checked += 1;
      if (!res.ok) failed += 1;
      if (res.clawed) clawed += 1;
    }
    return { checked, failed, clawed };
  });

export const ownerGetAdvertiserReputation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { advertiser: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return getAdvertiserReputation({ advertiser: data.advertiser });
  });

/** Bulk approve with risk filter. */
export const ownerBulkApproveSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      submissionIds?: string[];
      minTrust?: number;
      maxReward?: number;
      skipDeviceCluster?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const s = await admin();
    const minTrust = Math.max(0, Number(data.minTrust ?? 60));
    const maxReward = Number(data.maxReward ?? 0.5);
    const skipCluster = data.skipDeviceCluster !== false;

    let ids = (data.submissionIds ?? []).map(String).filter(Boolean);
    if (ids.length === 0) {
      const { data: pending } = await s
        .from("submissions")
        .select("id")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(30);
      ids = (pending ?? []).map((r) => String((r as { id: string }).id));
    }

    let approved = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const sid of ids.slice(0, 40)) {
      try {
        const { data: sub } = await s
          .from("submissions")
          .select("id, user_id, task_id, status")
          .eq("id", sid)
          .maybeSingle();
        if (!sub || String((sub as { status?: string }).status) !== "pending") {
          skipped += 1;
          continue;
        }
        const userId = String((sub as { user_id: string }).user_id);
        const taskId = String((sub as { task_id: string }).task_id);

        const { data: task } = await s
          .from("tasks")
          .select("reward")
          .eq("id", taskId)
          .maybeSingle();
        const reward = Number((task as { reward?: number } | null)?.reward ?? 0);
        if (reward > maxReward) {
          skipped += 1;
          continue;
        }

        const { getUserRiskSnapshot } = await import("@/lib/strong-p2.functions");
        const risk = await getUserRiskSnapshot(userId);
        if (risk.trust < minTrust) {
          skipped += 1;
          continue;
        }
        if (skipCluster && risk.flags.includes("device_cluster")) {
          skipped += 1;
          continue;
        }
        if (risk.flags.includes("status:banned") || risk.flags.includes("status:frozen")) {
          skipped += 1;
          continue;
        }

        try {
          await assertCampaignBudgetRemaining({ taskId, rewardUsd: reward });
        } catch {
          skipped += 1;
          continue;
        }

        const { error } = await s.rpc("review_task_submission", {
          p_submission_id: sid,
          p_decision: "verified",
          p_reason: `Bulk approve (trust ${risk.trust})`,
        } as never);
        if (error && !/function|does not exist/i.test(error.message)) {
          await s
            .from("submissions")
            .update({
              status: "verified",
              review_note: `Bulk approve (trust ${risk.trust})`,
              reviewed_at: new Date().toISOString(),
              reviewed_by: context.userId,
            } as never)
            .eq("id", sid)
            .eq("status", "pending");
        }
        approved += 1;
        try {
          const { onSubmissionVerified } = await import("@/lib/strong-fortress.functions");
          await onSubmissionVerified({
            submissionId: sid,
            userId,
            taskId,
            rewardUsd: reward,
          });
        } catch {
          /* soft */
        }
      } catch (e) {
        skipped += 1;
        errors.push(e instanceof Error ? e.message : "error");
      }
    }

    return { approved, skipped, errors: errors.slice(0, 5) };
  });
