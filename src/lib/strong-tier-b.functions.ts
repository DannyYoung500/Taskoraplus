/**
 * TASKORA Tier B (real production):
 * 1 Dispute / amendment queue (one free re-submit before hard reject)
 * 2 Impossible-progression detector
 * 3 Economy fine-grained kill switches
 * 4 Wire helpers used by marketplace ranking + referral
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertAdmin(userId: string) {
  const { assertOwner } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
}

/* ═══════════════════════════════════════════════════════════════
 * 1 · Dispute / amendment queue
 * ═══════════════════════════════════════════════════════════════ */

export async function requestSubmissionAmendment(opts: {
  submissionId: string;
  requesterId: string;
  reason: string;
  windowHours?: number;
}): Promise<{ ok: true; amendmentId: string; deadline: string }> {
  const reason = String(opts.reason ?? "").trim().slice(0, 500);
  if (reason.length < 4) throw new Error("Explain what needs fixing (min 4 characters).");

  const s = await adminClient();
  const { data: sub } = await s
    .from("submissions")
    .select("id, user_id, task_id, status, amendment_count")
    .eq("id", opts.submissionId)
    .maybeSingle();
  if (!sub) throw new Error("Submission not found.");
  if (String((sub as { status?: string }).status) !== "pending") {
    throw new Error("Only pending submissions can be sent for amendment.");
  }

  const { data: task } = await s
    .from("tasks")
    .select("created_by, title")
    .eq("id", (sub as { task_id: string }).task_id)
    .maybeSingle();
  const advertiserId = String((task as { created_by?: string } | null)?.created_by ?? "");

  let isOwner = false;
  try {
    await assertAdmin(opts.requesterId);
    isOwner = true;
  } catch {
    /* not owner */
  }
  if (!isOwner && opts.requesterId !== advertiserId) {
    throw new Error("Only the campaign owner (or platform owner) can request amendment.");
  }

  const amendCount = Number((sub as { amendment_count?: number } | null)?.amendment_count ?? 0);
  if (amendCount >= 1) {
    throw new Error("This submission already used its free amendment. Reject or verify instead.");
  }

  const hours = Math.max(6, Math.min(72, opts.windowHours ?? 24));
  const deadline = new Date(Date.now() + hours * 3600_000).toISOString();

  const { data: row, error } = await (s as any)
    .from("submission_amendments")
    .insert({
      submission_id: opts.submissionId,
      requester_id: opts.requesterId,
      worker_id: (sub as { user_id: string }).user_id,
      task_id: (sub as { task_id: string }).task_id,
      reason,
      status: "open",
      deadline,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message || "Could not create amendment.");

  await s
    .from("submissions")
    .update({
      status: "amendment_requested",
      amendment_count: amendCount + 1,
      amendment_deadline: deadline,
      amendment_reason: reason,
    } as never)
    .eq("id", opts.submissionId);

  try {
    await s.from("notifications").insert({
      user_id: (sub as { user_id: string }).user_id,
      title: "Proof needs a small fix",
      body: `Campaign owner asked you to update your proof: ${reason.slice(0, 120)}. You have ~${hours}h to re-submit.`,
      category: "task",
    });
  } catch {
    /* soft */
  }

  return { ok: true, amendmentId: String(row.id), deadline };
}

export const requestAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; reason: string; windowHours?: number }) => d)
  .handler(async ({ data, context }) => {
    return requestSubmissionAmendment({
      submissionId: data.submissionId,
      requesterId: context.userId,
      reason: data.reason,
      windowHours: data.windowHours,
    });
  });

export async function resubmitAfterAmendment(opts: {
  submissionId: string;
  workerId: string;
  proofText?: string | null;
  proofUrl?: string | null;
}): Promise<{ ok: true; status: "pending" }> {
  const s = await adminClient();
  const { data: sub } = await s
    .from("submissions")
    .select("id, user_id, status, amendment_deadline")
    .eq("id", opts.submissionId)
    .maybeSingle();
  if (!sub) throw new Error("Submission not found.");
  if (String((sub as { user_id: string }).user_id) !== opts.workerId) {
    throw new Error("Only the original worker can re-submit.");
  }
  if (String((sub as { status?: string }).status) !== "amendment_requested") {
    throw new Error("This submission is not waiting for an amendment.");
  }
  const deadline = (sub as { amendment_deadline?: string | null }).amendment_deadline;
  if (deadline && new Date(deadline).getTime() < Date.now()) {
    await s
      .from("submissions")
      .update({ status: "rejected", reject_reason: "Amendment window expired." } as never)
      .eq("id", opts.submissionId);
    try {
      const { onSubmissionReviewed } = await import("@/lib/strong-marketplace.functions");
      await onSubmissionReviewed({ userId: opts.workerId, decision: "rejected" });
    } catch {
      /* soft */
    }
    throw new Error("Amendment window expired. Submission was rejected.");
  }

  const proofText = String(opts.proofText ?? "").trim();
  const proofUrl = String(opts.proofUrl ?? "").trim();
  if (!proofText && !proofUrl) throw new Error("Add the updated proof.");

  await s
    .from("submissions")
    .update({
      status: "pending",
      proof_text: proofText || null,
      proof_url: proofUrl || null,
      amendment_deadline: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", opts.submissionId);

  await (s as any)
    .from("submission_amendments")
    .update({ status: "resubmitted", resubmitted_at: new Date().toISOString() })
    .eq("submission_id", opts.submissionId)
    .eq("status", "open");

  return { ok: true, status: "pending" };
}

export const resubmitAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; proofText?: string; proofUrl?: string }) => d)
  .handler(async ({ data, context }) => {
    return resubmitAfterAmendment({
      submissionId: data.submissionId,
      workerId: context.userId,
      proofText: data.proofText,
      proofUrl: data.proofUrl,
    });
  });

export const listOpenAmendments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await adminClient();
    const { data: asWorker } = await (s as any)
      .from("submission_amendments")
      .select("id, submission_id, reason, deadline, status, created_at, task_id")
      .eq("worker_id", context.userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);
    return { open: asWorker ?? [] };
  });

/* ═══════════════════════════════════════════════════════════════
 * 2 · Impossible-progression detector
 * ═══════════════════════════════════════════════════════════════ */

export async function assertNotImpossibleProgression(opts: {
  userId: string;
}): Promise<{ ok: boolean; signals: string[] }> {
  const signals: string[] = [];
  try {
    const s = await adminClient();
    const since15 = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count: recentSubs } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .gte("created_at", since15);
    if (Number(recentSubs ?? 0) >= 10) {
      signals.push("subs_10_in_15m");
      throw new Error(
        "Too many task submissions in a short time. Slow down and try again in a few minutes.",
      );
    }

    const { data: profile } = await s
      .from("profiles")
      .select("created_at, trust_score")
      .eq("id", opts.userId)
      .maybeSingle();
    const ageH =
      (Date.now() - new Date(String((profile as { created_at?: string } | null)?.created_at ?? 0)).getTime()) /
      3600000;
    const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
    const { data: txs } = await s
      .from("transactions")
      .select("amount")
      .eq("user_id", opts.userId)
      .gt("amount", 0)
      .gte("created_at", dayStart);
    const earnedToday = (txs ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    if (ageH < 6 && earnedToday >= 5) {
      signals.push("new_account_fast_earn");
      throw new Error(
        "New accounts have a lower activity limit for the first hours. Continue later today.",
      );
    }
    return { ok: true, signals };
  } catch (e) {
    if (e instanceof Error && (e.message.includes("Too many") || e.message.includes("New accounts"))) {
      throw e;
    }
    return { ok: true, signals };
  }
}

/* ═══════════════════════════════════════════════════════════════
 * 3 · Fine-grained economy kill switches
 * ═══════════════════════════════════════════════════════════════ */

export type FineKillSwitches = {
  rewarded_ads_paused: boolean;
  referral_payouts_paused: boolean;
  new_campaigns_paused: boolean;
  bonus_ads_paused: boolean;
};

export async function getFineKillSwitches(): Promise<FineKillSwitches> {
  try {
    const s = await adminClient();
    const { data } = await s
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_switches")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      rewarded_ads_paused: Boolean(v.rewarded_ads_paused),
      referral_payouts_paused: Boolean(v.referral_payouts_paused),
      new_campaigns_paused: Boolean(v.new_campaigns_paused),
      bonus_ads_paused: Boolean(v.bonus_ads_paused),
    };
  } catch {
    return {
      rewarded_ads_paused: false,
      referral_payouts_paused: false,
      new_campaigns_paused: false,
      bonus_ads_paused: false,
    };
  }
}

export async function assertFineSwitch(
  key: keyof FineKillSwitches,
  message?: string,
): Promise<void> {
  const sw = await getFineKillSwitches();
  if (sw[key]) {
    throw new Error(
      message ||
        (key === "rewarded_ads_paused"
          ? "Rewarded ads are temporarily paused by the owner."
          : key === "referral_payouts_paused"
            ? "Referral payouts are temporarily paused by the owner."
            : key === "new_campaigns_paused"
              ? "New campaigns are temporarily paused by the owner."
              : "Bonus ads are temporarily paused by the owner."),
    );
  }
}

export const ownerSetFineSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      key: keyof FineKillSwitches;
      value: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const s = await adminClient();
    const { data: row } = await s
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_switches")
      .maybeSingle();
    const prev = (row?.value ?? {}) as Record<string, unknown>;
    const next = { ...prev, [data.key]: Boolean(data.value) };
    await s.from("app_settings").upsert(
      {
        key: "maintenance_switches",
        value: next,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "key" },
    );
    return { ok: true as const, switches: next };
  });
