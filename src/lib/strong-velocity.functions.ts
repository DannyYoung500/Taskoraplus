/**
 * Strong Velocity — burst detection, session integrity, multi-tab abuse.
 * Build-safe (Web Crypto only). Soft-fail friendly for owner tooling.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Max actions of a given kind in a short window before soft hold */
const BURST_LIMITS: Record<string, { windowSec: number; max: number }> = {
  submit: { windowSec: 120, max: 4 },
  watch_complete: { windowSec: 60, max: 3 },
  withdraw_request: { windowSec: 3600, max: 2 },
  connect_account: { windowSec: 600, max: 5 },
  referral_claim: { windowSec: 300, max: 3 },
};

/**
 * Record an action and throw if burst limit exceeded.
 * Stores in action_velocity table (user_id, kind, created_at).
 */
export async function assertVelocityBurstOk(opts: {
  userId: string;
  kind: keyof typeof BURST_LIMITS | string;
  isOwner?: boolean;
}): Promise<{ ok: true; count: number }> {
  if (opts.isOwner) return { ok: true, count: 0 };
  const limit = BURST_LIMITS[opts.kind] ?? { windowSec: 120, max: 6 };
  const s = await adminClient();
  const since = new Date(Date.now() - limit.windowSec * 1000).toISOString();

  try {
    await s.from("action_velocity").insert({
      user_id: opts.userId,
      kind: opts.kind,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* table may not exist yet — soft */
  }

  try {
    const { count } = await s
      .from("action_velocity")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .eq("kind", opts.kind)
      .gte("created_at", since);

    const n = count ?? 0;
    if (n > limit.max) {
      throw new Error(
        `Too many ${opts.kind} actions in a short time. Wait a moment and try again.`,
      );
    }
    return { ok: true, count: n };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Too many")) throw e;
    return { ok: true, count: 0 };
  }
}

/**
 * Session integrity token — binds a short-lived nonce to user + action.
 * Client mints via getSessionIntegrityToken; server asserts on money paths.
 */
export async function mintSessionIntegrityToken(opts: {
  userId: string;
  action: string;
  ttlSec?: number;
}): Promise<string> {
  const ttl = opts.ttlSec ?? 300;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const nonceHex = Array.from(nonce)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const payload = `${opts.userId}|${opts.action}|${exp}|${nonceHex}`;
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const sig = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  return `${exp}.${nonceHex}.${sig}`;
}

export async function assertSessionIntegrityToken(opts: {
  userId: string;
  action: string;
  token: string | null | undefined;
}): Promise<void> {
  if (!opts.token || typeof opts.token !== "string") {
    throw new Error("Session integrity required. Refresh and try again.");
  }
  const parts = opts.token.split(".");
  if (parts.length !== 3) throw new Error("Invalid session token.");
  const [expStr, nonceHex, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session expired. Refresh and try again.");
  }
  const payload = `${opts.userId}|${opts.action}|${exp}|${nonceHex}`;
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const expected = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  if (expected !== sig) {
    throw new Error("Session integrity check failed.");
  }
}

/** Client-callable: mint integrity token for a money action */
export const getSessionIntegrityToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const action = String((data as { action?: string })?.action ?? "generic");
    const token = await mintSessionIntegrityToken({
      userId: context.userId,
      action,
      ttlSec: 300,
    });
    return { token, expiresIn: 300 };
  });

/** Multi-tab / concurrent session soft flag */
export async function touchActiveSession(opts: {
  userId: string;
  sessionKey: string;
}): Promise<{ concurrent: number }> {
  const s = await adminClient();
  const now = new Date().toISOString();
  try {
    await s.from("active_sessions").upsert(
      {
        user_id: opts.userId,
        session_key: opts.sessionKey,
        last_seen: now,
      },
      { onConflict: "user_id,session_key" },
    );
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count } = await s
      .from("active_sessions")
      .select("session_key", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .gte("last_seen", cutoff);
    return { concurrent: count ?? 1 };
  } catch {
    return { concurrent: 1 };
  }
}

/**
 * SQL to run once (owner):
 *
 * create table if not exists action_velocity (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid not null references profiles(id),
 *   kind text not null,
 *   created_at timestamptz not null default now()
 * );
 * create index if not exists idx_action_velocity_user_kind_time
 *   on action_velocity(user_id, kind, created_at desc);
 *
 * create table if not exists active_sessions (
 *   user_id uuid not null references profiles(id),
 *   session_key text not null,
 *   last_seen timestamptz not null default now(),
 *   primary key (user_id, session_key)
 * );
 */
