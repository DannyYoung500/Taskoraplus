import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RULES } from "@/lib/platform-rules";

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

function asUuid(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of ["id", "taskId", "task_id", "submission_id", "submissionId", "claim_task_submission"]) {
      const v = o[k];
      if (typeof v === "string" && v.length >= 8) return v.trim();
    }
    const vals = Object.values(o);
    if (vals.length === 1 && typeof vals[0] === "string") return String(vals[0]).trim();
  }
  return "";
}

export const submitTaskGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId?: string; proofText?: string; proofUrl?: string; startedAtIso?: string; data?: unknown; proofUploadToken?: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const nested = (data as { data?: { taskId?: string; proofText?: string; proofUrl?: string; startedAtIso?: string; proofUploadToken?: string } })?.data;
    const taskId = asUuid(data.taskId ?? nested?.taskId);
    const proofText = String(data.proofText ?? nested?.proofText ?? "").trim();
    const proofUrl = String(data.proofUrl ?? nested?.proofUrl ?? "").trim();
    const startedAtIso = data.startedAtIso ?? nested?.startedAtIso;
    const proofUploadToken = String((data as { proofUploadToken?: string }).proofUploadToken ?? nested?.proofUploadToken ?? "").trim();

    if (!taskId || taskId.length < 8) throw new Error("Invalid task. Go back and open the task again.");

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

    const maint = await getMaintenanceSwitches();
    if (maint.read_only) throw new Error("Platform is in read-only mode. Try again later.");
    if (maint.task_creation_paused) throw new Error("New task submissions are temporarily paused by the owner.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - RULES.submissionWindowMs).toISOString();
    const { count } = await supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if ((count ?? 0) >= RULES.maxSubmissionsPerHour) {
      throw new Error(`Rate limit: max ${RULES.maxSubmissionsPerHour} submissions per hour.`);
    }

    const { data: task } = await supabaseAdmin.from("tasks").select("*").eq("id", taskId).eq("is_active", true).maybeSingle();
    if (!task) throw new Error("This task is no longer available.");
    if (task.created_by && String(task.created_by) === String(userId)) throw new Error("You cannot complete your own task.");
    if (Number(task.slots_left) <= 0) throw new Error("All slots for this task are taken.");

    const { data: existing } = await supabaseAdmin.from("submissions").select("id").eq("user_id", userId).eq("task_id", taskId).maybeSingle();
    if (existing) throw new Error("You already submitted this task.");

    try {
      const { assertFortressBeforeSubmit } = await import("@/lib/strong-fortress.functions");
      await assertFortressBeforeSubmit({
        userId,
        rewardUsd: Number((task as { reward?: number }).reward ?? 0),
        taskId,
      });
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("Daily earn") ||
          e.message.includes("automated") ||
          e.message.includes("Too many") ||
          e.message.includes("Cooldown") ||
          e.message.includes("device has completed"))
      )
        throw e;
    }

    try {
      const { assertAdvertiserDailyCap } = await import("@/lib/strong-p2.functions");
      await assertAdvertiserDailyCap({
        advertiser: String((task as { advertiser?: string }).advertiser || ""),
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("completion cap")) throw e;
    }

    try {
      const { assertVerifyRateLimit } = await import("@/lib/strong-p3.functions");
      await assertVerifyRateLimit({ userId });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Too many submissions")) throw e;
    }

    const platform = String((task as { platform?: string }).platform ?? "").toLowerCase();
    try {
      const { assertConnectedAccountForPlatform, assertPlatformDailyCompletionCap, assertEarnerQuality, assertPlatformSubmitCooldown } = await import("@/lib/strong-ops");
      if (platform !== "telegram") {
        await assertConnectedAccountForPlatform({ userId, platform });
      }
      await assertPlatformDailyCompletionCap({ userId, platform });
      await assertEarnerQuality({ userId });
      await assertPlatformSubmitCooldown({ userId, platform });
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Connect your") || e.message.includes("Daily limit") || e.message.includes("Quality hold") || e.message.includes("Wait "))) throw e;
    }

    try {
      const { assertTaskDwellTime } = await import("@/lib/strong-score.functions");
      await assertTaskDwellTime({ startedAtIso, platform });
    } catch (e) {
      if (e instanceof Error && e.message.includes("seconds on this task")) throw e;
    }

    const proofMode = String((task as { proof?: string }).proof ?? "").toLowerCase();
    const isAutoProof =
      proofMode === "auto" ||
      proofMode === "automatic" ||
      (proofText.startsWith("auto:") && proofMode !== "screenshot" && proofMode !== "manual" && proofMode !== "image");

    let autoVerified = false;
    if (isAutoProof && ["telegram", "discord"].includes(platform)) {
      const { verifyAutomaticTask } = await import("@/lib/automatic-verification.functions");
      const result = await verifyAutomaticTask(userId, task);
      if (!result.ok) {
        throw new Error(result.reason || "Could not confirm membership yet. Open the link, join, then tap Verify again.");
      }
      autoVerified = true;
    } else if (!proofText && !proofUrl) {
      throw new Error("Add the proof required by this campaign.");
    }

    try {
      const { assertProofSanity, assertCampaignBudgetRemaining } = await import("@/lib/strong-p4.functions");
      await assertProofSanity({ proofUrl, proofText, userId, taskId });
      await assertCampaignBudgetRemaining({
        taskId,
        rewardUsd: Number((task as { reward?: number }).reward ?? 0),
      });
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("Proof") ||
          e.message.includes("proof") ||
          e.message.includes("Screenshot") ||
          e.message.includes("budget") ||
          e.message.includes("slots") ||
          e.message.includes("no longer active") ||
          e.message.includes("Liveness") ||
          e.message.includes("live code"))
      ) {
        throw e;
      }
    }

    try {
      const { assertLivenessChallenge } = await import("@/lib/strong-p6.functions");
      await assertLivenessChallenge({
        userId,
        taskId,
        proofText,
        rewardUsd: Number((task as { reward?: number }).reward ?? 0),
        proofMode,
      });
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Liveness") || e.message.includes("live code") || e.message.includes("Include"))) throw e;
    }

    try {
      const { enforceProofUploadToken } = await import("@/lib/strong-p6.functions");
      await enforceProofUploadToken({ userId, proofMode, token: proofUploadToken });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Proof upload")) throw e;
    }

    let proofHash: string | null = null;
    try {
      if (proofUrl || (proofText && !proofText.startsWith("auto:"))) {
        const { assertProofPerceptualV2 } = await import("@/lib/strong-premium.functions");
        const r = await assertProofPerceptualV2({ userId, proofText, proofUrl });
        proofHash = r.proofHash;
      } else {
        const { assertProofNotRecycled } = await import("@/lib/strong-ops");
        const r = await assertProofNotRecycled({ proofText, proofUrl, userId });
        proofHash = r.proofHash;
      }
    } catch (e) {
      if (e instanceof Error && (e.message.toLowerCase().includes("proof") || e.message.includes("recycled") || e.message.includes("original"))) throw e;
    }

    try {
      const { assertProofNotReused } = await import("@/lib/strong-p3.functions");
      await assertProofNotReused({ userId, proofUrl, proofHash });
    } catch (e) {
      if (e instanceof Error && e.message.includes("already")) throw e;
    }

    let forceManual = false;
    try {
      const { shouldForceManualReview } = await import("@/lib/strong-p5.functions");
      forceManual = await shouldForceManualReview({ userId });
    } catch {
      /* soft */
    }

    if (!autoVerified && !isAutoProof && !forceManual) {
      try {
        const { shouldTrustFastTrack } = await import("@/lib/strong-p3.functions");
        const ok = await shouldTrustFastTrack({
          userId,
          rewardUsd: Number((task as { reward?: number }).reward ?? 0),
          proofMode,
        });
        if (ok) autoVerified = true;
      } catch {
        /* soft */
      }
    }
    if (forceManual) autoVerified = false;

    let submissionId = "";
    const { data: rpcId, error: claimError } = await supabaseAdmin.rpc("claim_task_submission", {
      p_user_id: userId,
      p_task_id: taskId,
      p_proof_text: proofText || (isAutoProof ? "auto:telegram_membership" : null),
      p_proof_url: proofUrl || null,
      p_proof_hash: proofHash || null,
    } as never);

    if (claimError) {
      if (/function|does not exist|claim_task/i.test(claimError.message)) {
        const row: Record<string, unknown> = {
          user_id: userId,
          task_id: taskId,
          status: autoVerified ? "verified" : "pending",
          proof_text: proofText || (isAutoProof ? "auto:telegram_membership" : null),
          proof_url: proofUrl || null,
        };
        if (proofHash) row.proof_hash = proofHash;
        const { data: inserted, error: insErr } = await supabaseAdmin.from("submissions").insert(row as never).select("id").single();
        if (insErr) throw new Error(insErr.message);
        submissionId = asUuid((inserted as { id?: string } | null)?.id);
        if (autoVerified) {
          try {
            await supabaseAdmin.from("tasks").update({ slots_left: Math.max(0, Number(task.slots_left) - 1) } as never).eq("id", taskId);
          } catch { /* soft */ }
        }
      } else {
        throw new Error(claimError.message);
      }
    } else {
      submissionId = asUuid(rpcId);
    }

    if (!submissionId) throw new Error("Could not create submission. Try again.");

    if (autoVerified) {
      try {
        const { error: verificationError } = await supabaseAdmin.rpc("review_task_submission", {
          p_submission_id: submissionId,
          p_decision: "verified",
          p_reason: isAutoProof
            ? "Automatic verification confirmed membership."
            : "Trust fast-track auto-approved.",
        } as never);
        if (verificationError && !/function|does not exist/i.test(verificationError.message)) {
          await supabaseAdmin.from("submissions").update({ status: "verified", review_note: isAutoProof ? "auto membership" : "trust fast-track" } as never).eq("id", submissionId);
        }
      } catch {
        await supabaseAdmin.from("submissions").update({ status: "verified", review_note: isAutoProof ? "auto membership" : "trust fast-track" } as never).eq("id", submissionId);
      }
      try {
        const { applyTrustOutcome } = await import("@/lib/strong-escrow.functions");
        await applyTrustOutcome({ userId, outcome: "approved" });
      } catch { /* soft */ }
      try {
        const { onSubmissionVerified } = await import("@/lib/strong-fortress.functions");
        await onSubmissionVerified({ submissionId, userId, taskId, rewardUsd: Number((task as { reward?: number }).reward ?? 0) });
      } catch { /* soft */ }
      try {
        const { checkCampaignVelocityCircuit } = await import("@/lib/strong-p6.functions");
        await checkCampaignVelocityCircuit({ taskId, platform });
      } catch { /* soft */ }
      return { status: "verified" as const, autoVerified: true, submissionId };
    }

    return { status: "pending" as const, autoVerified: false, submissionId };
  });
