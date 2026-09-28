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
    return { multiAccountCount: multi, capped: multi >= 4 };
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
      {
        user_id: opts.userId,
        address: addr,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,address" },
    );
    if (insErr) {
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
  if (ua.length < 24 && /mozilla/i.test(ua) === false) {
    return { flagged: true, reason: "suspicious_short_ua" };
  }
  return { flagged: false };
}

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
    return {
      unlocked: false,
      approvedTasks: 0,
      watchCompletions: 0,
      needTasks,
      needWatches,
    };
  }
}

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

    try {
      const { data: fps } = await supabaseAdmin
        .from("profiles")
        .select("id, device_fp")
        .in("id", [inviterId, opts.refereeUserId]);
      const list = fps ?? [];
      const inv = list.find((r) => r.id === inviterId) as { device_fp?: string } | undefined;
      const ref = list.find((r) => r.id === opts.refereeUserId) as { device_fp?: string } | undefined;
      if (inv?.device_fp && ref?.device_fp && inv.device_fp === ref.device_fp && inv.device_fp.length >= 8) {
        return { credited: false, reason: "sybil_same_device" };
      }
    } catch {
      /* soft */
    }

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

export async function assertIpFamilyVelocity(opts: {
  userId: string;
  ipHint?: string | null;
}): Promise<{ accounts: number; dualRequired: boolean; blocked?: string }> {
  const { RULES } = await import("@/lib/platform-rules");
  const ip = (opts.ipHint ?? "").trim();
  if (!ip || ip.length < 4) return { accounts: 1, dualRequired: false };
  const family = ip.includes(".")
    ? ip.split(".").slice(0, 3).join(".")
    : ip.slice(0, 12);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, last_ip_hint, last_seen_at")
      .ilike("last_ip_hint", `${family}%`)
      .gte("last_seen_at", since)
      .limit(40);
    const accounts = new Set((rows ?? []).map((r) => r.id)).size;
    if (accounts >= RULES.hardBlockAccountsPerIpFamily24h) {
      return {
        accounts,
        dualRequired: true,
        blocked: "Too many accounts from this network. Contact support.",
      };
    }
    return {
      accounts,
      dualRequired: accounts >= RULES.maxAccountsPerIpFamily24h,
    };
  } catch {
    return { accounts: 1, dualRequired: false };
  }
}

export async function applyGraduatedWithdrawalHold(opts: {
  userId: string;
  requiresDual: boolean;
}): Promise<{ requiresDual: boolean; paidCount: number }> {
  const { RULES } = await import("@/lib/platform-rules");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .in("status", ["paid", "completed", "approved"]);
    const paidCount = count ?? 0;
    if (paidCount < RULES.graduatedHoldPaidCount) {
      return { requiresDual: true, paidCount };
    }
    return { requiresDual: opts.requiresDual, paidCount };
  } catch {
    return { requiresDual: opts.requiresDual, paidCount: 0 };
  }
}

export function mintWatchNonce(sessionId: string, userId: string): string {
  const material = `${sessionId}|${userId}|${Date.now().toString(36)}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 24);
}

export function verifyWatchNonce(opts: {
  nonce: string | null | undefined;
  sessionId: string;
  userId: string;
  storedNonce?: string | null;
}): boolean {
  if (!opts.nonce || opts.nonce.length < 12) return false;
  if (opts.storedNonce && opts.storedNonce === opts.nonce) return true;
  return /^[a-f0-9]{16,32}$/i.test(opts.nonce);
}

export function payoutReceiptHash(opts: {
  withdrawalId: string;
  address: string;
  amount: number;
  method: string;
  txHash?: string | null;
}): string {
  const raw = [
    opts.withdrawalId,
    opts.address.trim().toLowerCase(),
    Number(opts.amount).toFixed(6),
    opts.method.trim().toUpperCase(),
    (opts.txHash ?? "").trim().toLowerCase(),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

/** A: Require connected account handle for platform tasks. */
export async function assertConnectedAccountForPlatform(opts: {
  userId: string;
  platform: string;
}): Promise<void> {
  const { RULES } = await import("@/lib/platform-rules");
  const platform = String(opts.platform || "").toLowerCase();
  if (!RULES.requireConnectedAccountPlatforms.includes(platform)) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("connected_accounts")
      .select("id, handle, status")
      .eq("user_id", opts.userId)
      .eq("platform", platform)
      .maybeSingle();
    if (error && error.message.includes("does not exist")) return;
    if (!data || !String((data as { handle?: string }).handle || "").trim()) {
      throw new Error(
        `Connect your ${platform} account first (Connected Accounts), then try again.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Connect your")) throw e;
  }
}

/** Platform daily completion cap. */
export async function assertPlatformDailyCompletionCap(opts: {
  userId: string;
  platform: string;
}): Promise<void> {
  const { RULES } = await import("@/lib/platform-rules");
  const platform = String(opts.platform || "").toLowerCase();
  if (!platform) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("submissions")
      .select("task_id, created_at")
      .eq("user_id", opts.userId)
      .in("status", ["approved", "pending", "auto_approved"])
      .gte("created_at", since)
      .limit(200);
    if (!rows?.length) return;
    const taskIds = [...new Set(rows.map((r: { task_id: string }) => r.task_id))];
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, platform")
      .in("id", taskIds);
    const match = new Set(
      (tasks ?? [])
        .filter((t: { platform?: string }) => String(t.platform || "").toLowerCase() === platform)
        .map((t: { id: string }) => t.id),
    );
    const count = rows.filter((r: { task_id: string }) => match.has(r.task_id)).length;
    if (count >= RULES.maxCompletionsPerPlatform24h) {
      throw new Error(
        `Daily limit: max ${RULES.maxCompletionsPerPlatform24h} ${platform} tasks in 24h. Try another platform or wait.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily limit")) throw e;
  }
}

/** F: Earner quality score — block high reject-rate accounts. */
export async function assertEarnerQuality(opts: {
  userId: string;
}): Promise<{ rejectRate: number; samples: number }> {
  const { RULES } = await import("@/lib/platform-rules");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("submissions")
      .select("status")
      .eq("user_id", opts.userId)
      .in("status", ["approved", "rejected", "auto_approved"])
      .order("created_at", { ascending: false })
      .limit(40);
    const samples = rows?.length ?? 0;
    if (samples < RULES.earnerQualityMinSamples) {
      return { rejectRate: 0, samples };
    }
    const rejected = (rows ?? []).filter(
      (r: { status?: string }) => r.status === "rejected",
    ).length;
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

/** B: Flag suspicious proof for owner review queue. */
export async function flagProofForReviewQueue(opts: {
  userId: string;
  submissionHint?: string;
  proofText: string;
  proofUrl: string;
  proofHash: string | null;
}): Promise<{ flagged: boolean; reasons: string[] }> {
  const { RULES } = await import("@/lib/platform-rules");
  const reasons: string[] = [];
  const text = opts.proofText.trim();
  const url = opts.proofUrl.trim();
  if (text && text.length < RULES.minProofTextChars) {
    reasons.push("proof_text_too_short");
  }
  if (url && !/^https?:\/\//i.test(url)) {
    reasons.push("proof_url_not_http");
  }
  if (opts.proofHash) {
    reasons.push("hash_recorded");
  }
  if (reasons.length === 0) return { flagged: false, reasons };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("verification_cases").insert({
      subject_type: "user",
      subject_id: opts.userId,
      verification_type: "proof_quality_flag",
      status: "pending",
      evidence: {
        reasons,
        proof_hash: opts.proofHash,
        proof_text_len: text.length,
        has_url: Boolean(url),
        submission_hint: opts.submissionHint ?? null,
        at: new Date().toISOString(),
      },
    } as never);
  } catch {
    /* soft */
  }
  return { flagged: reasons.some((r) => r !== "hash_recorded"), reasons };
}

/** C: Geo mismatch — hard-block local payout methods when profile country mismatches. */
export function assertGeoMethodMatch(opts: {
  countryCode: string;
  method: string;
  hardBlock?: boolean;
}): { dualRequired: boolean; blocked?: string } {
  const { RULES } = await import("@/lib/platform-rules");
  const cc = String(opts.countryCode || "")
    .trim()
    .toUpperCase();
  if (!cc) return { dualRequired: false };
  const method = opts.method.toUpperCase();
  const hard = opts.hardBlock ?? RULES.geoMismatchHardBlock;
  if (/OPAY|PALMPAY|MONIEPOINT|GTBANK|ACCESS|UBA|ZENITH|NGN/.test(method) && cc !== "NG") {
    if (hard) {
      return {
        dualRequired: true,
        blocked: `Nigerian payout method requires NG profile country (yours: ${cc}).`,
      };
    }
    return { dualRequired: true };
  }
  if (/MTN.?MOMO|VODAFONE|AIRTELTIGO|GHS/.test(method) && cc !== "GH") {
    if (hard) {
      return {
        dualRequired: true,
        blocked: `Ghana payout method requires GH profile country (yours: ${cc}).`,
      };
    }
    return { dualRequired: true };
  }
  if (/MPESA|SAFARICOM|KES/.test(method) && cc !== "KE") {
    if (hard) {
      return {
        dualRequired: true,
        blocked: `Kenya payout method requires KE profile country (yours: ${cc}).`,
      };
    }
    return { dualRequired: true };
  }
  return { dualRequired: false };
}
