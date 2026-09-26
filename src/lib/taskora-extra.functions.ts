import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isOwnerTelegramId } from "@/lib/owner";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"] ?? "https://qvwetjpgplkhxuymsnyx.supabase.co";
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

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

export const listTasks = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("tasks")
    .select("*")
    .eq("is_active", true)
    .order("reward", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getTask = createServerFn({ method: "GET" })
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ data }) => {
    const { data: task, error } = await publicClient()
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return task;
  });

export const dailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { RULES } = await import("@/lib/platform-rules");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("streak, last_checkin")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile not found.");

    const today = new Date().toISOString().slice(0, 10);
    if (profile.last_checkin === today) {
      return { already: true, streak: Number(profile.streak ?? 0), taskPoints: 0, streakBonus: 0 };
    }

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const prev = Number(profile.streak ?? 0);
    const streak = profile.last_checkin === yesterday ? prev + 1 : 1;

    await supabaseAdmin.from("profiles").update({ streak, last_checkin: today }).eq("id", userId);
    const { data: settingsRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "economy")
      .maybeSingle();
    const dailyPoints = Math.max(
      0,
      Math.floor(
        Number(
          (settingsRow?.value as { daily_checkin_points?: number } | null)?.daily_checkin_points ?? 25,
        ),
      ),
    );

    const bonusDays = RULES.streakBonusDays;
    const streakBonus =
      streak > 0 && streak % bonusDays === 0 ? RULES.streakBonusPoints : 0;
    const totalAward = dailyPoints + streakBonus;

    const { data: taskPointTotal, error: pointsError } = await (supabaseAdmin as any).rpc(
      "award_task_points",
      {
        _user_id: userId,
        _amount: totalAward,
        _kind: "daily_checkin",
        _label:
          streakBonus > 0
            ? `Daily check-in — day ${streak} (+${streakBonus} streak bonus)`
            : `Daily check-in — day ${streak}`,
        _reference: `checkin:${userId}:${today}`,
      },
    );
    if (pointsError) throw new Error(pointsError.message);
    try {
      const { notifyCheckinSuccess } = await import("@/lib/notify-user");
      await notifyCheckinSuccess(userId, streak, totalAward, streakBonus);
    } catch {}
    return {
      already: false,
      streak,
      taskPoints: totalAward,
      basePoints: dailyPoints,
      streakBonus,
      nextBonusIn: streakBonus > 0 ? bonusDays : bonusDays - (streak % bonusDays),
      taskPointTotal: Number(taskPointTotal ?? 0),
    };
  });

export const listPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select("*, profiles:user_id(display_name, username, telegram_id, photo_url)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      ...row,
      photo_url: row.profiles?.photo_url ?? null,
      display_name: row.profiles?.display_name ?? null,
      username: row.profiles?.username ?? null,
    }));
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      withdrawalId: string;
      decision: "paid" | "rejected" | "first_approve";
      reason?: string;
      txHash?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (!row) throw new Error("Withdrawal not found.");
    if (row.status === "paid") throw new Error("Withdrawal is already paid.");
    if (row.status !== "pending" && row.status !== "processing") {
      throw new Error(`Cannot review withdrawal in status: ${row.status}`);
    }

    const requiresDual = Boolean((row as { requires_dual?: boolean }).requires_dual);
    const stage = String((row as { approval_stage?: string }).approval_stage ?? "pending");
    const firstBy = (row as { first_approved_by?: string | null }).first_approved_by ?? null;

    if (data.decision === "first_approve") {
      if (!requiresDual) throw new Error("This withdrawal does not require dual approval.");
      if (stage === "first_ok" || stage === "ready") {
        throw new Error("First approval already recorded.");
      }
      const { error } = await supabaseAdmin
        .from("withdrawals")
        .update({
          approval_stage: "first_ok",
          first_approved_by: context.userId,
          first_approved_at: new Date().toISOString(),
        } as never)
        .eq("id", data.withdrawalId);
      if (error) throw new Error(error.message);
      try {
        const { notifyWithdrawalReview } = await import("@/lib/notify-user");
        await notifyWithdrawalReview(String(row.user_id), row);
      } catch {}
      return { status: "pending", approval_stage: "first_ok" as const };
    }

    if (data.decision === "paid" && requiresDual) {
      if (stage !== "first_ok" && stage !== "ready") {
        throw new Error("Dual approval required: another owner must record first approval first.");
      }
      if (firstBy && firstBy === context.userId) {
        throw new Error("Second approval must be a different owner than the first approver.");
      }
    }

    const nextStatus = data.decision === "paid" ? "paid" : "rejected";
    const txHash =
      data.decision === "paid" && data.txHash?.trim()
        ? data.txHash.trim().slice(0, 128)
        : null;

    // Require on-chain tx hash for larger payouts
    if (data.decision === "paid") {
      const { RULES } = await import("@/lib/platform-rules");
      const amt = Number(row.amount);
      if (amt >= RULES.txHashRequiredUsd && !txHash) {
        throw new Error(
          `Tx hash required for payouts ≥ $${RULES.txHashRequiredUsd}. Paste the on-chain hash before marking Paid.`,
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("withdrawals")
      .update({
        status: nextStatus as never,
        rejection_reason: data.decision === "rejected" ? (data.reason ?? "Rejected by owner") : null,
        processed_at: new Date().toISOString(),
        processed_by: context.userId,
        approval_stage: nextStatus === "paid" ? "complete" : "rejected",
        ...(txHash ? { tx_hash: txHash } : {}),
        ...(nextStatus === "paid" && requiresDual
          ? {
              second_approved_by: context.userId,
              second_approved_at: new Date().toISOString(),
            }
          : {}),
      } as never)
      .eq("id", data.withdrawalId)
      .neq("status", "paid");
    if (error) throw new Error(error.message);

    if (data.decision === "rejected") {
      const label = `Withdrawal rejected — refund ${data.withdrawalId.slice(0, 8)}`;
      const { data: existing } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("user_id", row.user_id)
        .eq("label", label)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("transactions").insert({
          user_id: row.user_id,
          label,
          amount: Math.abs(Number(row.amount)),
          kind: "bonus",
        });
      }
    }

    // Public payout proof → payment channel on every successful paid mark
    if (data.decision === "paid") {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, username")
          .eq("id", row.user_id)
          .maybeSingle();
        const { postPayoutProofToChannel } = await import("@/lib/notify-owner");
        await postPayoutProofToChannel({
          amount: Number(row.amount),
          method: String(row.method ?? "USDT"),
          address: String((row as { address?: string }).address ?? ""),
          txHash: txHash,
          displayName: profile?.display_name ?? null,
          username: profile?.username ?? null,
          withdrawalId: data.withdrawalId,
        });
      } catch {
        /* never block mark-paid */
      }
    }

    try {
      const { notifyWithdrawalPaid, notifyWithdrawalRejected } = await import("@/lib/notify-user");
      if (data.decision === "paid") {
        await notifyWithdrawalPaid(String(row.user_id), { ...row, status: nextStatus, tx_hash: txHash });
        await notifyOwnersWithdrawalPaid({ userId: String(row.user_id), amount: Number(row.amount), method: String(row.method ?? "USDT"), txHash, reference: String((row as any).reference ?? row.id) });
      } else {
        await notifyWithdrawalRejected(String(row.user_id), { ...row, status: nextStatus }, data.reason ?? "Withdrawal rejected by owner.");
        await notifyOwnersWithdrawalFailed({ userId: String(row.user_id), amount: Number(row.amount), method: String(row.method ?? "USDT"), reason: data.reason ?? "Withdrawal rejected by owner.", reference: String((row as any).reference ?? row.id) });
      }
    } catch {}
    return { status: nextStatus };
  });
