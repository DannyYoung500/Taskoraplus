/**
 * Strong tier-B - server helpers (no .server path).
 */
async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

export async function requestSubmissionAmendment(opts: {
  submissionId: string;
  note?: string;
  requesterId: string;
}) {
  try {
    const s = await admin();
    await s
      .from("submissions")
      .update({
        status: "amendment_requested",
        review_note: opts.note ?? "Please resubmit clearer proof",
      } as never)
      .eq("id", opts.submissionId);
    return { ok: true as const };
  } catch (e) {
    throw e instanceof Error ? e : new Error("Amendment request failed");
  }
}

export async function resubmitAfterAmendment(opts: {
  submissionId: string;
  proofText?: string;
  proofUrl?: string;
  workerId: string;
}) {
  try {
    const s = await admin();
    await s
      .from("submissions")
      .update({
        status: "pending",
        proof_text: opts.proofText ?? null,
        proof_url: opts.proofUrl ?? null,
        review_note: null,
      } as never)
      .eq("id", opts.submissionId)
      .eq("user_id", opts.workerId);
    return { ok: true as const };
  } catch (e) {
    throw e instanceof Error ? e : new Error("Resubmit failed");
  }
}

export async function listOpenAmendmentsInternal(userId: string) {
  try {
    const s = await admin();
    const { data } = await s
      .from("submissions")
      .select("id, task_id, review_note, updated_at")
      .eq("user_id", userId)
      .eq("status", "amendment_requested")
      .order("updated_at", { ascending: false })
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function ownerSetFineSwitchInternal(
  ownerId: string,
  key: string,
  value: boolean,
) {
  const { assertOwner } = await import("@/lib/owner-guard-impl");
  await assertOwner(ownerId);
  const s = await admin();
  const { data: existing } = await s
    .from("app_settings")
    .select("value")
    .eq("key", "fine_kill_switches")
    .maybeSingle();
  const v = { ...((existing?.value ?? {}) as object), [key]: value };
  await s.from("app_settings").upsert({ key: "fine_kill_switches", value: v }, { onConflict: "key" });
  return { ok: true, key, value };
}

export async function getFineKillSwitches() {
  try {
    const s = await admin();
    const { data } = await s
      .from("app_settings")
      .select("value")
      .eq("key", "fine_kill_switches")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, boolean>;
    return {
      tasks_paused: Boolean(v.tasks_paused),
      withdrawals_paused: Boolean(v.withdrawals_paused),
      referrals_paused: Boolean(v.referrals_paused),
    };
  } catch {
    return { tasks_paused: false, withdrawals_paused: false, referrals_paused: false };
  }
}

export async function assertFineSwitch(key: string, message?: string) {
  const sw = await getFineKillSwitches();
  if ((sw as any)[key]) {
    throw new Error(message ?? `Action paused (${key})`);
  }
  return { ok: true as const };
}

export async function assertNotImpossibleProgression(opts: { userId: string }) {
  return { ok: true as const };
}
