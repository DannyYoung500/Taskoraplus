/**
 * Strong ops: proof dedup, device fingerprint multi-account, address allowlist 24h.
 * Soft-fail when optional columns / tables are missing.
 * Includes referral depth guard (max depth 2).
 */
import { createHash } from "node:crypto";
import { RULES } from "@/lib/platform-rules";

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
  }
  return { proofHash };
}

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
        last_ip_hint: opts.ipHint ?? null,
        last_seen_at: new Date().toISOString(),
      } as never)
      .eq("id", opts.userId);
    const { data: cluster } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("device_fp", opts.fingerprint)
      .limit(20);
    const multiAccountCount = (cluster ?? []).length;
    return {
      multiAccountCount,
      capped: multiAccountCount >= RULES.maxAccountsPerDevice,
    };
  } catch {
    return { multiAccountCount: 1, capped: false };
  }
}

const ALLOWLIST_HOURS = 24;

export async function assertAddressAllowlisted(opts: {
  userId: string;
  address: string;
}): Promise<void> {
  const addr = opts.address.trim();
  if (!addr) throw new Error("Enter a valid wallet address.");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: paid } = await supabaseAdmin
      .from("withdrawals")
      .select("id, created_at, status")
      .eq("user_id", opts.userId)
      .eq("address", addr)
      .in("status", ["paid", "completed", "approved"])
      .limit(1);
    if (paid && paid.length > 0) return;
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
    const { error: insErr } = await supabaseAdmin.from("payout_address_allowlist").upsert(
      { user_id: opts.userId, address: addr, created_at: new Date().toISOString() },
      { onConflict: "user_id,address" },
    );
    if (insErr) {
      console.warn("[allowlist] payout_address_allowlist missing; soft-allow first address");
      return;
    }
    throw new Error(
      "Address saved. For security, wait 24 hours before the first withdrawal to a new payout address.",
    );
  } catch (e) {
    if (e instanceof Error && (e.message.includes("cool") || e.message.includes("24") || e.message.includes("wait") || e.message.includes("Address saved"))) {
      throw e;
    }
    console.warn("[allowlist]", e);
  }
}

export async function assertActionRateLimit(opts: {
  userId: string;
  kind: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("action_rate_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .eq("kind", opts.kind)
      .gte("created_at", windowStart);
    if ((count ?? 0) >= RULES.maxActionsPerMinute) {
      throw new Error("Too many actions. Slow down for a minute.");
    }
    await supabaseAdmin.from("action_rate_events").insert({
      user_id: opts.userId,
      kind: opts.kind,
    } as never);
  } catch (e) {
    if (e instanceof Error && e.message.includes("Too many")) throw e;
  }
}

export async function isReferralUnlocked(userId: string): Promise<{ unlocked: boolean; reason?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count: tasks } = await supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["verified", "approved", "auto_approved"]);
    const { count: watches } = await supabaseAdmin
      .from("watch_video_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    const needT = RULES.referralUnlockApprovedTasks;
    const needW = RULES.referralUnlockWatchCompletions;
    if ((tasks ?? 0) < needT || (watches ?? 0) < needW) {
      return {
        unlocked: false,
        reason: `Referral unlocks after ${needT} approved tasks and ${needW} watch completions (have ${tasks ?? 0}/${needT} tasks, ${watches ?? 0}/${needW} watches).`,
      };
    }
    return { unlocked: true };
  } catch {
    return { unlocked: true };
  }
}

export async function maybeCreditReferralShare(opts: {
  refereeUserId: string;
  amount: number;
  label?: string;
}): Promise<{ credited: boolean; reason?: string }> {
  if (opts.amount <= 0) return { credited: false, reason: "zero" };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("id", opts.refereeUserId)
      .maybeSingle();
    const inviterId = (profile as { referred_by?: string | null } | null)?.referred_by;
    if (!inviterId) return { credited: false, reason: "no_inviter" };
    try {
      const { assertReferralDepthOk } = await import("@/lib/strong-next.functions");
      const depth = await assertReferralDepthOk({
        inviterId,
        refereeId: opts.refereeUserId,
        maxDepth: 2,
      });
      if (!depth.ok) return { credited: false, reason: depth.reason ?? "referral_depth" };
    } catch {
      /* soft */
    }
    const gate = await isReferralUnlocked(opts.refereeUserId);
    if (!gate.unlocked) return { credited: false, reason: gate.reason ?? "locked" };
    try {
      const { data: list } = await supabaseAdmin
        .from("profiles")
        .select("id, device_fp")
        .in("id", [inviterId, opts.refereeUserId]);
      const inv = (list ?? []).find((r) => r.id === inviterId) as { device_fp?: string } | undefined;
      const ref = (list ?? []).find((r) => r.id === opts.refereeUserId) as { device_fp?: string } | undefined;
      if (inv?.device_fp && ref?.device_fp && inv.device_fp === ref.device_fp && inv.device_fp.length >= 8) {
        return { credited: false, reason: "sybil_same_device" };
      }
    } catch {
      /* soft */
    }
    const share = Math.round(opts.amount * 0.05 * 10000) / 10000;
    if (share <= 0) return { credited: false, reason: "share_zero" };
    const { error } = await supabaseAdmin.from("transactions").insert({
      user_id: inviterId,
      label: opts.label ?? "Referral share",
      amount: share,
      kind: "referral",
    });
    if (error) return { credited: false, reason: error.message };
    return { credited: true };
  } catch (e) {
    return { credited: false, reason: e instanceof Error ? e.message : "error" };
  }
}

export async function flagProofForReviewQueue(opts: {
  userId: string;
  submissionHint?: string;
  proofText?: string | null;
  proofUrl?: string | null;
  proofHash?: string | null;
}): Promise<void> {
  /* soft queue — no hard fail */
}

export async function applyGraduatedWithdrawalHold(opts: {
  userId: string;
  requiresDual: boolean;
}): Promise<{ requiresDual: boolean }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .in("status", ["paid", "completed"]);
    if ((count ?? 0) < RULES.graduatedHoldPaidCount) {
      return { requiresDual: true };
    }
    return { requiresDual: opts.requiresDual };
  } catch {
    return { requiresDual: opts.requiresDual };
  }
}

export async function assertIpFamilyVelocity(opts: {
  userId: string;
  ipHint?: string | null;
}): Promise<{ blocked?: string; dualRequired?: boolean }> {
  return {};
}

export function assertGeoMethodMatch(opts: {
  countryCode: string;
  method: string;
  hardBlock?: boolean;
}): { blocked?: string; dualRequired?: boolean } {
  return {};
}

export async function assertConnectedAccountForPlatform(opts: {
  userId: string;
  platform: string;
}): Promise<void> {
  const p = opts.platform.toLowerCase();
  if (!RULES.requireConnectedAccountPlatforms.includes(p as never)) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("connected_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .ilike("platform", p);
    if ((count ?? 0) < 1) {
      throw new Error(`Connect your ${opts.platform} account in Connected Accounts before submitting.`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Connect your")) throw e;
  }
}

export async function assertPlatformDailyCompletionCap(opts: {
  userId: string;
  platform: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= RULES.maxCompletionsPerPlatform24h) {
      throw new Error(`Daily limit reached for platform completions. Try again tomorrow.`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily limit")) throw e;
  }
}

export async function assertEarnerQuality(opts: { userId: string }): Promise<{ rejectRate: number; samples: number }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("submissions")
      .select("status")
      .eq("user_id", opts.userId)
      .in("status", ["approved", "rejected", "auto_approved", "verified"])
      .order("created_at", { ascending: false })
      .limit(20);
    const samples = (rows ?? []).length;
    if (samples < 5) return { rejectRate: 0, samples };
    const rejected = (rows ?? []).filter((r: { status?: string }) => r.status === "rejected").length;
    const rejectRate = rejected / samples;
    if (rejectRate >= RULES.earnerMaxRejectRate) {
      throw new Error(
        `Quality hold: ${Math.round(rejectRate * 100)}% of recent submissions were rejected. Improve proof quality or contact support.`,
      );
    }
    return { rejectRate, samples };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Quality hold")) throw e;
    return { rejectRate: 0, samples: 0 };
  }
}

export async function assertPlatformSubmitCooldown(opts: {
  userId: string;
  platform: string;
}): Promise<void> {
  /* soft */
}

export async function assertSoftKycForWithdrawal(opts: {
  userId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return { ok: true };
}

export function payoutReceiptHash(opts: {
  amount: number;
  address: string;
  txHash?: string;
}): string {
  return createHash("sha256")
    .update(`${opts.amount}|${opts.address}|${opts.txHash ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}
