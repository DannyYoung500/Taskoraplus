import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(userId: string) {
  const { assertOwner, admin } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return admin();
}

async function log(
  adminId: string,
  action: string,
  rest: {
    targetType?: string;
    targetId?: string;
    previous?: unknown;
    next?: unknown;
  } = {},
) {
  const { audit } = await import("@/lib/owner-guard.server");
  await audit({ adminId, action, ...rest });
}

function resolveSuggestedWebhookUrl(): string {
  const base =
    process.env["MINI_APP_URL"] ||
    process.env["PUBLIC_APP_URL"] ||
    (process.env["VERCEL_PROJECT_PRODUCTION_URL"]
      ? `https://${process.env["VERCEL_PROJECT_PRODUCTION_URL"]}`
      : "") ||
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "") ||
    "https://taskoraplus.app";
  return `${String(base).replace(/\/$/, "")}/api/telegram-webhook`;
}

function assertValidHttpsWebhook(url: string): string {
  const u = url.trim();
  if (!u) throw new Error("Webhook URL is empty.");
  if (!u.startsWith("https://")) {
    throw new Error("Telegram requires an HTTPS URL (https://…).");
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error("Webhook URL is not a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use https://");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
    throw new Error("Use a domain name, not a raw IP address.");
  }
  return u.replace(/\/$/, "");
}

export const ownerGetWebhookInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const suggestedUrl = resolveSuggestedWebhookUrl();
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) {
      return {
        configured: false as const,
        url: null as string | null,
        suggestedUrl,
        pending: 0,
        lastError: null as string | null,
        botUsername: null as string | null,
        error: "TELEGRAM_BOT_TOKEN not set on server",
      };
    }
    try {
      const [meRes, hookRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()),
        fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json()),
      ]);
      const info = hookRes?.result ?? {};
      return {
        configured: true as const,
        url: (info.url as string) || null,
        suggestedUrl,
        pending: Number(info.pending_update_count ?? 0),
        lastError: (info.last_error_message as string) || null,
        botUsername: meRes?.result?.username ?? null,
        error: meRes?.ok ? null : ((meRes?.description as string) ?? "Telegram API error"),
      };
    } catch (e) {
      return {
        configured: true as const,
        url: null,
        suggestedUrl,
        pending: 0,
        lastError: null,
        botUsername: null,
        error: e instanceof Error ? e.message : "Telegram unreachable",
      };
    }
  });

export const ownerRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url?: string | undefined; secret?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");

    let webhookUrl = (data.url ?? "").trim() || resolveSuggestedWebhookUrl();
    webhookUrl = assertValidHttpsWebhook(webhookUrl);

    let secret =
      (data.secret ?? "").trim() || process.env["TELEGRAM_WEBHOOK_SECRET"] || "";
    if (secret && (secret.length < 1 || secret.length > 256)) {
      secret = "";
    }

    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    };
    if (secret) body.secret_token = secret;

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

    if (!res?.ok) {
      const desc = String(res?.description || "Telegram setWebhook failed");
      if (/https/i.test(desc)) {
        throw new Error(
          `${desc} — use https://taskoraplus.app/api/telegram-webhook (public HTTPS domain).`,
        );
      }
      if (/certificate|ssl/i.test(desc)) {
        throw new Error(`${desc} — domain needs a valid public SSL certificate.`);
      }
      throw new Error(desc);
    }

    await log(context.userId, "telegram.webhook.register", {
      targetType: "webhook",
      next: { url: webhookUrl, hasSecret: Boolean(secret) },
    });

    return { ok: true as const, url: webhookUrl, description: res.description ?? "Webhook set" };
  });

export const ownerDeleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");

    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drop_pending_updates: false }),
    }).then((r) => r.json());

    if (!res?.ok) {
      throw new Error(res?.description || "Telegram deleteWebhook failed");
    }

    await log(context.userId, "telegram.webhook.delete", { targetType: "webhook" });
    return { ok: true as const };
  });

export type EconomySettings = {
  min_deposit_usd: number;
  min_withdrawal_usd: number;
  first_withdrawal_max_usd: number;
  platform_fee_pct: number;
  referral_pct: number;
  feature_boost_fee_usd: number;
  dual_approval_enabled: boolean;
  dual_approval_threshold_usd: number;
  payouts_paused: boolean;
  tasks_paused: boolean;
  watch_earn_enabled: boolean;
  watch_earn_rate_per_hour_usdt: number;
  watch_earn_daily_cap_usdt: number;
};

const DEFAULT_ECONOMY: EconomySettings = {
  min_deposit_usd: 5,
  min_withdrawal_usd: 3,
  first_withdrawal_max_usd: 5,
  platform_fee_pct: 15,
  referral_pct: 10,
  feature_boost_fee_usd: 1,
  dual_approval_enabled: true,
  dual_approval_threshold_usd: 20,
  payouts_paused: false,
  tasks_paused: false,
  watch_earn_enabled: true,
  watch_earn_rate_per_hour_usdt: 0.15,
  watch_earn_daily_cap_usdt: 2,
};

export const ownerGetEconomy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "economy")
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<EconomySettings>;
    return { ...DEFAULT_ECONOMY, ...v } satisfies EconomySettings;
  });

export const ownerSaveEconomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<EconomySettings>) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "economy")
      .maybeSingle();
    const current = {
      ...DEFAULT_ECONOMY,
      ...((prev?.value ?? {}) as Partial<EconomySettings>),
    };
    const next: EconomySettings = {
      min_deposit_usd: Math.max(0, Number(data.min_deposit_usd ?? current.min_deposit_usd)),
      min_withdrawal_usd: Math.max(
        0,
        Number(data.min_withdrawal_usd ?? current.min_withdrawal_usd),
      ),
      first_withdrawal_max_usd: Math.max(
        0,
        Number(data.first_withdrawal_max_usd ?? current.first_withdrawal_max_usd),
      ),
      platform_fee_pct: Math.min(
        50,
        Math.max(0, Number(data.platform_fee_pct ?? current.platform_fee_pct)),
      ),
      referral_pct: Math.min(50, Math.max(0, Number(data.referral_pct ?? current.referral_pct))),
      feature_boost_fee_usd: Math.max(
        0,
        Number(data.feature_boost_fee_usd ?? current.feature_boost_fee_usd),
      ),
      dual_approval_enabled: data.dual_approval_enabled ?? current.dual_approval_enabled,
      dual_approval_threshold_usd: Math.max(
        0,
        Number(data.dual_approval_threshold_usd ?? current.dual_approval_threshold_usd),
      ),
      payouts_paused: data.payouts_paused ?? current.payouts_paused,
      tasks_paused: data.tasks_paused ?? current.tasks_paused,
      watch_earn_enabled: data.watch_earn_enabled ?? current.watch_earn_enabled,
      watch_earn_rate_per_hour_usdt: Math.max(
        0,
        Number(data.watch_earn_rate_per_hour_usdt ?? current.watch_earn_rate_per_hour_usdt),
      ),
      watch_earn_daily_cap_usdt: Math.max(
        0,
        Number(data.watch_earn_daily_cap_usdt ?? current.watch_earn_daily_cap_usdt),
      ),
    };
    const { error } = await db.from("app_settings").upsert(
      {
        key: "economy",
        value: next as never,
        is_public: false,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await log(context.userId, "economy.update", {
      targetType: "settings",
      targetId: "economy",
      previous: prev?.value,
      next,
    });
    return { ok: true as const, economy: next };
  });
