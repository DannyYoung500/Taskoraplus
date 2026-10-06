/**
 * Strong Elite: Telegram profile quality, trust score, behavioral velocity,
 * AdsGram/Monetag server postback, short session tokens, cluster alerts.
 * Web Crypto only — safe if ever pulled near client boundary.
 * Soft-fail when optional columns are missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertAdmin(userId: string) {
  const { assertOwner } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytesLen: number): string {
  const arr = new Uint8Array(bytesLen);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Score Telegram profile quality (0-100). Low score = extra friction. */
export async function scoreTelegramProfileQuality(opts: {
  userId: string;
  username?: string | null;
  firstName?: string | null;
  photoUrl?: string | null;
  languageCode?: string | null;
  isPremium?: boolean | null;
}): Promise<{ score: number; flags: string[] }> {
  const flags: string[] = [];
  let score = 50;

  if (opts.username && opts.username.trim().length >= 3) {
    score += 15;
  } else {
    flags.push("no_username");
    score -= 20;
  }

  if (opts.photoUrl && opts.photoUrl.startsWith("http")) {
    score += 10;
  } else {
    flags.push("no_photo");
    score -= 10;
  }

  if (opts.firstName && opts.firstName.trim().length >= 2) {
    score += 5;
  } else {
    flags.push("no_name");
    score -= 5;
  }

  if (opts.isPremium) score += 15;
  if (opts.languageCode) score += 5;

  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("created_at, trust_score")
      .eq("id", opts.userId)
      .maybeSingle();
    if (profile?.created_at) {
      const ageDays =
        (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays >= 30) score += 15;
      else if (ageDays >= 7) score += 8;
      else if (ageDays < 1) {
        flags.push("brand_new_account");
        score -= 15;
      }
    }
  } catch {
    /* soft */
  }

  score = Math.max(0, Math.min(100, score));
  return { score, flags };
}

export async function assertTelegramQualityGate(opts: {
  userId: string;
  minScore?: number;
  username?: string | null;
  firstName?: string | null;
  photoUrl?: string | null;
  languageCode?: string | null;
  isPremium?: boolean | null;
}): Promise<{ score: number; flags: string[] }> {
  const min = opts.minScore ?? 35;
  const result = await scoreTelegramProfileQuality(opts);
  if (result.score < min) {
    throw new Error(
      `Account quality too low (${result.score}/100). Add a Telegram username + profile photo, then try again.`,
    );
  }
  return result;
}

export async function assertBehavioralVelocity(opts: {
  userId: string;
  windowMinutes?: number;
  maxActions?: number;
}): Promise<{ count: number }> {
  const windowMin = Math.max(5, Math.min(60, opts.windowMinutes ?? 15));
  const max = Math.max(3, Math.min(40, opts.maxActions ?? 12));
  const since = new Date(Date.now() - windowMin * 60 * 1000).toISOString();

  try {
    const s = await adminClient();
    const { count: subCount } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .gte("created_at", since);
    const { count: txCount } = await s
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .eq("kind", "reward")
      .gte("created_at", since);

    const total = Number(subCount ?? 0) + Number(txCount ?? 0);
    if (total >= max) {
      throw new Error(
        `Too many actions in the last ${windowMin} minutes. Slow down and try again later.`,
      );
    }
    return { count: total };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Too many")) throw e;
    return { count: 0 };
  }
}

export async function updateEarnerTrustScore(opts: {
  userId: string;
  decision: "approved" | "rejected";
}): Promise<{ trustScore: number }> {
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("trust_score, approved_count, rejected_count")
      .eq("id", opts.userId)
      .maybeSingle();

    let trust = Number(profile?.trust_score ?? 70);
    let approved = Number(profile?.approved_count ?? 0);
    let rejected = Number(profile?.rejected_count ?? 0);

    if (opts.decision === "approved") {
      approved += 1;
      trust = Math.min(100, trust + 2);
    } else {
      rejected += 1;
      trust = Math.max(0, trust - 8);
    }

    const total = approved + rejected;
    if (total >= 5) {
      const rejectRatio = rejected / total;
      if (rejectRatio >= 0.5) trust = Math.max(0, trust - 10);
      else if (rejectRatio >= 0.3) trust = Math.max(0, trust - 4);
    }

    await s
      .from("profiles")
      .update({
        trust_score: trust,
        approved_count: approved,
        rejected_count: rejected,
      })
      .eq("id", opts.userId);

    return { trustScore: trust };
  } catch {
    return { trustScore: 70 };
  }
}

export async function assertTrustScoreForAction(opts: {
  userId: string;
  minTrust?: number;
  actionLabel?: string;
}): Promise<{ trustScore: number }> {
  const min = opts.minTrust ?? 40;
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("trust_score")
      .eq("id", opts.userId)
      .maybeSingle();
    const trust = Number(profile?.trust_score ?? 70);
    if (trust < min) {
      throw new Error(
        `Trust score too low (${trust}/${min}) for ${opts.actionLabel ?? "this action"}. Complete more verified tasks to improve trust.`,
      );
    }
    return { trustScore: trust };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Trust score")) throw e;
    return { trustScore: 70 };
  }
}

export async function mintAppSessionToken(userId: string): Promise<{
  token: string;
  expiresAt: number;
}> {
  const expiresAt = Date.now() + 30 * 60 * 1000;
  const nonce = randomHex(16);
  const payload = `${userId}|${expiresAt}|${nonce}`;
  const secret = process.env.SESSION_SECRET ?? process.env.BOT_TOKEN ?? "taskora";
  const sig = (await sha256Hex(payload + secret)).slice(0, 24);
  const raw = `${payload}|${sig}`;
  return {
    token: toBase64Url(new TextEncoder().encode(raw)),
    expiresAt,
  };
}

export async function verifyAppSessionToken(
  token: string,
  expectedUserId: string,
): Promise<boolean> {
  try {
    const raw = fromBase64Url(token);
    const parts = raw.split("|");
    if (parts.length !== 4) return false;
    const [userId, expStr, nonce, sig] = parts;
    if (userId !== expectedUserId) return false;
    const expiresAt = Number(expStr);
    if (!expiresAt || Date.now() > expiresAt) return false;
    const payload = `${userId}|${expStr}|${nonce}`;
    const secret = process.env.SESSION_SECRET ?? process.env.BOT_TOKEN ?? "taskora";
    const expected = (await sha256Hex(payload + secret)).slice(0, 24);
    return sig === expected;
  } catch {
    return false;
  }
}

export const adsNetworkRewardPostback = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      telegramUserId?: string | number;
      blockId?: string;
      signature?: string;
      sdkToken?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const secret = process.env.ADSGRAM_POSTBACK_SECRET ?? process.env.MONETAG_POSTBACK_SECRET;
    if (secret && data.signature) {
      const expected = (await sha256Hex(`${data.telegramUserId}|${data.blockId ?? ""}|${secret}`)).slice(
        0,
        32,
      );
      if (data.signature !== expected && data.signature !== secret) {
        throw new Error("Invalid postback signature.");
      }
    }

    const tgId = String(data.telegramUserId ?? "").trim();
    if (!tgId) throw new Error("telegramUserId required.");

    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("id")
      .eq("telegram_id", tgId)
      .maybeSingle();

    if (!profile?.id) {
      const { data: byNum } = await s
        .from("profiles")
        .select("id")
        .eq("telegram_id", Number(tgId) || -1)
        .maybeSingle();
      if (!byNum?.id) throw new Error("User not found for postback.");
      return creditFromPostback(byNum.id, data.sdkToken);
    }
    return creditFromPostback(profile.id, data.sdkToken);
  });

async function creditFromPostback(userId: string, sdkToken?: string) {
  if (sdkToken) {
    const { assertBonusAdSessionToken } = await import("@/lib/strong-premium.functions");
    await assertBonusAdSessionToken({ userId, sdkToken });
  }

  const s = await adminClient();
  const { data: ecoRow } = await s
    .from("app_settings")
    .select("value")
    .eq("key", "economy")
    .maybeSingle();
  const eco = (ecoRow?.value ?? {}) as Record<string, unknown>;
  const reward = Math.max(0, Number(eco.bonus_ad_reward_usdt ?? 0.003));
  const dailyLimit = Math.max(0, Math.min(50, Math.floor(Number(eco.bonus_ad_daily_limit ?? 5))));
  if (reward <= 0 || dailyLimit <= 0) throw new Error("Bonus ads disabled.");

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00.000Z`;
  const { count } = await s
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "reward")
    .ilike("label", "Bonus ad%")
    .gte("created_at", dayStart);
  if (Number(count ?? 0) >= dailyLimit) {
    throw new Error("Daily limit reached.");
  }

  const { error } = await s.from("transactions").insert({
    user_id: userId,
    label: "Bonus ad (network postback)",
    amount: reward,
    kind: "reward",
  });
  if (error) throw new Error(error.message);

  return { ok: true as const, rewardUsdt: reward, userId };
}

export async function detectAndAlertMultiAccountClusters(opts?: {
  minClusterSize?: number;
}): Promise<{ clusters: number; alerted: boolean }> {
  const minSize = opts?.minClusterSize ?? 3;
  try {
    const s = await adminClient();
    const { data: rows } = await s
      .from("profiles")
      .select("id, device_fp, last_ip")
      .not("device_fp", "is", null)
      .limit(2000);

    if (!rows?.length) return { clusters: 0, alerted: false };

    const byFp = new Map<string, string[]>();
    for (const r of rows) {
      const fp = (r as { device_fp?: string }).device_fp;
      if (!fp || fp.length < 8) continue;
      const list = byFp.get(fp) ?? [];
      list.push((r as { id: string }).id);
      byFp.set(fp, list);
    }

    const big: Array<{ fp: string; users: string[] }> = [];
    for (const [fp, users] of byFp) {
      if (users.length >= minSize) big.push({ fp, users });
    }

    if (big.length > 0) {
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        const top = big
          .slice(0, 5)
          .map(
            (c) =>
              `• fp <code>${c.fp.slice(0, 12)}…</code> → ${c.users.length} accounts`,
          )
          .join("\n");
        await sendOwnerHtml(
          `⚠️ <b>Multi-account clusters</b>\nFound ${big.length} cluster(s) ≥${minSize} accounts\n${top}\nTime: ${new Date().toISOString()}`,
        );
      } catch {
        /* soft */
      }
      return { clusters: big.length, alerted: true };
    }
    return { clusters: 0, alerted: false };
  } catch {
    return { clusters: 0, alerted: false };
  }
}

export const ownerScanMultiAccountClusters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return detectAndAlertMultiAccountClusters({ minClusterSize: 3 });
  });

export const ownerGetEarnerRiskSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select(
        "id, username, first_name, photo_url, trust_score, approved_count, rejected_count, device_fp, last_ip, created_at, level, streak",
      )
      .eq("id", data.userId)
      .maybeSingle();

    if (!profile) throw new Error("User not found.");

    const quality = await scoreTelegramProfileQuality({
      userId: data.userId,
      username: (profile as { username?: string }).username,
      firstName: (profile as { first_name?: string }).first_name,
      photoUrl: (profile as { photo_url?: string }).photo_url,
    });

    let fraudScore = { score: 0, signals: [] as string[], action: "allow" as const };
    try {
      const { computeCompositeFraudScore } = await import("@/lib/strong-score.functions");
      fraudScore = await computeCompositeFraudScore(data.userId);
    } catch {
      /* soft */
    }

    return {
      profile,
      qualityScore: quality.score,
      qualityFlags: quality.flags,
      trustScore: Number((profile as { trust_score?: number }).trust_score ?? 70),
      approved: Number((profile as { approved_count?: number }).approved_count ?? 0),
      rejected: Number((profile as { rejected_count?: number }).rejected_count ?? 0),
      fraudScore: fraudScore.score,
      fraudSignals: fraudScore.signals,
      fraudAction: fraudScore.action,
    };
  });
