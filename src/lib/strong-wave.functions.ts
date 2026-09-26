/**
 * Strong wave: batch payout, stuck SLA, network float, public stats, join proof, new-device lock.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { assertOwner } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
}

/** Batch mark multiple non-dual (or already first-ok) withdrawals as paid + post proofs. */
export const batchMarkWithdrawalsPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; txHashPrefix?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const ids = Array.isArray(data.ids) ? data.ids.slice(0, 25) : [];
    if (!ids.length) throw new Error("Select at least one withdrawal.");
    const { reviewWithdrawal } = await import("@/lib/taskora-extra.functions");
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      try {
        const txHash =
          data.txHashPrefix?.trim()
            ? `${data.txHashPrefix.trim()}-${i + 1}`
            : undefined;
        await reviewWithdrawal({
          data: { withdrawalId: id, decision: "paid", txHash },
        } as never);
        results.push({ id, ok: true });
      } catch (e) {
        results.push({
          id,
          ok: false,
          error: e instanceof Error ? e.message : "failed",
        });
      }
    }
    return {
      ok: results.every((r) => r.ok),
      paid: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  });

const STUCK_HOURS = 12;

export async function alertStuckWithdrawals(): Promise<{
  count: number;
  totalUsd: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - STUCK_HOURS * 3600_000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("withdrawals")
    .select("id, amount, method, created_at, user_id")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(40);

  const list = rows ?? [];
  const totalUsd = list.reduce((s, r) => s + Number(r.amount), 0);
  if (list.length === 0) return { count: 0, totalUsd: 0 };

  try {
    const { sendOwnerHtml } = await import("@/lib/notify-owner");
    const lines = list
      .slice(0, 12)
      .map((r) => {
        const ageH = Math.round(
          (Date.now() - new Date(String(r.created_at)).getTime()) / 3600000,
        );
        return `• $${Number(r.amount).toFixed(2)} ${r.method} · ${ageH}h · <code>${String(r.id).slice(0, 8)}</code>`;
      })
      .join("\n");
    await sendOwnerHtml(
      `⏰ <b>Stuck withdrawals (≥${STUCK_HOURS}h)</b>\n` +
        `${list.length} pending · ~$${totalUsd.toFixed(2)}\n${lines}`,
    );
  } catch {
    /* soft */
  }
  return { count: list.length, totalUsd };
}

export const ownerAlertStuckWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return alertStuckWithdrawals();
  });

export async function assertNetworkDailyFloat(opts: {
  method: string;
  amount: number;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let limit = 500;
    const { data: econ } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "economy")
      .maybeSingle();
    const v = (econ?.value ?? {}) as Record<string, unknown>;
    const map = (v.network_daily_float as Record<string, number> | undefined) ?? {};
    const methodKey = opts.method.toUpperCase().replace(/\s+/g, "_");
    limit = Math.max(
      50,
      Number(map[methodKey] ?? map[opts.method] ?? v.default_network_daily_float ?? 500),
    );
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data: paid } = await supabaseAdmin
      .from("withdrawals")
      .select("amount")
      .eq("status", "paid")
      .eq("method", opts.method)
      .gte("processed_at", since.toISOString());
    const used = (paid ?? []).reduce((s, r) => s + Number(r.amount), 0);
    if (used + opts.amount > limit) {
      throw new Error(
        `Daily float for ${opts.method} is $${limit.toFixed(0)}. Already paid $${used.toFixed(2)} today. Try later or contact support.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily float")) throw e;
  }
}

export async function applyNewDeviceWithdrawalLock(opts: {
  userId: string;
  amount: number;
  requiresDual: boolean;
}): Promise<{ requiresDual: boolean; blocked?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: history } = await supabaseAdmin
      .from("withdrawals")
      .select("id")
      .eq("user_id", opts.userId)
      .in("status", ["paid", "completed", "approved"])
      .limit(1);
    const hasPaidBefore = (history ?? []).length > 0;
    if (!hasPaidBefore && opts.amount > 25) {
      return {
        requiresDual: true,
        blocked:
          "New-device limit: first withdrawals over $25 need support review. Start with ≤ $5.",
      };
    }
    if (!hasPaidBefore && opts.amount > 5) {
      return { requiresDual: true };
    }
  } catch {
    /* soft */
  }
  return { requiresDual: opts.requiresDual };
}

export const getPublicPlatformStats = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const day = new Date(Date.now() - 86400_000).toISOString();
      const [verifiedToday, paidWeek] = await Promise.all([
        supabaseAdmin
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .gte("updated_at", day),
        supabaseAdmin
          .from("withdrawals")
          .select("amount")
          .eq("status", "paid")
          .gte("processed_at", since),
      ]);
      const paidUsd = (paidWeek.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      return {
        verifiedToday: verifiedToday.count ?? 0,
        paidWeekUsd: Math.round(paidUsd * 100) / 100,
      };
    } catch {
      return { verifiedToday: 0, paidWeekUsd: 0 };
    }
  },
);

export async function verifyTelegramChannelMembership(opts: {
  telegramUserId: number | string;
  channelId: string;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { ok: false, error: "bot_token_missing" };
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(opts.channelId)}&user_id=${opts.telegramUserId}`,
    );
    const j = (await res.json()) as {
      ok?: boolean;
      result?: { status?: string };
      description?: string;
    };
    if (!j.ok) return { ok: false, error: j.description || "telegram_error" };
    const status = j.result?.status ?? "";
    const member = ["creator", "administrator", "member", "restricted"].includes(status);
    return { ok: member, status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

export const ownerVerifyJoinProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegramUserId: string; channelId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return verifyTelegramChannelMembership({
      telegramUserId: data.telegramUserId,
      channelId: data.channelId,
    });
  });

export const getWebhookHealthBadge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) {
      return { status: "fail" as const, detail: "TELEGRAM_BOT_TOKEN missing", url: null };
    }
    try {
      const j = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) =>
        r.json(),
      );
      const info = j?.result ?? {};
      const url = (info.url as string) || null;
      const lastErr = (info.last_error_message as string) || null;
      const pending = Number(info.pending_update_count ?? 0);
      let age = "";
      if (info.last_error_date) {
        const mins = Math.max(0, Math.round((Date.now() / 1000 - Number(info.last_error_date)) / 60));
        age = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
      }
      if (!url) return { status: "warn" as const, detail: "Webhook not registered", url: null, pending };
      if (lastErr)
        return {
          status: "fail" as const,
          detail: `${lastErr.slice(0, 80)}${age ? ` · ${age}` : ""}`,
          url,
          pending,
        };
      return {
        status: pending > 50 ? ("warn" as const) : ("ok" as const),
        detail: `Live · pending ${pending}`,
        url,
        pending,
      };
    } catch (e) {
      return {
        status: "warn" as const,
        detail: e instanceof Error ? e.message : "probe failed",
        url: null,
      };
    }
  });
