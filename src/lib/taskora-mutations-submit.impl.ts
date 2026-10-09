import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RULES, hoursSince, normalizeWalletAddress } from "@/lib/platform-rules";

async function getMaintenanceSwitches() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "maintenance_switches").maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      read_only: Boolean(v.read_only),
      withdrawals_paused: Boolean(v.withdrawals_paused),
      deposits_paused: Boolean(v.deposits_paused),
      task_creation_paused: Boolean(v.task_creation_paused),
      verification_paused: Boolean(v.verification_paused),
    };
  } catch {
    return { read_only: false, withdrawals_paused: false, deposits_paused: false, task_creation_paused: false, verification_paused: false };
  }
}

export const submitTaskGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; proofText?: string | undefined; proofUrl?: string | undefined; startedAtIso?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    try {
      const { assertActionRateLimit } = await import("@/lib/strong-ops");
      await assertActionRateLimit({ userId, kind: "submit" });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Too many")) throw e;
    }
    try {
      const { assertVelocityBurstOk } = await import("@/lib/strong-velocity.functions");
      await assertVelocityBurstOk({ userId, kind: "submit" });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Too many")) throw e;
    }
    try {
      const { assertNotImpossibleProgression } = await import("@/lib/strong-tier-b.functions");
      await assertNotImpossibleProgression({ userId });
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Too many") || e.message.includes("New accounts"))) throw e;
    }
    const maint = await getMaintenanceSwitches();
    if (maint.read_only) throw new Error("Platform is in read-only mode. Try again later.");
    if (maint.task_creation_paused) throw new Error("New task submissions are temporarily paused by the owner.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - RULES.submissionWindowMs).toISOString();
    const { count } = await supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if ((count ?? 0) >= RULES.maxSubmissionsPerHour) {
      try {
        const { notifyOwnersVelocityAlert } = await import("@/lib/notify-owner");
        await notifyOwnersVelocityAlert({ userId, kind: "submissions", count: count ?? 0, limit: RULES.maxSubmissionsPerHour });
      } catch { /* soft */ }
      throw new Error(`Rate limit: max ${RULES.maxSubmissionsPerHour} submissions per hour.`);
    }
    const { data: task } = await supabaseAdmin.from("tasks").select("*").eq("id", data.taskId).eq("is_active", true).maybeSingle();
    if (!task) throw new Error("This task is no longer available.");
    if (task.created_by && String(task.created_by) === String(userId)) {
      throw new Error("You cannot complete your own task.");
    }
    if (task.slots_left <= 0) throw new Error("All slots for this task are taken.");
    const { data: existing } = await supabaseAdmin.from("submissions").select("id").eq("user_id", userId).eq("task_id", data.taskId).maybeSingle();
    if (existing) throw new Error("You already submitted this task.");

    try {
      const {
        assertConnectedAccountForPlatform,
        assertPlatformDailyCompletionCap,
        assertEarnerQuality,
        assertPlatformSubmitCooldown,
      } = await import("@/lib/strong-ops");
      const platform = String((task as { platform?: string }).platform ?? "");
      await assertConnectedAccountForPlatform({ userId, platform });
      await assertPlatformDailyCompletionCap({ userId, platform });
      await assertEarnerQuality({ userId });
      await assertPlatformSubmitCooldown({ userId, platform });
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Connect your") || e.message.includes("Daily limit") || e.message.includes("Quality hold") || e.message.includes("Wait "))) throw e;
    }

    try {
      const { assertTaskDwellTime } = await import("@/lib/strong-score.functions");
      await assertTaskDwellTime({
        startedAtIso: data.startedAtIso,
        platform: String((task as { platform?: string }).platform ?? ""),
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("seconds on this task")) throw e;
    }

    const proofText = (data.proofText ?? "").trim();
    const proofUrl = (data.proofUrl ?? "").trim();
    const metadata = ((task as { task_metadata?: unknown }).task_metadata ?? {}) as Record<string, unknown>;
    const verificationMethods = Array.isArray(metadata.verification_methods) ? metadata.verification_methods.map(String) : [];
    const automaticSelected =
      verificationMethods.includes("automatic") ||
      (String((task as { proof?: string }).proof ?? "").toLowerCase() === "auto" &&
        ["telegram", "discord"].includes(String(task.platform).toLowerCase()));
    let autoVerified = false;
    if (automaticSelected) {
      const { verifyAutomaticTask } = await import("@/lib/automatic-verification.functions");
      const result = await verifyAutomaticTask(userId, task);
      if (!result.ok) throw new Error(result.reason || "Automatic verification could not confirm this task. The task remains unverified.");
      autoVerified = true;
    } else if (!proofText && !proofUrl) {
      throw new Error("Add the proof required by this campaign.");
    }

    let proofHash: string | null = null;

    try {
      const { assertRejectSoftBan } = await import("@/lib/strong-more.functions");
      await assertRejectSoftBan({ userId });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Quality hold")) throw e;
    }

    try {
      const { assertProofNotRecycled, flagProofForReviewQueue } = await import("@/lib/strong-ops");
      const r = await assertProofNotRecycled({ proofText, proofUrl, userId });
      proofHash = r.proofHash;
      await flagProofForReviewQueue({ userId, submissionHint: data.taskId, proofText, proofUrl, proofHash });
    } catch (e) {
      if (e instanceof Error && e.message.toLowerCase().includes("proof")) throw e;
    }

    try {
      const { assertProofPerceptualUnique } = await import("@/lib/strong-next.functions");
      await assertProofPerceptualUnique({ userId, proofText, proofUrl });
    } catch (e) {
      if (e instanceof Error && e.message.includes("recycled")) throw e;
    }

    const { data: submissionId, error: claimError } = await supabaseAdmin.rpc(
      "claim_task_submission",
      {
        p_user_id: userId,
        p_task_id: task.id,
        p_proof_text: proofText || null,
        p_proof_url: proofUrl || null,
        p_proof_hash: proofHash || null,
      } as never,
    );
    if (claimError) {
      throw new Error(claimError.message);
    }
    if (autoVerified) {
      const { data: verificationResult, error: verificationError } = await supabaseAdmin.rpc("review_task_submission", {
        p_submission_id: String(submissionId),
        p_decision: "verified",
        p_reason: "Automatic verification confirmed the required platform action.",
      } as never);
      if (verificationError) throw new Error(verificationError.message);
      try {
        const { applyTrustOutcome } = await import("@/lib/strong-escrow.functions");
        await applyTrustOutcome({ userId, outcome: "approved" });
      } catch { /* soft */ }
      return { status: "verified" as const, autoVerified: true, submissionId: String(submissionId), verification: verificationResult };
    }
    return { status: "pending" as const, autoVerified: false, submissionId: String(submissionId) };
  });
