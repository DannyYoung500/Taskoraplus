/**
 * Money session token — mint after valid Telegram initData,
 * require short-lived token on withdraw / high-value claims.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TOKEN_TTL_SEC = 15 * 60;
const TOKEN_BYTES = 24;

async function randomHex(bytes = TOKEN_BYTES): Promise<string> {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const mintMoneySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ context, data }) => {
    const initData = String(data.initData || "").trim();
    if (!initData) throw new Error("Re-open TASKORA from Telegram to continue.");

    const { assertHardInitDataForMoney } = await import("@/lib/telegram-initdata");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let expectedTg: number | null = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id")
        .eq("id", context.userId)
        .maybeSingle();
      const tg = Number((profile as { telegram_id?: number | string } | null)?.telegram_id || 0);
      if (tg > 0) expectedTg = tg;
    } catch {
      /* soft */
    }

    await assertHardInitDataForMoney({
      initData,
      expectedTelegramId: expectedTg,
      maxAgeSeconds: 300,
    });

    const token = await randomHex();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SEC * 1000).toISOString();

    try {
      await supabaseAdmin
        .from("profiles")
        .update({
          money_session_hash: tokenHash,
          money_session_expires_at: expiresAt,
        } as never)
        .eq("id", context.userId);
    } catch {
      /* column may not exist yet */
    }

    try {
      await supabaseAdmin.from("money_sessions").upsert(
        {
          user_id: context.userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" } as never,
      );
    } catch {
      /* table may not exist */
    }

    return { token, expiresAt, ttlSec: TOKEN_TTL_SEC };
  });

export async function assertMoneySession(opts: {
  userId: string;
  token: string | null | undefined;
}): Promise<void> {
  const token = String(opts.token || "").trim();
  if (!token || token.length < 16) {
    throw new Error("Security session expired. Re-open TASKORA from Telegram and try again.");
  }
  const tokenHash = await sha256Hex(token);
  const s = await admin();
  const now = new Date().toISOString();

  try {
    const { data: row } = await s
      .from("money_sessions")
      .select("token_hash, expires_at")
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (row) {
      const r = row as { token_hash?: string; expires_at?: string };
      if (r.token_hash === tokenHash && r.expires_at && r.expires_at > now) return;
      if (r.expires_at && r.expires_at <= now) {
        throw new Error("Security session expired. Re-open TASKORA from Telegram.");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Security session")) throw e;
  }

  try {
    const { data: profile } = await s
      .from("profiles")
      .select("money_session_hash, money_session_expires_at")
      .eq("id", opts.userId)
      .maybeSingle();
    const p = profile as {
      money_session_hash?: string | null;
      money_session_expires_at?: string | null;
    } | null;
    if (
      p?.money_session_hash === tokenHash &&
      p.money_session_expires_at &&
      p.money_session_expires_at > now
    ) {
      return;
    }
  } catch {
    /* soft */
  }

  throw new Error("Security session invalid. Re-open TASKORA from Telegram and try again.");
}

export const MONEY_SESSION_KEY = "taskora_money_session";

export function storeMoneySessionClient(token: string, expiresAt: string) {
  try {
    sessionStorage.setItem(MONEY_SESSION_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    /* soft */
  }
}

export function readMoneySessionClient(): string | null {
  try {
    const raw = sessionStorage.getItem(MONEY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; expiresAt?: string };
    if (!parsed.token) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      sessionStorage.removeItem(MONEY_SESSION_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}
