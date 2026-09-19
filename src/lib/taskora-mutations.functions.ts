import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { RULES, hoursSince, normalizeWalletAddress } from "@/lib/platform-rules";

/** Submission with velocity limit + slot check + proof quality. Prefer this over raw insert paths. */
export const submitTaskGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { taskId: string; proofText?: string | undefined; proofUrl?: string | undefined }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - RULES.submissionWindowMs).toISOString();
    const { count } = await supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= RULES.maxSubmissionsPerHour) {
      throw new Error(`Rate limit: max ${RULES.maxSubmissionsPerHour} submissions per hour.`);
    }

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .eq("is_active", true)
      .maybeSingle();
    if (!task) throw new Error("This task is no longer available.");
    if (task.slots_left <= 0) throw new Error("All slots for this task are taken.");

    const { data: existing } = await supabaseAdmin
      .from("submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("task_id", data.taskId)
      .maybeSingle();
    if (existing) throw new Error("You already submitted this task.");

    const proofText = (data.proofText ?? "").trim();
    const proofUrl = (data.proofUrl ?? "").trim();
    if (!proofText && !proofUrl) {
      throw new Error("Add proof text or a proof link/screenshot URL.");
    }
    if (proofText && proofText.length < RULES.minProofTextChars && !proofUrl) {
      throw new Error(`Proof text must be at least ${RULES.minProofTextChars} characters.`);
    }

    const { error } = await supabaseAdmin.from("submissions").insert({
      user_id: userId,
      task_id: task.id,
      status: "pending",
      proof_text: proofText || null,
      proof_url: proofUrl || null,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("tasks")
      .update({ slots_left: Math.max(0, task.slots_left - 1) })
      .eq("id", task.id);

    return { status: "pending" as const };
  });

/** Withdrawal with min floor, 24h hold, shared-address block, pending cap. */
export const requestWithdrawalGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: string; address: string; amount: number }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const address = normalizeWalletAddress(data.address);
    if (!address || address.length < 10) throw new Error("Enter a valid wallet address.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let minWd = RULES.minWithdrawalUsd;
    let payoutsPaused = false;
    try {
      const { data: econ } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "economy")
        .maybeSingle();
      const v = (econ?.value ?? {}) as Record<string, unknown>;
      // Owner can raise min, never go below hard floor
      minWd = Math.max(RULES.minWithdrawalUsd, Number(v.min_withdrawal_usd ?? RULES.minWithdrawalUsd));
      payoutsPaused = Boolean(v.payouts_paused);
    } catch {
      /* defaults */
    }
    if (payoutsPaused) throw new Error("Withdrawals are temporarily paused by the owner.");
    if (!(data.amount >= minWd)) {
      throw new Error(`Minimum withdrawal is $${minWd.toFixed(2)}.`);
    }
    if (data.amount > RULES.maxAutoWithdrawalUsd) {
      throw new Error(
        `Amounts over $${RULES.maxAutoWithdrawalUsd} need manual owner review. Split or contact support.`,
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("created_at, status")
      .eq("id", userId)
      .maybeSingle();

    if (profile && (profile as { status?: string }).status && (profile as { status?: string }).status !== "active") {
      throw new Error("Account is not allowed to withdraw.");
    }

    const ageH = hoursSince((profile as { created_at?: string } | null)?.created_at);
    if (ageH < RULES.newAccountWithdrawHoldHours) {
      const left = Math.ceil(RULES.newAccountWithdrawHoldHours - ageH);
      throw new Error(
        `New accounts wait ${RULES.newAccountWithdrawHoldHours}h before first withdrawal (~${left}h left).`,
      );
    }

    // Cap concurrent pending withdrawals
    const { count: pendingCount } = await supabaseAdmin
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if ((pendingCount ?? 0) >= RULES.maxPendingWithdrawals) {
      throw new Error(`You already have ${RULES.maxPendingWithdrawals} pending withdrawals. Wait for review.`);
    }

    // Shared payout address across different users (normalized)
    const { data: others } = await supabaseAdmin
      .from("withdrawals")
      .select("user_id, address")
      .neq("user_id", userId)
      .limit(200);
    const shared = (others ?? []).some(
      (w) => normalizeWalletAddress(String((w as { address?: string }).address ?? "")) === address,
    );
    if (shared) {
      throw new Error("This wallet address is already linked to another account.");
    }

    const { data: txs } = await supabaseAdmin.from("transactions").select("amount").eq("user_id", userId);
    const balance = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
    if (balance < data.amount) throw new Error("Not enough balance for this withdrawal.");

    const { error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId,
      method: data.method,
      address,
      amount: data.amount,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      label: `Withdrawal — ${data.method}`,
      amount: -Math.abs(data.amount),
      kind: "withdrawal",
    });
    return { ok: true };
  });

/** Create a pending crypto deposit intent (owner confirms or webhook completes). */
export const requestDepositGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { method: string; amount: number; txHash?: string | undefined; note?: string | undefined }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const amount = Number(data.amount);
    if (!(amount >= 1)) throw new Error("Minimum deposit is $1.00.");
    if (!(amount <= 50_000)) throw new Error("Maximum single deposit is $50,000.");

    const method = (data.method || "").trim();
    if (!method) throw new Error("Choose a deposit network.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .maybeSingle();
    if (profile && String((profile as { status?: string }).status ?? "active") !== "active") {
      throw new Error("Account is not allowed to deposit.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: userId,
        amount,
        method,
        status: "pending",
        reference: data.txHash?.trim() || null,
        notes: data.note?.trim() || null,
      } as never)
      .select("id, status, amount, method, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
