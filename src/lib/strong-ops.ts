/**
 * Strong ops: proof dedup, device fingerprint multi-account, address allowlist 24h.
 * Soft-fail when optional columns / tables are missing.
 */
import { createHash } from "node:crypto";

export function hashProof(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export function fingerprintFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const ua = headers.get("user-agent") ?? "";
  const al = headers.get("accept-language") ?? "";
  const raw = `${ua}|${al}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/** Reject if same proof hash already used by any user (recycled screenshots). */
export async function assertProofNotRecycled(opts: {
  proofText?: string | null;
  proofUrl?: string | null;
  userId: string;
}): Promise<{ proofHash: string | null }> {
  const material = [opts.proofUrl, opts.proofText].filter(Boolean).join("|");
  if (!material || material.length < 8) return { proofHash: null };
  const proofHash = hashProof(material);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: byHash } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id, status")
      .eq("proof_hash", proofHash)
      .limit(3);
    if (byHash && byHash.length > 0) {
      const other = byHash.find((r) => r.user_id !== opts.userId);
      if (other) {
        throw new Error(
          "This proof was already used on another account. Submit original proof only.",
        );
      }
    }
    // Fallback: exact proof_url match across users
    if (opts.proofUrl) {
      const { data: byUrl } = await supabaseAdmin
        .from("submissions")
        .select("id, user_id")
        .eq("proof_url", opts.proofUrl.trim())
        .neq("user_id", opts.userId)
        .limit(1);
      if (byUrl && byUrl.length > 0) {
        throw new Error(
          "This proof link was already submitted by another user. Recycled proofs are blocked.",
        );
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("proof")) throw e;
    /* column may not exist — soft */
  }
  return { proofHash };
}

/** Record device fingerprint; flag multi-account clusters. */
export async function touchDeviceFingerprint(opts: {
  userId: string;
  fingerprint: string;
  ipHint?: string | null;
}): Promise<{ multiAccountCount: number; capped: boolean }> {
  if (!opts.fingerprint || opts.fingerprint.length < 8) {
    return { multiAccountCount: 1, capped: false };
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({
        device_fp: opts.fingerprint,
        last_ip_hint: (opts.ipHint ?? "").slice(0, 64) || null,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", opts.userId);

    const { data: siblings } = await supabaseAdmin
      .from("profiles")
      .select("id, status, wallet_frozen")
      .eq("device_fp", opts.fingerprint)
      .limit(20);

    const multi = (siblings ?? []).length;
    // Soft flag in app_settings risk notes — hard-cap withdrawals when ≥4 accounts share FP
    return { multiAccountCount: multi, capped: multi >= 4 };
  } catch {
    return { multiAccountCount: 1, capped: false };
  }
}

const ALLOWLIST_HOURS = 24;

/**
 * Address must be saved ≥24h before first payout to that address
 * (or already paid successfully once).
 */
export async function assertAddressAllowlisted(opts: {
  userId: string;
  address: string;
}): Promise<void> {
  const addr = opts.address.trim();
  if (!addr) throw new Error("Enter a valid wallet address.");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Already successfully paid to this address → allowed
    const { data: paid } = await supabaseAdmin
      .from("withdrawals")
      .select("id, created_at, status")
      .eq("user_id", opts.userId)
      .eq("address", addr)
      .in("status", ["paid", "completed", "approved"])
      .limit(1);
    if (paid && paid.length > 0) return;

    // Saved allowlist row
    const { data: saved } = await supabaseAdmin
      .from("payout_address_allowlist")
      .select("address, created_at")
      .eq("user_id", opts.userId)
      .eq("address", addr)
      .maybeSingle();

    if (saved?.created_at) {
      const ageMs = Date.now() - new Date(saved.created_at).getTime();
      const needMs = ALLOWLIST_HOURS * 60 * 60 * 1000;
      if (ageMs < needMs) {
        const hoursLeft = Math.ceil((needMs - ageMs) / 3600000);
        throw new Error(
          `New payout address is cooling down. Wait ~${hoursLeft}h after saving before first withdrawal to this address (anti-theft).`,
        );
      }
      return;
    }

    // Auto-save first time and require wait
    const { error: insErr } = await supabaseAdmin.from("payout_address_allowlist").upsert(
      {
        user_id: opts.userId,
        address: addr,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,address" },
    );
    if (insErr) {
      // Table missing — fall back: require any prior pending/paid withdrawal age
      const { data: anyWd } = await supabaseAdmin
        .from("withdrawals")
        .select("id, created_at")
        .eq("user_id", opts.userId)
        .eq("address", addr)
        .limit(1);
      if (anyWd && anyWd.length > 0) {
        const ageMs = Date.now() - new Date(anyWd[0]!.created_at).getTime();
        if (ageMs < ALLOWLIST_HOURS * 3600000) {
          throw new Error(
            `This address was just added. Wait 24h before the first payout (security cool-down).`,
          );
        }
        return;
      }
      // First ever address without allowlist table: soft-allow but log
      console.warn("[allowlist] payout_address_allowlist missing; soft-allow first address");
      return;
    }

    throw new Error(
      "Address saved. For security, wait 24 hours before the first withdrawal to a new payout address.",
    );
  } catch (e) {
    if (e instanceof Error && (e.message.includes("cool") || e.message.includes("24") || e.message.includes("wait"))) {
      throw e;
    }
    console.warn("[allowlist]", e);
  }
}

export async function savePayoutAddress(opts: {
  userId: string;
  address: string;
}): Promise<{ savedAt: string }> {
  const addr = opts.address.trim();
  if (addr.length < 10) throw new Error("Invalid address");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("payout_address_allowlist").upsert(
    { user_id: opts.userId, address: addr, created_at: now },
    { onConflict: "user_id,address" },
  );
  if (error) throw new Error(error.message);
  return { savedAt: now };
}

/** Emulator / automation UA signals — high confidence block or hard-cap. */
const EMULATOR_UA_RE =
  /android.*(sdk_gphone|emulator|genymotion|bluestacks|nox|ldplayer|memu)|x86_64.*(android|linux).*webview|headlesschrome|phantomjs|selenium|puppeteer|playwright|electron\/|bot\b|crawler/i;

export function detectEmulatorOrAutomation(userAgent: string | null | undefined): {
  flagged: boolean;
  reason?: string;
} {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { flagged: false };
  if (EMULATOR_UA_RE.test(ua)) {
    return { flagged: true, reason: "emulator_or_automation_ua" };
  }
  // Extremely short / empty-looking automation shells
  if (ua.length < 24 && /mozilla/i.test(ua) === false) {
    return { flagged: true, reason: "suspicious_short_ua" };
  }
  return { flagged: false };
}

/**
 * Rolling rate limit using submissions / watch starts as proxy.
 * Soft: only throws when clearly abusive.
 */
export async function assertActionRateLimit(opts: {
  userId: string;
  kind: "submit" | "watch_start" | "withdraw";
  limitPerMinute?: number;
}): Promise<void> {
  const limit = opts.limitPerMinute ?? 8;
  try {
    const { RULES } = await import("@/lib/platform-rules");
    const max = Math.max(3, limit || RULES.maxActionsPerMinute);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 60_000).toISOString();

    if (opts.kind === "submit") {
      const { count } = await supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", opts.userId)
        .gte("created_at", since);
      if ((count ?? 0) >= max) {
        throw new Error("Too many submissions in a short time. Wait a minute and try again.");
      }
    }
    if (opts.kind === "watch_start") {
      const { count } = await supabaseAdmin
        .from("watch_video_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", opts.userId)
        .gte("started_at", since);
      if ((count ?? 0) >= max) {
        throw new Error("Too many video starts. Wait a minute and try again.");
      }
    }
    if (opts.kind === "withdraw") {
      const { count } = await supabaseAdmin
        .from("withdrawals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", opts.userId)
        .gte("created_at", since);
      if ((count ?? 0) >= 3) {
        throw new Error("Too many withdrawal requests. Wait a minute and try again.");
      }
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("Too many") || e.message.includes("Wait"))) throw e;
  }
}

/**
 * Referral unlock: referee must have ≥3 approved tasks AND ≥10 completed watches
 * before inviter receives referral commission.
 */
export async function isReferralUnlocked(refereeUserId: string): Promise<{
  unlocked: boolean;
  approvedTasks: number;
  watchCompletions: number;
  needTasks: number;
  needWatches: number;
}> {
  const { RULES } = await import("@/lib/platform-rules");
  const needTasks = RULES.referralUnlockApprovedTasks;
  const needWatches = RULES.referralUnlockWatchCompletions;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [tasks, watches] = await Promise.all([
      supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", refereeUserId)
        .in("status", ["approved", "verified"]),
      supabaseAdmin
        .from("watch_video_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", refereeUserId)
        .eq("status", "completed"),
    ]);
    const approvedTasks = tasks.count ?? 0;
    const watchCompletions = watches.count ?? 0;
    return {
      unlocked: approvedTasks >= needTasks && watchCompletions >= needWatches,
      approvedTasks,
      watchCompletions,
      needTasks,
      needWatches,
    };
  } catch {
    // Soft: if tables missing, do not unlock (safer)
    return {
      unlocked: false,
      approvedTasks: 0,
      watchCompletions: 0,
      needTasks,
      needWatches,
    };
  }
}

/** Credit inviter only when referee has unlocked referral (3 tasks + 10 watches). */
export async function maybeCreditReferralShare(opts: {
  refereeUserId: string;
  rewardUsd: number;
  label?: string;
}): Promise<{ credited: boolean; reason?: string }> {
  if (opts.rewardUsd <= 0) return { credited: false, reason: "zero_reward" };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { RULES } = await import("@/lib/platform-rules");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("id", opts.refereeUserId)
      .maybeSingle();
    const inviterId = (profile as { referred_by?: string | null } | null)?.referred_by;
    if (!inviterId) return { credited: false, reason: "no_inviter" };

    const gate = await isReferralUnlocked(opts.refereeUserId);
    if (!gate.unlocked) {
      return {
        credited: false,
        reason: `locked:${gate.approvedTasks}/${gate.needTasks}tasks:${gate.watchCompletions}/${gate.needWatches}watches`,
      };
    }

    const amount = Number((opts.rewardUsd * RULES.referralRate).toFixed(4));
    if (amount <= 0) return { credited: false, reason: "dust" };

    await supabaseAdmin.from("transactions").insert({
      user_id: inviterId,
      label: opts.label ?? "Referral share (unlocked)",
      amount,
      kind: "referral",
    });
    return { credited: true };
  } catch (e) {
    console.warn("[referral]", e);
    return { credited: false, reason: "error" };
  }
}
