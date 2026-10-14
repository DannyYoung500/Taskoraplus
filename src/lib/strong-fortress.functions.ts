/**
 * Strong Fortress - next-tier anti-fraud for TASKORA.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_DAILY_EARN_CAP_USD = 25;
const IMPOSSIBLE_VERIFIES_PER_HOUR = 12;
const REJECT_SPIKE_RATIO = 0.75;
const REJECT_SPIKE_MIN = 20;

async function admin() {
  const { supabaseAdmin } = await import("@/lib/strong-fortress.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const { assertOwner: ao } = await import("@/lib/owner-guard.server");
  await ao(userId);
}

export async function assertDailyEarnCap(opts: {
  userId: string;
  addUsd: number;
  capUsd?: number;
}): Promise<{ used: number; cap: number; ok: boolean }> {
  const cap = Math.max(1, Number(opts.capUsd ?? DEFAULT_DAILY_EARN_CAP_USD));
  const add = Math.max(0, Number(opts.addUsd || 0));
  try {
    const s = await admin();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await s
      .from("transactions")
      .select("amount, kind")
      .eq("user_id", opts.userId)
      .gte("created_at", since)
      .in("kind", ["reward", "bonus", "watch", "mission"]);
    const used = (data ?? []).reduce((sum, r) => sum + Math.max(0, Number(r.amount || 0)), 0);
    if (used + add > cap + 0.0001) {
      throw new Error(
        `Daily earn cap reached ($${used.toFixed(2)} / $${cap.toFixed(2)}). Come back tomorrow.`,
      );
    }
    return { used, cap, ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily earn")) throw e;
    return { used: 0, cap, ok: true };
  }
}

export async function assertImpossibleProgression(opts: {
  userId: string;
}): Promise<void> {
  try {
    const s = await admin();
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data } = await s
      .from("submissions")
      .select("id, task_id, status, created_at")
      .eq("user_id", opts.userId)
      .in("status", ["verified", "approved", "auto_approved", "pending"])
      .gte("created_at", since)
      .limit(40);
    const rows = data ?? [];
    const verifiedish = rows.filter((r) =>
      ["verified", "approved", "auto_approved"].includes(String(r.status)),
    );
    const distinctTasks = new Set(verifiedish.map((r) => String(r.task_id)));
    if (verifiedish.length >= IMPOSSIBLE_VERIFIES_PER_HOUR && distinctTasks.size >= 8) {
      throw new Error(
        "Activity looks automated (too many completions in 1 hour). Slow down and try later.",
      );
    }
    const pending = rows.filter((r) => r.status === "pending");
    if (pending.length >= 15) {
      throw new Error("Too many proofs in review. Wait for existing reviews to finish.");
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("automated") || e.message.includes("Too many")))
      throw e;
  }
}

export async function onSubmissionVerified(opts: {
  submissionId: string;
  userId: string;
  taskId?: string | null;
  campaignId?: string | null;
  rewardUsd?: number;
}): Promise<void> {
  try {
    if (opts.campaignId) {
      const { touchCampaignEscrow } = await import("@/lib/strong-escrow.functions");
      await touchCampaignEscrow({ campaignId: opts.campaignId });
    } else if (opts.taskId) {
      const s = await admin();
      const { data: task } = await s
        .from("tasks")
        .select("campaign_id")
        .eq("id", opts.taskId)
        .maybeSingle();
      const cid = (task as { campaign_id?: string } | null)?.campaign_id;
      if (cid) {
        const { touchCampaignEscrow } = await import("@/lib/strong-escrow.functions");
        await touchCampaignEscrow({ campaignId: cid });
      }
    }
  } catch {
    /* soft */
  }

  try {
    if (opts.taskId) {
      await maybeAutoPauseTaskOnRejectSpike(opts.taskId);
    }
  } catch {
    /* soft */
  }

  try {
    if (opts.taskId) {
      const { checkCampaignVelocityCircuit } = await import("@/lib/strong-p6.functions");
      await checkCampaignVelocityCircuit({ taskId: opts.taskId });
    }
  } catch {
    /* soft */
  }
}

export async function maybeAutoPauseTaskOnRejectSpike(taskId: string): Promise<{
  paused: boolean;
  ratio: number;
}> {
  const s = await admin();
  const { data: rows } = await s
    .from("submissions")
    .select("status")
    .eq("task_id", taskId)
    .in("status", ["verified", "approved", "auto_approved", "rejected"])
    .limit(200);
  const list = rows ?? [];
  if (list.length < REJECT_SPIKE_MIN) return { paused: false, ratio: 0 };
  const rejected = list.filter((r) => r.status === "rejected").length;
  const ratio = rejected / list.length;
  if (ratio >= REJECT_SPIKE_RATIO) {
    await s
      .from("tasks")
      .update({ status: "paused", is_active: false } as never)
      .eq("id", taskId)
      .eq("is_active", true);
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(
        `Auto-paused task\nReject spike ${(ratio * 100).toFixed(0)}% (${rejected}/${list.length})\nTask: ${taskId}`,
      );
    } catch {
      /* soft */
    }
    return { paused: true, ratio };
  }
  return { paused: false, ratio };
}

export async function runStrongNightlySuite(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  try {
    const { releaseExpiredCampaignEscrow } = await import("@/lib/strong-escrow.functions");
    out.escrow = await releaseExpiredCampaignEscrow({ holdHours: 36, limit: 40 });
  } catch (e) {
    out.escrow = { error: e instanceof Error ? e.message : "fail" };
  }
  try {
    const { runStuckTaskSla } = await import("@/lib/strong-plus.server");
    out.stuckTasks = await runStuckTaskSla({ hours: 48, autoPause: true });
  } catch (e) {
    out.stuckTasks = { error: e instanceof Error ? e.message : "fail" };
  }
  try {
    const { applyPassiveTrustDecay } = await import("@/lib/strong-escrow.functions");
    if (typeof applyPassiveTrustDecay === "function") {
      out.trustDecay = await applyPassiveTrustDecay({ limit: 100 });
    }
  } catch (e) {
    out.trustDecay = { error: e instanceof Error ? e.message : "fail" };
  }
  try {
    const { alertStuckWithdrawals } = await import("@/lib/strong-wave.functions");
    out.stuckWd = await alertStuckWithdrawals();
  } catch (e) {
    out.stuckWd = { error: e instanceof Error ? e.message : "fail" };
  }
  try {
    const { runMembershipRecheckInternal } = await import(
      "@/lib/strong-membership-recheck.functions"
    );
    out.membership = await runMembershipRecheckInternal({
      minAgeHours: 20,
      maxAgeHours: 72,
      limit: 80,
    });
  } catch (e) {
    out.membership = { error: e instanceof Error ? e.message : "fail" };
  }
  try {
    const { runP7NightlySuite } = await import("@/lib/strong-p7.functions");
    out.p7 = await runP7NightlySuite();
  } catch (e) {
    out.p7 = { error: e instanceof Error ? e.message : "fail" };
  }
  return out;
}

export const ownerRunStrongNightly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return runStrongNightlySuite();
  });

export const ownerRunMembershipRecheckAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { minAgeHours?: number; maxAgeHours?: number; limit?: number }) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const { ownerRunMembershipRecheck } = await import(
      "@/lib/strong-membership-recheck.functions"
    );
    return ownerRunMembershipRecheck({ data: data as never });
  });

export async function assertFortressBeforeSubmit(opts: {
  userId: string;
  rewardUsd?: number;
  taskId?: string | null;
}): Promise<void> {
  await assertImpossibleProgression({ userId: opts.userId });
  if (opts.rewardUsd && opts.rewardUsd > 0) {
    await assertDailyEarnCap({ userId: opts.userId, addUsd: opts.rewardUsd });
  }
  if (opts.taskId) {
    try {
      const { assertTaskCooldownGraph } = await import("@/lib/strong-p7.functions");
      await assertTaskCooldownGraph({ userId: opts.userId, taskId: opts.taskId });
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("Cooldown") || e.message.includes("device has completed"))
      )
        throw e;
    }
  }
}
