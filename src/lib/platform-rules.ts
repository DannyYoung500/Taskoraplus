/**
 * Server-only operational rules for TASKORA.
 * Floor values — owner economy can raise mins, never go below these floors.
 */

export const RULES = {
  minWithdrawalUsd: 3,
  maxAutoWithdrawalUsd: 500,
  newAccountWithdrawHoldHours: 24,
  maxPendingWithdrawals: 2,
  maxSubmissionsPerHour: 12,
  submissionWindowMs: 60 * 60 * 1000,
  minProofTextChars: 8,
  referralRate: 0.08,
  dailyCheckinUsd: 0.1,
  streakBonusPoints: 50,
  streakBonusDays: 7,
  maxWithdrawalsPerDay: 3,
  riskForceDual: 40,
  riskAutoFreeze: 70,
  txHashRequiredUsd: 20,
  maxAccountsPerDevice: 3,
  multiDeviceWdCapUsd: 10,
  referralUnlockApprovedTasks: 3,
  referralUnlockWatchCompletions: 10,
  maxActionsPerMinute: 8,
  campaignStuckHours: 72,
  maxAccountsPerIpFamily24h: 8,
  hardBlockAccountsPerIpFamily24h: 20,
  graduatedHoldPaidCount: 3,
  attentionRequiredSeconds: 45,
  minVisibleWatchRatio: 0.85,
  campaignSpendCircuitMultiplier: 1.5,
  maxActiveCampaignsPerTargetUrl: 3,
  maxCampaignsPerAdvertiser24h: 15,
  advertiserTrustHoldHours: 48,
  advertiserTrustMaxQty: 500,
  advertiserTrustMaxCampaignUsd: 25,
  minScreenshotsFollowLike: 2,
  maxCompletionsPerPlatform24h: 25,
  /**
   * Platforms that require a Connected Account before submit.
   * Telegram is NEVER here — Mini App already proves Telegram identity.
   * Discord IS required — user must link Discord before join/screenshot Discord tasks.
   */
  requireConnectedAccountPlatforms: [
    "discord",
    "instagram",
    "tiktok",
    "youtube",
    "x",
    "facebook",
  ] as readonly string[],
  earnerQualityMinSamples: 8,
  earnerMaxRejectRate: 0.55,
  advertiserBondThresholdUsd: 50,
  advertiserBondRate: 0.1,
  geoMismatchHardBlock: true,
  platformSubmitCooldownSeconds: 90,
  softKycLifetimePaidUsd: 50,
} as const;

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
  github: ["github.com", "www.github.com"],
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

export function normalizeWalletAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, "");
}
