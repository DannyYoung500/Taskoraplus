import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(userId: string) {
  const { assertOwner, admin } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return admin();
}

async function audit(
  adminId: string,
  action: string,
  rest: { targetType?: string; targetId?: string; previous?: unknown; next?: unknown } = {},
) {
  const { audit: a } = await import("@/lib/owner-guard.server");
  await a({ adminId, action, ...rest });
}

export const getEconomySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data } = await (db as any).from("economy_settings").select("*").eq("id", true).maybeSingle();
    const { data: prices } = await (db as any)
      .from("task_price_catalog")
      .select("*")
      .eq("is_active", true)
      .order("platform");
    return {
      settings: data ?? {
        min_withdrawal: 10,
        min_advertiser_deposit: 5,
        referral_commission_pct: 5,
        daily_checkin_xp: 10,
        daily_checkin_cash: 0,
        withdrawal_fee_pct: 0,
        version: 1,
      },
      prices: prices ?? [],
    };
  });

export const saveEconomySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      min_withdrawal: number;
      min_advertiser_deposit: number;
      referral_commission_pct: number;
      daily_checkin_xp: number;
      withdrawal_fee_pct: number;
      reason: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    if (!data.reason.trim()) throw new Error("Reason is required for economy changes.");
    const db = await guard(context.userId);
    const { data: prev } = await (db as any).from("economy_settings").select("*").eq("id", true).maybeSingle();
    const payload = {
      id: true,
      min_withdrawal: Math.max(0, Number(data.min_withdrawal)),
      min_advertiser_deposit: Math.max(0, Number(data.min_advertiser_deposit)),
      referral_commission_pct: Math.max(0, Math.min(50, Number(data.referral_commission_pct))),
      daily_checkin_xp: Math.max(0, Math.floor(Number(data.daily_checkin_xp))),
      daily_checkin_cash: 0,
      withdrawal_fee_pct: Math.max(0, Math.min(20, Number(data.withdrawal_fee_pct))),
      version: Number(prev?.version ?? 0) + 1,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
      reason: data.reason.trim(),
    };
    const { error } = await (db as any).from("economy_settings").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await audit(context.userId, "economy.settings_update", {
      targetType: "economy_settings",
      previous: prev,
      next: payload,
    });
    return payload;
  });

export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data: flags } = await (db as any).from("feature_flags").select("*").order("key");
    const { data: maint } = await (db as any)
      .from("maintenance_modes")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    return {
      flags: flags ?? [],
      maintenance: maint ?? {
        read_only: false,
        withdrawals_paused: false,
        deposits_paused: false,
        task_creation_paused: false,
        verification_paused: false,
      },
    };
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { error } = await (db as any)
      .from("feature_flags")
      .update({
        enabled: data.enabled,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    await audit(context.userId, "feature_flag.toggle", {
      targetType: "feature_flag",
      targetId: data.key,
      next: { enabled: data.enabled },
    });
    return { ok: true };
  });

export const setMaintenanceMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      read_only?: boolean;
      withdrawals_paused?: boolean;
      deposits_paused?: boolean;
      task_creation_paused?: boolean;
      verification_paused?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const payload = {
      id: true,
      ...data,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (db as any).from("maintenance_modes").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await audit(context.userId, "maintenance.update", { next: payload });
    return payload;
  });

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const limit = Math.min(200, Math.max(20, data.limit ?? 80));
    const { data: rows, error } = await db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    const s = data.search?.trim().toLowerCase();
    if (!s) return rows ?? [];
    return (rows ?? []).filter((r) => JSON.stringify(r).toLowerCase().includes(s));
  });

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const checks: Array<{ name: string; status: "ok" | "warn" | "fail"; detail: string }> = [];

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("profiles").select("id").limit(1);
      checks.push({
        name: "Postgres",
        status: error ? "fail" : "ok",
        detail: error ? error.message : "Reachable",
      });
      checks.push({ name: "Supabase Auth", status: "ok", detail: "Service client active" });
    } catch (e) {
      checks.push({
        name: "Postgres",
        status: "fail",
        detail: e instanceof Error ? e.message : "Unreachable",
      });
    }

    const bot = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    if (!bot) {
      checks.push({ name: "Telegram Bot API", status: "warn", detail: "TELEGRAM_BOT_TOKEN missing" });
    } else {
      try {
        const res = await fetch(`https://api.telegram.org/bot${bot}/getMe`);
        const json = (await res.json()) as { ok?: boolean; result?: { username?: string } };
        checks.push({
          name: "Telegram Bot API",
          status: json.ok ? "ok" : "fail",
          detail: json.ok ? `@${json.result?.username ?? "bot"}` : "Token rejected",
        });
      } catch {
        checks.push({ name: "Telegram Bot API", status: "fail", detail: "Network error" });
      }
    }

    checks.push({
      name: "Owner IDs",
      status: process.env["TASKORA_OWNER_TELEGRAM_IDS"] ? "ok" : "warn",
      detail: process.env["TASKORA_OWNER_TELEGRAM_IDS"] ? "Configured" : "TASKORA_OWNER_TELEGRAM_IDS empty",
    });

    checks.push({
      name: "Deployment",
      status: "ok",
      detail: process.env["VERCEL_ENV"] ?? process.env["NODE_ENV"] ?? "runtime",
    });

    checks.push({
      name: "Payment provider",
      status: "warn",
      detail: "Not wired — manual settlements",
    });

    checks.push({
      name: "Social verification APIs",
      status: "warn",
      detail: "Manual / code-in-bio path only",
    });

    const overall = checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "warn")
        ? "warn"
        : "ok";

    return { overall, checks, checkedAt: new Date().toISOString() };
  });
