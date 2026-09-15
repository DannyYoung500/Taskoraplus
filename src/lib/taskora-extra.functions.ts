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
  const tg = (profile as { telegram_id?: number | null } | null)?.telegram_id;
  if (isOwnerTelegramId(tg ?? null)) {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "admin" } as never,
      { onConflict: "user_id,role" } as never,
    );
    return;
  }
  throw new Error("Owner/admin authorization required.");
}

async function loadPlatformSettings(db: any) {
  try {
    const { data } = await db.from("platform_settings").select("*").eq("id", true).maybeSingle();
    return {
      dual_approval_enabled: data?.dual_approval_enabled !== false,
      dual_approval_threshold_usd: Number(data?.dual_approval_threshold_usd ?? 20),
      first_withdrawal_extra_review: data?.first_withdrawal_extra_review !== false,
      payouts_paused: Boolean(data?.payouts_paused),
    };
  } catch {
    return {
      dual_approval_enabled: true,
      dual_approval_threshold_usd: 20,
      first_withdrawal_extra_review: true,
      payouts_paused: false,
    };
  }
}

export const listPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, display_name, username, photo_url, telegram_id")
          .in("id", userIds)
      : { data: [] as any[] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return rows.map((r: any) => {
      const p = byId.get(r.user_id) as any;
      return {
        ...r,
        display_name: p?.display_name ?? null,
        username: p?.username ?? null,
        photo_url: p?.photo_url ?? null,
        telegram_id: p?.telegram_id ?? null,
        approval_stage: String(r.approval_stage ?? "pending"),
        requires_dual: Boolean(r.requires_dual),
        is_first_withdrawal: Boolean(r.is_first_withdrawal),
      };
    });
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { withdrawalId: string; decision: "paid" | "rejected" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await loadPlatformSettings(supabaseAdmin);

    if (settings.payouts_paused && data.decision === "paid") {
      throw new Error("Payouts are paused in platform settings.");
    }

    const { data: row } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (!row) throw new Error("Withdrawal not found.");
    if (row.status !== "pending") throw new Error(`Already ${row.status}.`);

    const amount = Math.abs(Number(row.amount));
    const stage = String((row as any).approval_stage ?? "pending");
    const firstBy = (row as any).first_approved_by as string | null;
    const requiresDual =
      Boolean((row as any).requires_dual) ||
      (settings.dual_approval_enabled && amount >= settings.dual_approval_threshold_usd) ||
      (Boolean((row as any).is_first_withdrawal) && settings.first_withdrawal_extra_review);

    if (data.decision === "rejected") {
      await supabaseAdmin.from("transactions").insert({
        user_id: row.user_id,
        label: "Withdrawal rejected — refund",
        amount,
        kind: "bonus",
      });
      const { error } = await supabaseAdmin
        .from("withdrawals")
        .update({ status: "rejected", approval_stage: "rejected" } as never)
        .eq("id", data.withdrawalId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return { status: "rejected", stage: "rejected" };
    }

    if (requiresDual && stage === "pending") {
      const { error } = await supabaseAdmin
        .from("withdrawals")
        .update({
          approval_stage: "first_approved",
          first_approved_by: context.userId,
          first_approved_at: new Date().toISOString(),
          requires_dual: true,
        } as never)
        .eq("id", data.withdrawalId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return {
        status: "pending",
        stage: "first_approved",
        message: "First approval recorded. Second owner must confirm.",
      };
    }

    if (requiresDual && stage === "first_approved") {
      if (firstBy && firstBy === context.userId) {
        throw new Error("Second approval must be a different owner.");
      }
      const { error } = await supabaseAdmin
        .from("withdrawals")
        .update({
          status: "paid",
          approval_stage: "paid",
          second_approved_by: context.userId,
          second_approved_at: new Date().toISOString(),
        } as never)
        .eq("id", data.withdrawalId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return { status: "paid", stage: "paid" };
    }

    const { error } = await supabaseAdmin
      .from("withdrawals")
      .update({
        status: "paid",
        approval_stage: "paid",
        first_approved_by: context.userId,
        first_approved_at: new Date().toISOString(),
      } as never)
      .eq("id", data.withdrawalId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { status: "paid", stage: "paid" };
  });

export const listGateWhitelist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from("gate_whitelist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    } catch {
      return [];
    }
  });

export const addGateWhitelist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegramId: number; note?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("gate_whitelist").upsert({
      telegram_id: data.telegramId,
      note: data.note?.trim() || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeGateWhitelist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegramId: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("gate_whitelist")
      .delete()
      .eq("telegram_id", data.telegramId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
