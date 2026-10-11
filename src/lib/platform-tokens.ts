/**
 * Platform bot tokens — resolve from env (preferred) or owner-saved app_settings.
 * Never expose full secrets to the client. Owner dashboard can set Discord (and future) tokens.
 *
 * Security (aligned with Discord/Telegram bot best practices):
 * - Env vars win over DB (Vercel/hosting panel is primary)
 * - DB value is service-role only; UI only sees masked status
 * - Tokens never logged in full
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

const SETTINGS_KEY = "platform_tokens";

export type PlatformTokenKey =
  | "discord_bot_token"
  | "telegram_bot_token"
  | "youtube_api_key";

type TokenBag = Partial<Record<PlatformTokenKey, string>>;

function mask(s: string, keep = 4): string {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= keep * 2) return "***";
  return `${t.slice(0, keep)}…${t.slice(-keep)}`;
}

async function readDbTokens(): Promise<TokenBag> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    const v = (data as { value?: TokenBag } | null)?.value;
    if (v && typeof v === "object") return v;
  } catch {
    /* soft */
  }
  return {};
}

/** Resolve Discord bot token: env first, then owner-saved app_settings. */
export async function resolveDiscordBotToken(): Promise<string | null> {
  const env = (process.env["DISCORD_BOT_TOKEN"] || "").trim();
  if (env) return env;
  const db = await readDbTokens();
  const t = String(db.discord_bot_token || "").trim();
  return t || null;
}

/** Resolve Telegram bot token: env first, then owner-saved (optional override). */
export async function resolveTelegramBotToken(): Promise<string | null> {
  const env =
    process.env["TELEGRAM_BOT_TOKEN"] ||
    process.env["BOT_TOKEN"] ||
    process.env["TG_BOT_TOKEN"] ||
    "";
  if (env.trim()) return env.trim();
  const db = await readDbTokens();
  const t = String(db.telegram_bot_token || "").trim();
  return t || null;
}

/** Source label for status UI */
export type TokenSource = "env" | "dashboard" | "none";

export async function getTokenStatus(): Promise<{
  discord: {
    configured: boolean;
    source: TokenSource;
    masked: string | null;
  };
  telegram: {
    configured: boolean;
    source: TokenSource;
    masked: string | null;
  };
}> {
  const envDc = (process.env["DISCORD_BOT_TOKEN"] || "").trim();
  const envTg = (
    process.env["TELEGRAM_BOT_TOKEN"] ||
    process.env["BOT_TOKEN"] ||
    process.env["TG_BOT_TOKEN"] ||
    ""
  ).trim();
  const db = await readDbTokens();
  const dbDc = String(db.discord_bot_token || "").trim();
  const dbTg = String(db.telegram_bot_token || "").trim();

  return {
    discord: {
      configured: Boolean(envDc || dbDc),
      source: envDc ? "env" : dbDc ? "dashboard" : "none",
      masked: envDc ? mask(envDc) : dbDc ? mask(dbDc) : null,
    },
    telegram: {
      configured: Boolean(envTg || dbTg),
      source: envTg ? "env" : dbTg ? "dashboard" : "none",
      masked: envTg ? mask(envTg) : dbTg ? mask(dbTg) : null,
    },
  };
}

export const ownerGetPlatformTokenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return getTokenStatus();
  });

/**
 * Save a platform token from the owner dashboard.
 * Empty string clears the dashboard value (env still applies if set).
 * Never returns the raw token.
 */
export const ownerSetPlatformToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { key: PlatformTokenKey; value: string }) => d,
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const key = data.key;
    if (!["discord_bot_token", "telegram_bot_token", "youtube_api_key"].includes(key)) {
      throw new Error("Unsupported token key.");
    }
    const value = String(data.value || "").trim();
    // Basic sanity: Discord tokens are long; reject obvious paste mistakes
    if (value && key === "discord_bot_token" && value.length < 50) {
      throw new Error("Discord bot token looks too short. Paste the full token from the Discord Developer Portal → Bot.");
    }
    if (value && key === "telegram_bot_token" && !/^\d+:[A-Za-z0-9_-]{30,}$/.test(value)) {
      throw new Error("Telegram bot token format looks invalid (expect digits:alphanum from @BotFather).");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await readDbTokens();
    const next: TokenBag = { ...existing };
    if (!value) {
      delete next[key];
    } else {
      next[key] = value;
    }

    const { error } = await supabaseAdmin.from("app_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: next,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      } as never,
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.from("audit_log").insert({
        actor_id: context.userId,
        action: value ? "platform_token_set" : "platform_token_cleared",
        target_id: key,
        meta: { key, has_value: Boolean(value), masked: value ? mask(value) : null },
      } as never);
    } catch {
      /* soft */
    }

    return getTokenStatus();
  });

/** Probe Discord with current resolved token (env or dashboard). */
export const ownerTestDiscordToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const token = await resolveDiscordBotToken();
    if (!token) {
      return { ok: false as const, detail: "No Discord bot token (env or dashboard)." };
    }
    try {
      const r = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${token}`,
          "User-Agent": "TASKORA/2.0",
        },
        signal: AbortSignal.timeout(12_000),
      });
      const body = (await r.json()) as { id?: string; username?: string; message?: string };
      if (!r.ok) {
        return {
          ok: false as const,
          detail: body.message || `Discord API ${r.status}`,
        };
      }
      return {
        ok: true as const,
        detail: `Bot @${body.username || "?"} · id ${body.id || "?"}`,
        username: body.username ?? null,
        id: body.id ?? null,
      };
    } catch (e) {
      return {
        ok: false as const,
        detail: e instanceof Error ? e.message : "Network error",
      };
    }
  });

/** Probe Telegram with current resolved token. */
export const ownerTestTelegramToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const token = await resolveTelegramBotToken();
    if (!token) {
      return { ok: false as const, detail: "No Telegram bot token (env or dashboard)." };
    }
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(12_000),
      });
      const body = (await r.json()) as {
        ok?: boolean;
        result?: { username?: string; id?: number };
        description?: string;
      };
      if (!body.ok) {
        return { ok: false as const, detail: body.description || "getMe failed" };
      }
      return {
        ok: true as const,
        detail: `@${body.result?.username || "?"} · id ${body.result?.id ?? "?"}`,
        username: body.result?.username ?? null,
        id: body.result?.id ?? null,
      };
    } catch (e) {
      return {
        ok: false as const,
        detail: e instanceof Error ? e.message : "Network error",
      };
    }
  });
