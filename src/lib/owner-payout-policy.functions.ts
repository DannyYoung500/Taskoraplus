/**
 * Payout policy + cron digest (owner strong controls).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner, audit } from "@/lib/owner-guard.server";

/** Read / write payout risk + geo policy (owner only). */
export const ownerGetPayoutPolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { loadPayoutPolicy } = await import("@/lib/strong-guards");
    return loadPayoutPolicy();
  });

export const ownerSetPayoutPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      risk_force_dual?: number;
      risk_auto_freeze?: number;
      max_withdrawals_per_day?: number;
      country_deny?: string[];
      country_allow?: string[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { loadPayoutPolicy } = await import("@/lib/strong-guards");
    const prev = await loadPayoutPolicy();
    const next = {
      risk_force_dual:
        data.risk_force_dual != null
          ? Math.max(0, Math.min(100, Number(data.risk_force_dual)))
          : prev.risk_force_dual,
      risk_auto_freeze:
        data.risk_auto_freeze != null
          ? Math.max(0, Math.min(100, Number(data.risk_auto_freeze)))
          : prev.risk_auto_freeze,
      max_withdrawals_per_day:
        data.max_withdrawals_per_day != null
          ? Math.max(1, Math.min(20, Number(data.max_withdrawals_per_day)))
          : prev.max_withdrawals_per_day,
      country_deny: Array.isArray(data.country_deny)
        ? data.country_deny.map((c) => String(c).toUpperCase().slice(0, 2)).filter(Boolean)
        : prev.country_deny,
      country_allow: Array.isArray(data.country_allow)
        ? data.country_allow.map((c) => String(c).toUpperCase().slice(0, 2)).filter(Boolean)
        : prev.country_allow,
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert(
      { key: "payout_policy", value: next } as never,
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await audit({
      adminId: context.userId,
      action: "payout_policy.update",
      targetType: "settings",
      targetId: "payout_policy",
      previous: prev,
      next,
    }).catch(() => undefined);
    return { ok: true, policy: next };
  });

/** Cron-friendly ops digest (CRON_SECRET or TASKORA_CRON_SECRET header). */
export const cronOpsDigest = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const secret = process.env["CRON_SECRET"] ?? process.env["TASKORA_CRON_SECRET"] ?? "";
      const hdr = req?.headers?.get("x-cron-secret") ?? req?.headers?.get("authorization") ?? "";
      const okCron = Boolean(secret && (hdr === secret || hdr === `Bearer ${secret}`));
      if (!okCron) throw new Error("cron_auth_required");
    } catch (e) {
      if (e instanceof Error && e.message === "cron_auth_required") throw e;
      throw new Error("Cron auth failed.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ONLINE_MS } = await import("@/lib/locale-geo");
    const now = Date.now();
    const since24 = new Date(now - 86_400_000).toISOString();
    const [profilesRes, wdRes, subRes, flagsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, last_active_at, created_at, country_code")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin.from("withdrawals").select("id, amount", { count: "exact" }).eq("status", "pending"),
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("fraud_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    const rows = profilesRes.data ?? [];
    let online = 0;
    let new24h = 0;
    for (const p of rows) {
      const last = (p as { last_active_at?: string | null }).last_active_at;
      if (last) {
        const t = new Date(last).getTime();
        if (Number.isFinite(t) && now - t <= ONLINE_MS) online += 1;
      }
      const created = (p as { created_at?: string }).created_at;
      if (created && created >= since24) new24h += 1;
    }
    const pendingWd = wdRes.count ?? 0;
    const pendingAmt = (wdRes.data ?? []).reduce(
      (s, w) => s + Number((w as { amount?: number }).amount ?? 0),
      0,
    );
    const msg =
      `📊 <b>TASKORA Cron Digest</b>\n` +
      `Online: <b>${online}</b> · New 24h: <b>${new24h}</b>\n` +
      `Pending WD: <b>${pendingWd}</b> ($${pendingAmt.toFixed(2)})\n` +
      `Pending reviews: <b>${subRes.count ?? 0}</b> · Fraud: <b>${flagsRes.count ?? 0}</b>\n` +
      `Time: ${new Date().toISOString()}`;
    const { sendOwnerHtml } = await import("@/lib/notify-owner");
    await sendOwnerHtml(msg);
    return { ok: true, online, new24h, pendingWd, pendingAmt };
  });
