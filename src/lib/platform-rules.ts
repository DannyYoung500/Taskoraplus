/**
 * Server-only operational rules for TASKORA.
 * Floor values — owner economy can raise mins, never go below these floors.
 */

export const RULES = {
  /** Hard floor — owner min_withdrawal_usd cannot go below this */
  minWithdrawalUsd: 3,
  /** Max single withdrawal without extra owner review flag */
  maxAutoWithdrawalUsd: 500,
  /** Hours after account creation before first withdrawal is allowed */
  newAccountWithdrawHoldHours: 24,
  /** Max pending withdrawals per user at once */
  maxPendingWithdrawals: 2,
  /** Max task submissions per user in a rolling window */
  maxSubmissionsPerHour: 12,
  submissionWindowMs: 60 * 60 * 1000,
  /** Min proof text length when proof is required */
  minProofTextChars: 8,
  referralRate: 0.08,
  dailyCheckinUsd: 0.1,
  /** Daily check-in streak bonus (Task Points) every 7 consecutive days */
  streakBonusPoints: 50,
  streakBonusDays: 7,
  /** Max withdrawal requests per user per rolling 24h */
  maxWithdrawalsPerDay: 3,
  /** Risk score that forces dual approval */
  riskForceDual: 40,
  /** Risk score that auto-freezes wallet on WD attempt */
  riskAutoFreeze: 70,
  /** Amounts at or above this require on-chain tx hash when marking Paid */
  txHashRequiredUsd: 20,
  /** Max profiles sharing one device fingerprint before hard WD block */
  maxAccountsPerDevice: 3,
  /** Soft WD $ cap when 2+ accounts share device */
  multiDeviceWdCapUsd: 10,
  /** Referral unlock: referee must complete this many approved tasks */
  referralUnlockApprovedTasks: 3,
  /** Referral unlock: referee must complete this many watch videos */
  referralUnlockWatchCompletions: 10,
  /** Max start-watch / submit bursts per minute (abuse throttle) */
  maxActionsPerMinute: 8,
  /** Campaign SLA hours before owner alert for stuck active campaigns */
  campaignStuckHours: 72,
  /** IP/ASN: max distinct accounts from same IP family in 24h before dual-approval */
  maxAccountsPerIpFamily24h: 8,
  /** IP/ASN hard block threshold */
  hardBlockAccountsPerIpFamily24h: 20,
  /** First successful paid withdrawal count below which dual is forced */
  graduatedHoldPaidCount: 3,
  /** Watch sessions longer than this require mid-watch attention ack */
  attentionRequiredSeconds: 45,
  /** Min visibility ratio (qualified vs wall) for long watches */
  minVisibleWatchRatio: 0.85,
  /** Campaign circuit-breaker: pause if spend exceeds this multiple of expected */
  campaignSpendCircuitMultiplier: 1.5,
  /** Max active/draft campaigns sharing the same normalized target URL (global) */
  maxActiveCampaignsPerTargetUrl: 3,
  /** Max campaigns one advertiser can create per rolling 24h */
  maxCampaignsPerAdvertiser24h: 15,
  /** New advertiser: account age (hours) below which qty is capped */
  advertiserTrustHoldHours: 48,
  /** New advertiser max quantity per campaign while under trust hold */
  advertiserTrustMaxQty: 500,
  /** New advertiser max campaign value USD while under trust hold */
  advertiserTrustMaxCampaignUsd: 25,
  /** Default min screenshots for follow/like/subscribe when screenshot verification */
  minScreenshotsFollowLike: 2,
  /** Max approved completions per platform per user per rolling 24h */
  maxCompletionsPerPlatform24h: 25,
  /** Platforms that require a connected account handle before submit */
  requireConnectedAccountPlatforms: [
    "instagram",
    "tiktok",
    "youtube",
    "x",
    "facebook",
    "telegram",
  ] as readonly string[],
  /** Earner quality: min completed submissions before ratio applies */
  earnerQualityMinSamples: 8,
  /** Earner quality: max reject rate (0–1) before submit is blocked */
  earnerMaxRejectRate: 0.55,
  /** Campaign value (USD) at/above which advertiser bond is required */
  advertiserBondThresholdUsd: 50,
  /** Bond as fraction of campaign value (held until campaign closes cleanly) */
  advertiserBondRate: 0.1,
  /** Soft dual when profile country mismatches local payout method; hard-block if true */
  geoMismatchHardBlock: true,
  /** Min seconds between submissions on the same platform (anti-bot farm) */
  platformSubmitCooldownSeconds: 90,
  /** Lifetime paid USD above which soft KYC (connected account + country) is required for further WDs */
  softKycLifetimePaidUsd: 50,
} as const;

/** Platform hostname allow-lists for target URL validation */
export const PLATFORM_URL_HOSTS: Record<string, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"],
  x: ["x.com", "twitter.com", "www.x.com", "www.twitter.com", "mobile.twitter.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  threads: ["threads.net", "www.threads.net"],
  telegram: ["t.me", "telegram.me", "www.t.me"],
  whatsapp: ["whatsapp.com", "www.whatsapp.com", "chat.whatsapp.com", "wa.me"],
  discord: ["discord.gg", "discord.com", "www.discord.com"],
  spotify: ["open.spotify.com", "spotify.com"],
  soundcloud: ["soundcloud.com", "www.soundcloud.com"],
  audiomack: ["audiomack.com", "www.audiomack.com"],
  pinterest: ["pinterest.com", "www.pinterest.com", "pin.it"],
  reddit: ["reddit.com", "www.reddit.com", "old.reddit.com"],
  twitch: ["twitch.tv", "www.twitch.tv"],
};

export function normalizeTargetUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(
      (k) => u.searchParams.delete(k),
    );
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hostname = host;
    let path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${host}${path}${u.search}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function assertPlatformUrl(platform: string, rawUrl: string): void {
  const hosts = PLATFORM_URL_HOSTS[platform];
  if (!hosts || hosts.length === 0) return;
  let hostname = "";
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    throw new Error("Enter a valid URL.");
  }
  const ok = hosts.some(
    (h) => hostname === h || hostname.endsWith(`.${h.replace(/^www\./, "")}`),
  );
  if (!ok) {
    throw new Error(`URL must be a valid ${platform} link.`);
  }
}

export function hoursSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 9999;
  return (Date.now() - t) / (1000 * 60 * 60);
}

/** Normalize TRC20 / ERC20 style addresses for shared-wallet checks */
export function normalizeWalletAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, "");
}
