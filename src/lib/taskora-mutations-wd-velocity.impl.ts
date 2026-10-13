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

export const requestWithdrawalGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: string; address: string; amount: number; initData?: string; sessionToken?: string; moneySessionToken?: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const address = normalizeWalletAddress(data.address);
    if (!address || address.length < 10) throw new Error("Enter a valid wallet address.");

    try {
      const { assertVelocityBurstOk } = await import("@/lib/strong-velocity.functions");
      await assertVelocityBurstOk({ userId, kind: "withdraw_request" });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Too many")) throw e;
    }

    const maint = await getMaintenanceSwitches();
    if (maint.read_only || maint.withdrawals_paused) throw new Error("Withdrawals are temporarily paused by the owner.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const { assertNotShadowbanned } = await import("@/lib/strong-p5.functions");
      await assertNotShadowbanned({ userId });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Withdrawals are temporarily")) throw e;
    }

    try {
      const { assertStrictAddressCoolOff } = await import("@/lib/strong-p5.functions");
      await assertStrictAddressCoolOff({ userId, address });
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Wait") || e.message.includes("cooling"))) throw e;
    }

    try {
      const { assertDestinationFingerprint } = await import("@/lib/strong-p6.functions");
      await assertDestinationFingerprint({ userId, address });
    } catch (e) {
      if (e instanceof Error && e.message.includes("linked to too many")) throw e;
    }

    let requiresDual = false;
    try {
      const { assertDeviceScoreForWithdraw } = await import("@/lib/strong-p6.functions");
      const ds = await assertDeviceScoreForWithdraw({ userId });
      if (ds.dualRequired) requiresDual = true;
    } catch (e) {
      if (e instanceof Error && (e.message.includes("device needs") || e.message.includes("security review"))) throw e;
    }

    // P7: soft KYC for larger withdrawals
    try {
      const { assertKycForWithdraw } = await import("@/lib/strong-p7.functions");
      await assertKycForWithdraw({ userId, amountUsd: Number(data.amount) });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Identity check")) throw e;
    }

    let minWd = RULES.minWithdrawalUsd;
    let dualThreshold = 20;
    try {
      const { data: econ } = await supabaseAdmin.from("app_settings").select("value").eq("key", "economy").maybeSingle();
      const v = (econ?.value ?? {}) as Record<string, unknown>;
      minWd = Math.max(RULES.minWithdrawalUsd, Number(v.min_withdrawal_usd ?? RULES.minWithdrawalUsd));
      dualThreshold = Math.max(0, Number(v.dual_approval_threshold_usd ?? 20));
    } catch { /* defaults */ }
    if (!(data.amount >= minWd)) throw new Error(`Minimum withdrawal is $${minWd.toFixed(2)}.`);
    if (data.amount >= dualThreshold) requiresDual = true;

    const { data: profile } = await supabaseAdmin.from("profiles").select("created_at, status, wallet_frozen, wallet_frozen_reason").eq("id", userId).maybeSingle();
    if (profile && (profile as { status?: string }).status && !["active", "shadowban"].includes(String((profile as { status?: string }).status))) {
      throw new Error("Account is not allowed to withdraw.");
    }
    if (Boolean((profile as { wallet_frozen?: boolean } | null)?.wallet_frozen)) {
      throw new Error(`Wallet is frozen by the owner. ${String((profile as { wallet_frozen_reason?: string } | null)?.wallet_frozen_reason || "Contact support.")}`);
    }

    const ageH = hoursSince((profile as { created_at?: string } | null)?.created_at);
    if (ageH < RULES.newAccountWithdrawHoldHours) {
      const left = Math.ceil(RULES.newAccountWithdrawHoldHours - ageH);
      throw new Error(`New accounts wait ${RULES.newAccountWithdrawHoldHours}h before first withdrawal (~${left}h left).`);
    }

    const { count: pendingCount } = await supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending");
    if ((pendingCount ?? 0) >= RULES.maxPendingWithdrawals) throw new Error(`You already have ${RULES.maxPendingWithdrawals} pending withdrawals. Wait for review.`);

    try {
      const { assertWalletClusterHold } = await import("@/lib/strong-p4.functions");
      const cluster = await assertWalletClusterHold({ userId, address, amount: data.amount, isFirstWithdrawal: true });
      if (cluster.dualRequired) requiresDual = true;
    } catch (e) {
      if (e instanceof Error && (e.message.includes("wallet") || e.message.includes("Shared") || e.message.includes("too many accounts"))) throw e;
    }

    const { data: txs } = await supabaseAdmin.from("transactions").select("amount").eq("user_id", userId);
    const balance = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
    if (balance < data.amount) throw new Error("Not enough balance for this withdrawal.");

    const { error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId, method: data.method, address, amount: data.amount, status: "pending",
      requires_dual: requiresDual, approval_stage: requiresDual ? "needs_dual" : "pending",
    } as never);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId, label: `Withdrawal — ${data.method}`, amount: -Math.abs(data.amount), kind: "withdrawal",
    });

    return { ok: true, requiresDual, holdUntil: null };
  });
