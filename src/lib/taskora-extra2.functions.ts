import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  const tg = (profile as { telegram_id?: number | string | null } | null)?.telegram_id;
  if (isOwnerTelegramId(tg ?? null)) {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "admin" } as never,
      { onConflict: "user_id,role" } as never,
    );
    return;
  }
  throw new Error("Owner/admin authorization required.");
}

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: string; address: string; amount: number }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.address.trim()) throw new Error("Enter your wallet address.");
    const { RULES, hoursSince } = await import("@/lib/platform-rules");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let minWd = RULES.minWithdrawalUsd;
    try {
      const { data: settingsRow } = await supabaseAdmin.from("app_settings").select("value").eq("key", "economy").maybeSingle();
      const v = (settingsRow?.value ?? {}) as { min_withdrawal_usd?: number };
      minWd = Math.max(RULES.minWithdrawalUsd, Number(v.min_withdrawal_usd ?? RULES.minWithdrawalUsd));
    } catch { /* use default */ }
    if (!(data.amount >= minWd)) throw new Error(`Minimum withdrawal is $${minWd.toFixed(2)}.`);

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
      throw new Error(`New accounts wait ${RULES.newAccountWithdrawHoldHours}h before first withdrawal (~${left}h left).`);
    }

    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .eq("user_id", userId);
    const balance = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
    if (balance < data.amount) throw new Error("Not enough balance for this withdrawal.");

    const { data: withdrawal, error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId, method: data.method, address: data.address.trim(), amount: data.amount,
    }).select("*").single();
    if (error) throw new Error(error.message);
    try {
      const { notifyWithdrawalRequested } = await import("@/lib/notify-user"); await notifyWithdrawalRequested(userId, withdrawal);
      const { notifyOwnersWithdrawalRequested } = await import("@/lib/notify-owner");
      const p = await supabaseAdmin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      await notifyOwnersWithdrawalRequested({ userId, amount: Number(withdrawal.amount), method: String(withdrawal.method), address: String(withdrawal.address), displayName: p.data?.display_name, reference: withdrawal.reference });
    } catch {}

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      label: `Withdrawal — ${data.method}`,
      amount: -Math.abs(data.amount),
      kind: "withdrawal",
    });
    return { ok: true };
  });

export const applyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Enter an invite code.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("referred_by, referral_code")
      .eq("id", userId)
      .maybeSingle();
    if (me?.referred_by) throw new Error("You already used an invite code.");
    if (me?.referral_code === code) throw new Error("You cannot use your own code.");

    const { data: inviter } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!inviter) throw new Error("That invite code doesn't exist.");

    await supabaseAdmin.from("profiles").update({ referred_by: inviter.id }).eq("id", userId);

    const { data: settingsRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "economy")
      .maybeSingle();
    const referralPoints = Math.max(
      0,
      Math.floor(
        Number(
          (settingsRow?.value as { referral_points?: number } | null)?.referral_points ?? 100,
        ),
      ),
    );

    const linkBonus = Math.min(25, Math.floor(referralPoints * 0.1));
    let taskPointTotal = 0;
    if (linkBonus > 0) {
      const { data: total, error: pointsError } = await (supabaseAdmin as any).rpc(
        "award_task_points",
        {
          _user_id: inviter.id,
          _amount: linkBonus,
          _kind: "referral",
          _label: "Invite linked (pending first verified task)",
          _reference: `referral_link:${userId}`,
        },
      );
      if (pointsError) throw new Error(pointsError.message);
      taskPointTotal = Number(total ?? 0);
    }

    return {
      ok: true,
      taskPoints: linkBonus,
      pendingVerifiedBonus: Math.max(0, referralPoints - linkBonus),
      taskPointTotal,
      note: "Full invite Task Points unlock after your friend completes their first verified task.",
    };
  });

export const ownerCreateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      platform: string;
      title: string;
      advertiser: string;
      reward?: number;
      slots: number;
      steps: string[];
      proof: "auto" | "screenshot" | "username";
      link?: string | undefined;
      serviceId?: string | undefined;
      watchSeconds?: number | undefined;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(data.slots > 0) || !data.title.trim()) {
      throw new Error("Invalid task configuration.");
    }

    // Catalog is source of truth — never trust browser reward
    let reward = Number(data.reward ?? 0);
    let pricingMeta: Record<string, unknown> | null = null;
    if (data.serviceId) {
      const { resolveLockedPricing } = await import("@/lib/pricing-authority");
      const locked = await resolveLockedPricing({
        serviceId: data.serviceId,
        qty: data.slots,
        watchSeconds: data.watchSeconds,
      });
      reward = locked.workerUnit;
      pricingMeta = {
        service_id: locked.serviceId,
        customer_unit: locked.customerUnit,
        worker_unit: locked.workerUnit,
        taskora_unit: locked.taskoraUnit,
        watch_seconds: locked.watchSeconds ?? null,
        split: "70/30",
      };
    }
    if (!(reward > 0)) throw new Error("Catalog price is invalid for this service.");

    const row: Record<string, unknown> = {
      platform: data.platform,
      title: data.title.trim(),
      advertiser: data.advertiser.trim() || "TASKORA",
      reward,
      slots_left: data.slots,
      steps: data.steps.length ? data.steps : ["Complete the required action", "Return and submit proof"],
      proof: data.proof,
      link: data.link ?? null,
      is_active: true,
    };
    if (pricingMeta) row.meta = pricingMeta;

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert(row as never)
      .select("*")
      .single();
    if (error) {
      if (String(error.message).toLowerCase().includes("meta")) {
        delete row.meta;
        const r2 = await supabaseAdmin.from("tasks").insert(row as never).select("*").single();
        if (r2.error) throw new Error(r2.error.message);
        try { const { publishNewTaskNotification } = await import("@/lib/notify-user"); await publishNewTaskNotification(r2.data); } catch {}
        return r2.data;
      }
      throw new Error(error.message);
    }
    try { const { publishNewTaskNotification } = await import("@/lib/notify-user"); await publishNewTaskNotification(task); } catch {}
    return task;
  });
