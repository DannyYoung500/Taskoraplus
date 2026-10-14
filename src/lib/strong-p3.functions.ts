/**
 * Strong P3 — additional anti-fraud / ops for TASKORA
 * - Duplicate proof URL / hash across different users
 * - Trust fast-track: high-trust users auto-approve low-value screenshot tasks
 * - Verify attempt rate limit (anti spam-click)
 * Soft-fail friendly.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
async function assertOwner(userId: string) {
  const { assertOwner: ao } = await import("@/lib/owner-guard-impl");
  await ao(userId);
}

const TRUST_FAST_TRACK_MIN = 75;
const TRUST_FAST_TRACK_MAX_REWARD = 0.15;
const VERIFY_ATTEMPTS_PER_HOUR = 30;
const DUP_PROOF_LOOKBACK_DAYS = 14;

async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

/** Reject if same proof_url or perceptual hash was already used by another user. */
export async function assertProofNotReused(opts: {
  userId: string;
  proofUrl?: string | null;
  proofHash?: string | null;
}): Promise<void> {
  const url = String(opts.proofUrl || "").trim();
  const hash = String(opts.proofHash || "").trim();
  if (!url && !hash) return;
  try {
    const s = await admin();
    const since = new Date(
      Date.now() - DUP_PROOF_LOOKBACK_DAYS * 24 * 3600_000,
    ).toISOString();
    if (url) {
      const { data } = await s
        .from("submissions")
        .select("id, user_id")
        .neq("user_id", opts.userId)
        .eq("proof_url", url)
        .gte("created_at", since)
        .in("status", ["pending", "verified", "approved", "auto_approved"] as never)
        .limit(1);
      if (data && data.length > 0) {
        throw new Error("This proof was already submitted by another account.");
      }
    }
    if (hash && hash.length >= 8) {
      const { data } = await s
        .from("submissions")
        .select("id, user_id")
        .neq("user_id", opts.userId)
        .eq("proof_hash", hash)
        .gte("created_at", since)
        .in("status", ["pending", "verified", "approved", "auto_approved"] as never)
        .limit(1);
      if (data && data.length > 0) {
        throw new Error("This screenshot matches a proof already used by another account.");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("already")) throw e;
  }
}

/**
 * High-trust users on low-reward screenshot tasks can be auto-approved.
 * Returns true if caller should auto-verify.
 */
export async function shouldTrustFastTrack(opts: {
  userId: string;
  rewardUsd: number;
  proofMode: string;
}): Promise<boolean> {
  const mode = String(opts.proofMode || "").toLowerCase();
  if (mode === "auto" || mode === "automatic" || mode === "membership") return false;
  if (Number(opts.rewardUsd) > TRUST_FAST_TRACK_MAX_REWARD) return false;
  try {
    const s = await admin();
    const { data: profile } = await s
      .from("profiles")
      .select("trust_score, status, created_at")
      .eq("id", opts.userId)
      .maybeSingle();
    if (!profile) return false;
    const p = profile as {
      trust_score?: number;
      status?: string;
      created_at?: string;
    };
    if (String(p.status || "active") !== "active") return false;
    if (Number(p.trust_score ?? 0) < TRUST_FAST_TRACK_MIN) return false;
    if (p.created_at) {
      const ageH = (Date.now() - new Date(p.created_at).getTime()) / 3600_000;
      if (ageH < 48) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Soft rate-limit verify / submit attempts per user per hour. */
export async function assertVerifyRateLimit(opts: {
  userId: string;
  maxPerHour?: number;
}): Promise<void> {
  const max = Math.max(5, Number(opts.maxPerHour ?? VERIFY_ATTEMPTS_PER_HOUR));
  try {
    const s = await admin();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= max) {
      throw new Error(
        `Too many submissions in the last hour (max ${max}). Slow down and try later.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Too many submissions")) throw e;
  }
}

export const ownerGetP3Status = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return {
      trustFastTrackMin: TRUST_FAST_TRACK_MIN,
      trustFastTrackMaxReward: TRUST_FAST_TRACK_MAX_REWARD,
      verifyAttemptsPerHour: VERIFY_ATTEMPTS_PER_HOUR,
      dupProofLookbackDays: DUP_PROOF_LOOKBACK_DAYS,
    };
  });
