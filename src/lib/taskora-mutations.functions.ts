import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { RULES, hoursSince, normalizeWalletAddress } from "@/lib/platform-rules";

/** Read owner kill-switches from app_settings.maintenance_switches */
async function getMaintenanceSwitches(): Promise<{
  read_only: boolean;
  withdrawals_paused: boolean;
  deposits_paused: boolean;
  task_creation_paused: boolean;
  verification_paused: boolean;
}> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_switches")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      read_only: Boolean(v.read_only),
      withdrawals_paused: Boolean(v.withdrawals_paused),
      deposits_paused: Boolean(v.deposits_paused),
      task_creation_paused: Boolean(v.task_creation_paused),
      verification_paused: Boolean(v.verification_paused),
    };
  } catch {
    return {
      read_only: false,
      withdrawals_paused: false,
      deposits_paused: false,
      task_creation_paused: false,
      verification_paused: false,
    };
  }
}

/** Submission with velocity limit + slot check + proof quality + kill-switches. */
export const submitTaskGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { taskId: string; proofText?: string | undefined; proofUrl?: string | undefined }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const maint = await getMaintenanceSwitches();
    if (maint.read_only) throw new Error("Platform is in read-only mode. Try again later.");
    if (maint.task_creation_paused) {
      throw new Error("New task submissions are temporarily paused by the owner.");
    }

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
    const platform = String((task as { platform?: string }).platform ?? "").toLowerCase();
    const taskLink = String((task as { link?: string | null }).link ?? "");
    const isTelegramJoin =
      platform === "telegram" ||
      /t\.me\//i.test(taskLink) ||
      String((task as { proof?: string }).proof ?? "") === "auto";

    let autoVerified = false;
    if (isTelegramJoin) {
      const verified = await tryTelegramMembershipProof(userId, taskLink, proofText);
      if (verified.ok) {
        autoVerified = true;
      } else if (!proofText && !proofUrl) {
        throw new Error(
          verified.reason ||
            "Join the channel/group first, then submit. Bot must be admin in that chat.",
        );
      }
    } else {
      if (!proofText && !proofUrl) {
        throw new Error("Add proof text or a proof link/screenshot URL.");
      }
      if (proofText && proofText.length < RULES.minProofTextChars && !proofUrl) {
        throw new Error(`Proof text must be at least ${RULES.minProofTextChars} characters.`);
      }
    }

    const status = autoVerified ? "verified" : "pending";
    const { error } = await supabaseAdmin.from("submissions").insert({
      user_id: userId,
      task_id: task.id,
      status,
      proof_text: proofText || (autoVerified ? "telegram:getChatMember" : null),
      proof_url: proofUrl || null,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("tasks")
      .update({ slots_left: Math.max(0, task.slots_left - 1) })
      .eq("id", task.id);

    if (autoVerified) {
      const reward = Number((task as { reward?: number }).reward ?? 0);
      if (reward > 0) {
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          label: `Task reward — ${String((task as { title?: string }).title ?? "task").slice(0, 60)}`,
          amount: reward,
          kind: "reward",
          reference: `task:${task.id}:${userId}`,
        } as never);
      }
      await creditDeferredReferralPoints(userId).catch(() => undefined);
    }

    return { status: status as "pending" | "verified", autoVerified };
  });

async function tryTelegramMembershipProof(
  userId: string,
  taskLink: string,
  proofText: string,
): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  if (!token) return { ok: false, reason: "Bot token not configured for auto-verify." };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  const tgId = Number((profile as { telegram_id?: number | null } | null)?.telegram_id ?? 0);
  if (!tgId) return { ok: false, reason: "No Telegram ID on profile." };

  const chatRef = extractTelegramChatRef(taskLink) || extractTelegramChatRef(proofText);
  if (!chatRef) {
    return {
      ok: false,
      reason: "Could not resolve channel/group from task link. Paste @username or invite link as proof.",
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatRef, user_id: tgId }),
    });
    const j = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: { status?: string };
    };
    if (!j.ok) {
      return {
        ok: false,
        reason:
          j.description?.includes("bot is not a member") || j.description?.includes("chat not found")
            ? "Bot must be admin in the target channel/group for auto-verify."
            : j.description || "Membership check failed.",
      };
    }
    const st = String(j.result?.status ?? "");
    const member = ["creator", "administrator", "member", "restricted"].includes(st);
    if (!member) {
      return { ok: false, reason: `You are not a member yet (status: ${st || "left"}). Join first.` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Telegram API error" };
  }
}

function extractTelegramChatRef(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  const at = s.match(/@([a-zA-Z0-9_]{4,})/);
  if (at) return `@${at[1]}`;
  const tm = s.match(/t\.me\/(?:c\/)?([a-zA-Z0-9_+\-]+)/i);
  if (tm) {
    const part = tm[1];
    if (/^\d+$/.test(part)) return `-100${part}`;
    return `@${part}`;
  }
  if (/^-?\d{6,}$/.test(s)) return s;
  return null;
}

async function creditDeferredReferralPoints(inviteeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: me } = await supabaseAdmin
    .from("profiles")
    .select("referred_by")
    .eq("id", inviteeId)
    .maybeSingle();
  const inviterId = (me as { referred_by?: string | null } | null)?.referred_by;
  if (!inviterId) return;

  const refKey = `referral_verified:${inviteeId}`;
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("user_id", inviterId)
    .eq("kind", "referral")
    .ilike("label", "%verified invite%")
    .limit(1);
  if (existing && existing.length > 0) return;

  const { count: verifiedCount } = await supabaseAdmin
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", inviteeId)
    .eq("status", "verified");
  if ((verifiedCount ?? 0) < 1) return;

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
  if (referralPoints <= 0) return;

  await (supabaseAdmin as any).rpc("award_task_points", {
    _user_id: inviterId,
    _amount: referralPoints,
    _kind: "referral",
    _label: "Verified invite reward",
    _reference: refKey,
  });
}

/** Withdrawal with min floor, 24h hold, shared-address block, pending cap, dual-approval flag. */
export const requestWithdrawalGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: string; address: string; amount: number }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const address = normalizeWalletAddress(data.address);
    if (!address || address.length < 10) throw new Error("Enter a valid wallet address.");

    const maint = await getMaintenanceSwitches();
    if (maint.read_only || maint.withdrawals_paused) {
      throw new Error("Withdrawals are temporarily paused by the owner.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let minWd = RULES.minWithdrawalUsd;
    let payoutsPaused = false;
    let dualEnabled = true;
    let dualThreshold = 20;
    try {
      const { data: econ } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "economy")
        .maybeSingle();
      const v = (econ?.value ?? {}) as Record<string, unknown>;
      minWd = Math.max(RULES.minWithdrawalUsd, Number(v.min_withdrawal_usd ?? RULES.minWithdrawalUsd));
      payoutsPaused = Boolean(v.payouts_paused);
      dualEnabled = v.dual_approval_enabled !== false;
      dualThreshold = Math.max(0, Number(v.dual_approval_threshold_usd ?? 20));
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
    const requiresDual = dualEnabled && data.amount >= dualThreshold;

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

    const { count: pendingCount } = await supabaseAdmin
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if ((pendingCount ?? 0) >= RULES.maxPendingWithdrawals) {
      throw new Error(`You already have ${RULES.maxPendingWithdrawals} pending withdrawals. Wait for review.`);
    }

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
      requires_dual: requiresDual,
      approval_stage: requiresDual ? "needs_dual" : "pending",
    } as never);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      label: `Withdrawal — ${data.method}`,
      amount: -Math.abs(data.amount),
      kind: "withdrawal",
    });
    return { ok: true, requiresDual };
  });

/** Create a pending crypto deposit intent (owner confirms or webhook completes). */
export const requestDepositGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { method: string; amount: number; txHash?: string | undefined; note?: string | undefined }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const maint = await getMaintenanceSwitches();
    if (maint.read_only || maint.deposits_paused) {
      throw new Error("Deposits are temporarily paused by the owner.");
    }

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
