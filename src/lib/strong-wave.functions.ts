/**
 * Strong wave: batch payout, stuck SLA, network float, public stats, join proof, new-device lock.
 * Plus campaign circuit-breaker, payout receipt, owner kill switches, elite cron.
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
        const txHash = data.txHashPrefix?.trim() ? `${data.txHashPrefix.trim()}-${i + 1}` : undefined;
        await reviewWithdrawal({ data: { withdrawalId: id, decision: "paid", txHash } } as never);
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: e instanceof Error ? e.message : "failed" });
      }
    }
    return { ok: results.every((r) => r.ok), paid: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  });

const STUCK_HOURS = 12;

export async function alertStuckWithdrawals(): Promise<{ count: number; totalUsd: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - STUCK_HOURS * 3600_000).toISOString();
  const { data: rows } = await supabaseAdmin.from("withdrawals").select("id, amount, method, created_at, user_id").eq("status", "pending").lt("created_at", cutoff).order("created_at", { ascending: true }).limit(40);
  const list = rows ?? [];
  const totalUsd = list.reduce((s, r) => s + Number(r.amount), 0);
  if (list.length === 0) return { count: 0, totalUsd: 0 };
  try {
    const { sendOwnerHtml } = await import("@/lib/notify-owner");
    const lines = list.slice(0, 12).map((r) => {
      const ageH = Math.round((Date.now() - new Date(String(r.created_at)).getTime()) / 3600000);
      return `• $${Number(r.amount).toFixed(2)} ${r.method} · ${ageH}h · <code>${String(r.id).slice(0, 8)}</code>`;
    }).join("\n");
    await sendOwnerHtml(`⏰ <b>Stuck withdrawals (≥${STUCK_HOURS}h)</b>\n${list.length} pending · ~$${totalUsd.toFixed(2)}\n${lines}`);
  } catch { /* soft */ }
  return { count: list.length, totalUsd };
}

export const ownerAlertStuckWithdrawals = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.userId);
  return alertStuckWithdrawals();
});

export async function assertNetworkDailyFloat(opts: { method: string; amount: number }): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let limit = 500;
    const { data: econ } = await supabaseAdmin.from("app_settings").select("value").eq("key", "economy").maybeSingle();
    const v = (econ?.value ?? {}) as Record<string, unknown>;
    const map = (v.network_daily_float as Record<string, number> | undefined) ?? {};
    const methodKey = opts.method.toUpperCase().replace(/\s+/g, "_");
    limit = Math.max(50, Number(map[methodKey] ?? map[opts.method] ?? v.default_network_daily_float ?? 500));
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data: paid } = await supabaseAdmin.from("withdrawals").select("amount").eq("status", "paid").eq("method", opts.method).gte("processed_at", since.toISOString());
    const used = (paid ?? []).reduce((s, r) => s + Number(r.amount), 0);
    if (used + opts.amount > limit) {
      throw new Error(`Daily float for ${opts.method} is $${limit.toFixed(0)}. Already paid $${used.toFixed(2)} today. Try later or contact support.`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily float")) throw e;
  }
}

export async function applyNewDeviceWithdrawalLock(opts: { userId: string; amount: number; requiresDual: boolean }): Promise<{ requiresDual: boolean; blocked?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("device_fp, last_seen_at, created_at").eq("id", opts.userId).maybeSingle();
    const fp = (prof as { device_fp?: string } | null)?.device_fp;
    if (!fp) return { requiresDual: opts.requiresDual };
    const { data: history } = await supabaseAdmin.from("withdrawals").select("id, created_at").eq("user_id", opts.userId).in("status", ["paid", "completed", "approved"]).limit(1);
    const hasPaidBefore = (history ?? []).length > 0;
    if (!hasPaidBefore && opts.amount > 5) {
      return { requiresDual: true, blocked: opts.amount > 25 ? "New-device limit: first withdrawals over $25 need support review. Start with ≤ $5." : undefined };
    }
  } catch { /* soft */ }
  return { requiresDual: opts.requiresDual };
}

export const getPublicPlatformStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const day = new Date(Date.now() - 86400_000).toISOString();
    const [verifiedToday, paidWeek] = await Promise.all([
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "approved").gte("updated_at", day),
      supabaseAdmin.from("withdrawals").select("amount").eq("status", "paid").gte("processed_at", since),
    ]);
    const paidUsd = (paidWeek.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    return { verifiedToday: verifiedToday.count ?? 0, paidWeekUsd: Math.round(paidUsd * 100) / 100 };
  } catch {
    return { verifiedToday: 0, paidWeekUsd: 0 };
  }
});

export async function verifyTelegramChannelMembership(opts: { telegramUserId: number | string; channelId: string }): Promise<{ ok: boolean; status?: string; error?: string }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { ok: false, error: "bot_token_missing" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(opts.channelId)}&user_id=${opts.telegramUserId}`);
    const j = (await res.json()) as { ok?: boolean; result?: { status?: string }; description?: string };
    if (!j.ok) return { ok: false, error: j.description || "telegram_error" };
    const status = j.result?.status ?? "";
    const member = ["creator", "administrator", "member", "restricted"].includes(status);
    return { ok: member, status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

export const ownerVerifyJoinProof = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { telegramUserId: string; channelId: string }) => d).handler(async ({ data, context }) => {
  await assertAdmin(context.userId);
  return verifyTelegramChannelMembership({ telegramUserId: data.telegramUserId, channelId: data.channelId });
});

export const getWebhookHealthBadge = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.userId);
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { status: "fail" as const, detail: "TELEGRAM_BOT_TOKEN missing", url: null };
  try {
    const j = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
    const info = j?.result ?? {};
    const url = (info.url as string) || null;
    const lastErr = (info.last_error_message as string) || null;
    const pending = Number(info.pending_update_count ?? 0);
    if (!url) return { status: "warn" as const, detail: "Webhook not registered", url: null, pending };
    if (lastErr) return { status: "fail" as const, detail: lastErr.slice(0, 80), url, pending };
    return { status: pending > 50 ? ("warn" as const) : ("ok" as const), detail: `Live · pending ${pending}`, url, pending };
  } catch (e) {
    return { status: "warn" as const, detail: e instanceof Error ? e.message : "probe failed", url: null };
  }
});

export async function alertStuckCampaigns(): Promise<{ count: number }> {
  try {
    const { RULES } = await import("@/lib/platform-rules");
    const hours = RULES.campaignStuckHours;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data: rows } = await supabaseAdmin.from("campaigns").select("id, status, created_at, title").eq("status", "active").lt("created_at", cutoff).limit(30);
    const list = rows ?? [];
    if (!list.length) return { count: 0 };
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      const lines = list.slice(0, 10).map((r) => `• <code>${String(r.id).slice(0, 8)}</code> ${String((r as { title?: string }).title ?? "campaign").slice(0, 40)}`).join("\n");
      await sendOwnerHtml(`📢 <b>Stuck campaigns (≥${hours}h active)</b>\n${list.length} campaigns may need review\n${lines}`);
    } catch { /* soft */ }
    return { count: list.length };
  } catch {
    return { count: 0 };
  }
}

export const ownerAlertStuckCampaigns = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.userId);
  return alertStuckCampaigns();
});

export async function assertCampaignSpendCircuit(opts: { campaignId: string }): Promise<{ ok: boolean; paused?: boolean; reason?: string }> {
  try {
    const { RULES } = await import("@/lib/platform-rules");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("campaigns").select("id, status, budget_usd, spent_usd, title").eq("id", opts.campaignId).maybeSingle();
    if (!c) return { ok: true };
    const budget = Number((c as { budget_usd?: number }).budget_usd ?? 0);
    const spent = Number((c as { spent_usd?: number }).spent_usd ?? 0);
    if (budget <= 0) return { ok: true };
    const limit = budget * RULES.campaignSpendCircuitMultiplier;
    if (spent >= limit) {
      await supabaseAdmin.from("campaigns").update({ status: "paused" } as never).eq("id", opts.campaignId).eq("status", "active");
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(`⛔ <b>Campaign circuit-breaker</b>\n<code>${opts.campaignId.slice(0, 8)}</code> paused\nSpent $${spent.toFixed(2)} / budget $${budget.toFixed(2)}`);
      } catch { /* soft */ }
      return { ok: false, paused: true, reason: "Campaign paused: spend limit reached. Contact advertiser/owner." };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function attachPayoutReceipt(opts: { withdrawalId: string; address: string; amount: number; method: string; txHash?: string | null }): Promise<{ receiptHash: string }> {
  const { payoutReceiptHash } = await import("@/lib/strong-ops");
  const receiptHash = payoutReceiptHash(opts);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("withdrawals").update({ receipt_hash: receiptHash, processed_at: new Date().toISOString() } as never).eq("id", opts.withdrawalId);
  } catch { /* column may not exist */ }
  return { receiptHash };
}

export const getOwnerKillSwitches = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.userId);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "maintenance_switches").maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return { read_only: Boolean(v.read_only), withdrawals_paused: Boolean(v.withdrawals_paused), deposits_paused: Boolean(v.deposits_paused), task_creation_paused: Boolean(v.task_creation_paused), verification_paused: Boolean(v.verification_paused), watches_paused: Boolean(v.watches_paused) };
  } catch {
    return { read_only: false, withdrawals_paused: false, deposits_paused: false, task_creation_paused: false, verification_paused: false, watches_paused: false };
  }
});

export const setOwnerKillSwitch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { key: "read_only" | "withdrawals_paused" | "deposits_paused" | "task_creation_paused" | "verification_paused" | "watches_paused"; value: boolean }) => d).handler(async ({ data, context }) => {
  await assertAdmin(context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin.from("app_settings").select("value").eq("key", "maintenance_switches").maybeSingle();
  const cur = { ...((existing?.value ?? {}) as Record<string, unknown>) };
  cur[data.key] = data.value;
  const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "maintenance_switches", value: cur, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { ok: true, switches: cur };
});

/** Daily strong-ops cron: stuck WDs + stuck campaigns + webhook + clusters + task SLA. */
export const runStrongOpsCron = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [wd, camps, webhook, clusters, taskSla] = await Promise.all([
      alertStuckWithdrawals(),
      alertStuckCampaigns(),
      (async () => {
        try {
          const token = process.env["TELEGRAM_BOT_TOKEN"];
          if (!token) return { status: "fail" as const, detail: "no token" };
          const j = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
          const info = j?.result ?? {};
          const lastErr = (info.last_error_message as string) || null;
          return { status: lastErr ? ("fail" as const) : ("ok" as const), detail: lastErr ? lastErr.slice(0, 80) : `pending ${info.pending_update_count ?? 0}` };
        } catch (e) {
          return { status: "warn" as const, detail: e instanceof Error ? e.message : "probe failed" };
        }
      })(),
      (async () => {
        try {
          const { detectAndAlertMultiAccountClusters } = await import("@/lib/strong-elite.functions");
          return await detectAndAlertMultiAccountClusters({ minClusterSize: 3 });
        } catch {
          return { clusters: 0, alerted: false };
        }
      })(),
      (async () => {
        try {
          const { runStuckTaskSla } = await import("@/lib/strong-plus.functions");
          return await runStuckTaskSla();
        } catch {
          return { flagged: 0 };
        }
      })(),
    ]);
    return {
      stuckWithdrawals: wd.count,
      stuckWithdrawalsUsd: wd.totalUsd,
      stuckCampaigns: camps.count,
      multiAccountClusters: Number((clusters as { clusters?: number }).clusters ?? 0),
      stuckTasks: Number((taskSla as { flagged?: number }).flagged ?? 0),
      webhook,
      ranAt: new Date().toISOString(),
    };
  });
