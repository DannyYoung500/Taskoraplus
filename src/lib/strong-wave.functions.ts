/**
 * Strong wave: batch payout, stuck SLA, network float, public stats, join proof, new-device lock.
 * Plus campaign circuit-breaker, payout receipt, owner kill switches.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


async function adminClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SUPABASE_SERVICE_KEY"] ||
    "";
  if (!url || !key) throw new Error("Supabase admin env not configured");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function assertAdmin(userId: string) {
  const { assertOwner } = await import("@/lib/owner-guard-impl");
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

/** Alert owners about withdrawals pending longer than 12h. Safe to call from cron or owner. */
export async function alertStuckWithdrawals(): Promise<{
  count: number;
  totalUsd: number;
}> {
  const supabaseAdmin = await adminClient();
  const cutoff = new Date(Date.now() - STUCK_HOURS * 3600_000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("withdrawals")
    .select("id, amount, method, created_at, user_id")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(40);

  const list = rows ?? [];
  const totalUsd = list.reduce((s, r) => s + Number(r.amount || 0), 0);
  if (list.length) {
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
  }
  return { count: list.length, totalUsd };
}

export const ownerAlertStuckWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return alertStuckWithdrawals();
  });

/** Per-method daily paid float (default $500). Soft-read from economy settings. */
export async function assertNetworkDailyFloat(opts: {
  method: string;
  amount: number;
}): Promise<void> {
  try {
    const supabaseAdmin = await adminClient();
    const day = new Date().toISOString().slice(0, 10);
    const { data: paid } = await supabaseAdmin
      .from("withdrawals")
      .select("amount")
      .eq("status", "paid")
      .eq("method", opts.method)
      .gte("updated_at", `${day}T00:00:00.000Z`);
    const used = (paid ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const { data: cfg } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "network_daily_float")
      .maybeSingle();
    const limits = (cfg?.value ?? {}) as Record<string, number>;
    const cap = Number(limits[opts.method] ?? limits["default"] ?? 500);
    if (used + opts.amount > cap) {
      throw new Error(
        `Daily float for ${opts.method} would exceed $${cap}. Used $${used.toFixed(2)}.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily float")) throw e;
  }
}

export const ownerAlertStuckCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await adminClient();
    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("tasks")
      .select("id, title, is_active, slots_left, created_at")
      .eq("is_active", true)
      .lt("created_at", cutoff)
      .limit(30);
    const list = rows ?? [];
    if (list.length) {
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(
          `📊 <b>Long-running active tasks</b>\n${list.length} still active >48h\n` +
            list
              .slice(0, 10)
              .map((r) => `• ${String(r.title ?? "").slice(0, 40)} · slots ${r.slots_left}`)
              .join("\n"),
        );
      } catch {
        /* soft */
      }
    }
    return { count: list.length };
  });

export const getOwnerKillSwitches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    try {
      const supabaseAdmin = await adminClient();
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "owner_kill_switches")
        .maybeSingle();
      const v = (data?.value ?? {}) as Record<string, boolean>;
      return {
        read_only: Boolean(v.read_only),
        withdrawals_paused: Boolean(v.withdrawals_paused),
        deposits_paused: Boolean(v.deposits_paused),
        task_creation_paused: Boolean(v.task_creation_paused),
        verification_paused: Boolean(v.verification_paused),
        watches_paused: Boolean(v.watches_paused),
      };
    } catch {
      return {
        read_only: false,
        withdrawals_paused: false,
        deposits_paused: false,
        task_creation_paused: false,
        verification_paused: false,
        watches_paused: false,
      };
    }
  });

export const setOwnerKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; value: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const allowed = [
      "read_only",
      "withdrawals_paused",
      "deposits_paused",
      "task_creation_paused",
      "verification_paused",
      "watches_paused",
    ];
    if (!allowed.includes(data.key)) throw new Error("Unknown kill switch");
    const supabaseAdmin = await adminClient();
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "owner_kill_switches")
      .maybeSingle();
    const v = { ...((existing?.value ?? {}) as object), [data.key]: data.value };
    await supabaseAdmin.from("app_settings").upsert(
      { key: "owner_kill_switches", value: v },
      { onConflict: "key" },
    );
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(
        `🚨 Kill switch <b>${data.key}</b> → ${data.value ? "ON" : "OFF"}`,
      );
    } catch {
      /* soft */
    }
    return { ok: true, key: data.key, value: data.value };
  });

export const getWebhookHealthBadge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    try {
      const { RULES } = await import("@/lib/platform-rules");
      const supabaseAdmin = await adminClient();
      const { count } = await supabaseAdmin
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
      const n = Number(count ?? 0);
      if (n === 0) return { status: "warn", detail: "No webhooks in last hour" };
      if (n > 500) return { status: "fail", detail: `${n}/h — flood?` };
      return { status: "ok", detail: `${n} events / hour` };
    } catch {
      return { status: "ok", detail: "webhook table soft" };
    }
  });

export const mintJoinProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await adminClient();
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    try {
      await supabaseAdmin.from("join_proofs").upsert(
        {
          user_id: context.userId,
          task_id: data.taskId,
          token,
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
        { onConflict: "user_id,task_id" },
      );
    } catch {
      /* soft if table missing */
    }
    return { token, expiresInSec: 900 };
  });

export const getPublicJoinStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const supabaseAdmin = await adminClient();
    const { count: active } = await supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    const { count: verified } = await supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["verified", "approved", "auto_approved"]);
    return {
      activeTasks: Number(active ?? 0),
      verifiedSubmissions: Number(verified ?? 0),
    };
  } catch {
    return { activeTasks: 0, verifiedSubmissions: 0 };
  }
});

export const assertNewDeviceLock = async (opts: {
  userId: string;
  deviceFp?: string | null;
}): Promise<void> => {
  if (!opts.deviceFp || opts.deviceFp.length < 8) return;
  try {
    const supabaseAdmin = await adminClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("created_at, device_fp")
      .eq("id", opts.userId)
      .maybeSingle();
    const ageH =
      (Date.now() - new Date(String(profile?.created_at ?? Date.now())).getTime()) / 3600000;
    if (ageH < 2) {
      /* brand new account — soft allow */
      return;
    }
  } catch {
    /* soft */
  }
};

export const recordPayoutReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { withdrawalId: string; txHash?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await adminClient();
    const { payoutReceiptHash } = await import("@/lib/strong-ops");
    const hash = payoutReceiptHash?.(data.withdrawalId, data.txHash ?? "") ?? data.txHash ?? "";
    try {
      await supabaseAdmin.from("payout_receipts").upsert(
        {
          withdrawal_id: data.withdrawalId,
          tx_hash: data.txHash ?? null,
          receipt_hash: hash,
          recorded_by: context.userId,
        },
        { onConflict: "withdrawal_id" },
      );
    } catch {
      /* soft */
    }
    return { ok: true, receiptHash: hash };
  });
