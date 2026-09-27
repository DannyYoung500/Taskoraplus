import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isOwnerTelegramId } from "@/lib/owner";
const CHECKIN_BADGES = [
  { days: 30, name: "Badge of Honor" },
  { days: 60, name: "Dedicated Member" },
  { days: 90, name: "Elite Member" },
  { days: 180, name: "Veteran" },
  { days: 365, name: "Legend" },
] as const;

function getCheckinBadge(streak: number) {
  let unlocked: string | null = null;
  for (const badge of CHECKIN_BADGES) if (streak >= badge.days) unlocked = badge.name;
  return { unlocked, next: CHECKIN_BADGES.find((badge) => streak < badge.days) ?? null };
}export const dailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("streak, last_checkin").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Profile not found.");
    const today = new Date().toISOString().slice(0, 10);
    if (profile.last_checkin === today) {
      const badge = getCheckinBadge(Number(profile.streak ?? 0));
      return { already: true, streak: Number(profile.streak ?? 0), badge: badge.unlocked, nextBadge: badge.next, badgeUnlocked: false };
    }
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const prev = Number(profile.streak ?? 0);
    const streak = profile.last_checkin === yesterday ? prev + 1 : 1;
    await supabaseAdmin.from("profiles").update({ streak, last_checkin: today }).eq("id", userId);
    const badge = getCheckinBadge(streak);
    const badgeUnlocked = Boolean(badge.next && streak === badge.next.days);
    try {
      const { notifyCheckinSuccess } = await import("@/lib/notify-user");
      await notifyCheckinSuccess(userId, streak, badgeUnlocked ? badge.next?.name ?? null : null, badge.next?.days ?? null);
    } catch {}
    return { already: false, streak, badge: badge.unlocked, nextBadge: badge.next, badgeUnlocked };
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
