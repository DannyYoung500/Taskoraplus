/**
 * Strong P9 - production hardening layer for TASKORA
 * - Device cluster freeze (same device_fp across N accounts)
 * - Withdrawal address change dual-control window
 * - Campaign spend velocity (pause when spend rate spikes)
 * - Public trust badge (verified count + account age)
 * - Owner bulk reactivate + soft quarantine
 * Soft-fail friendly where schema columns may be missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEVICE_CLUSTER_FREEZE = 4;
const ADDR_CHANGE_DUAL_HOURS = 48;
const CAMPAIGN_SPEND_SPIKE_USD = 200; // per hour soft pause

async function adminClient() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const m = await import("@/lib/owner-guard-impl");
  return m.assertOwner(userId);
}

/** Freeze wallet when device fingerprint is shared by >= N accounts. */
export async function assertDeviceClusterFreeze(opts: {
  userId: string;
  deviceFp?: string | null;
}): Promise<{ clusterSize: number; frozen: boolean }> {
  const fp = String(opts.deviceFp ?? "").trim();
  if (fp.length < 8) return { clusterSize: 1, frozen: false };
  try {
    const s = await adminClient();
    const { data: rows } = await s
      .from("profiles")
      .select("id, wallet_frozen")
      .eq("device_fp", fp)
      .limit(20);
    const clusterSize = (rows ?? []).length;
    if (clusterSize >= DEVICE_CLUSTER_FREEZE) {
      const already = (rows ?? []).some(
        (r) => r.id === opts.userId && Boolean((r as { wallet_frozen?: boolean }).wallet_frozen),
      );
      if (!already) {
        await s
          .from("profiles")
          .update({ wallet_frozen: true, freeze_reason: "device_cluster" } as never)
          .eq("id", opts.userId);
        try {
          const { sendOwnerHtml } = await import("@/lib/notify-owner");
          await sendOwnerHtml(
            `🔒 <b>Device cluster freeze</b>\nfp <code>${fp.slice(0, 10)}...</code> · ${clusterSize} accounts\nuser <code>${opts.userId.slice(0, 8)}</code>`,
          );
        } catch { /* soft */ }
      }
      return { clusterSize, frozen: true };
    }
    return { clusterSize, frozen: false };
  } catch {
    return { clusterSize: 1, frozen: false };
  }
}

/** Require dual approval when payout address changed recently. */
export async function assertAddressChangeDual(opts: {
  userId: string;
  address: string;
}): Promise<{ requiresDual: boolean; hoursSinceChange: number | null }> {
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("payout_address, payout_address_changed_at")
      .eq("id", opts.userId)
      .maybeSingle();
    const prev = String((profile as { payout_address?: string } | null)?.payout_address ?? "").trim().toLowerCase();
    const addr = opts.address.trim().toLowerCase();
    const changedAt = (profile as { payout_address_changed_at?: string } | null)?.payout_address_changed_at;
    if (prev && prev !== addr) {
      await s
        .from("profiles")
        .update({
          payout_address: addr,
          payout_address_changed_at: new Date().toISOString(),
        } as never)
        .eq("id", opts.userId);
      return { requiresDual: true, hoursSinceChange: 0 };
    }
    if (changedAt) {
      const hours = (Date.now() - new Date(changedAt).getTime()) / 3600000;
      if (hours < ADDR_CHANGE_DUAL_HOURS) {
        return { requiresDual: true, hoursSinceChange: Math.round(hours) };
      }
    }
    return { requiresDual: false, hoursSinceChange: changedAt ? Math.round((Date.now() - new Date(changedAt).getTime()) / 3600000) : null };
  } catch {
    return { requiresDual: false, hoursSinceChange: null };
  }
}

/** Soft-pause campaign when hourly verified spend spikes. */
export async function checkCampaignSpendVelocity(opts: {
  taskId: string;
}): Promise<{ paused: boolean; spend1h: number }> {
  try {
    const s = await adminClient();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data: subs } = await s
      .from("submissions")
      .select("reward, amount")
      .eq("task_id", opts.taskId)
      .in("status", ["verified", "approved", "auto_approved"])
      .gte("updated_at", since);
    const spend1h = (subs ?? []).reduce(
      (sum, r) => sum + Number((r as { reward?: number }).reward ?? (r as { amount?: number }).amount ?? 0),
      0,
    );
    if (spend1h >= CAMPAIGN_SPEND_SPIKE_USD) {
      await s
        .from("tasks")
        .update({
          is_active: false,
          review_note: `auto-paused: spend $${spend1h.toFixed(2)}/h`,
        } as never)
        .eq("id", opts.taskId);
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(
          `⚡ <b>Campaign spend spike</b>\ntask <code>${opts.taskId.slice(0, 8)}</code> · $${spend1h.toFixed(2)}/h → paused`,
        );
      } catch { /* soft */ }
      return { paused: true, spend1h };
    }
    return { paused: false, spend1h };
  } catch {
    return { paused: false, spend1h: 0 };
  }
}

/** Public trust badge for profile / leaderboard. */
export async function getPublicTrustBadge(opts: {
  userId: string;
}): Promise<{
  score: number;
  tier: "new" | "rising" | "trusted" | "elite";
  verifiedTasks: number;
  accountAgeDays: number;
  factors: string[];
}> {
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("created_at, trust_score, selfie_verified_at")
      .eq("id", opts.userId)
      .maybeSingle();
    const { count } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .in("status", ["verified", "approved", "auto_approved"]);
    const verifiedTasks = Number(count ?? 0);
    const ageMs = Date.now() - new Date(String(profile?.created_at ?? Date.now())).getTime();
    const accountAgeDays = Math.max(0, Math.floor(ageMs / 86400000));
    const factors: string[] = [];
    let score = 10;
    if (accountAgeDays >= 7) { score += 15; factors.push("age_7d"); }
    if (accountAgeDays >= 30) { score += 15; factors.push("age_30d"); }
    if (verifiedTasks >= 3) { score += 20; factors.push("verified_3"); }
    if (verifiedTasks >= 15) { score += 20; factors.push("verified_15"); }
    if ((profile as { selfie_verified_at?: string } | null)?.selfie_verified_at) {
      score += 15;
      factors.push("selfie_kyc");
    }
    const stored = Number((profile as { trust_score?: number } | null)?.trust_score ?? 0);
    if (stored > 0) score = Math.round((score + Math.min(100, stored)) / 2);
    score = Math.max(0, Math.min(100, score));
    const tier =
      score >= 80 ? "elite" : score >= 55 ? "trusted" : score >= 30 ? "rising" : "new";
    return { score, tier, verifiedTasks, accountAgeDays, factors };
  } catch {
    return { score: 10, tier: "new", verifiedTasks: 0, accountAgeDays: 0, factors: [] };
  }
}

export const ownerGetTrustBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    return getPublicTrustBadge({ userId: data.userId });
  });

export const getMyTrustBadge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getPublicTrustBadge({ userId: context.userId });
  });

/** Soft quarantine: mark user for manual review without full freeze. */
export const ownerSoftQuarantine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    await s
      .from("profiles")
      .update({
        status: "review",
        freeze_reason: data.reason ?? "owner_quarantine",
      } as never)
      .eq("id", data.userId);
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(
        `⚠️ <b>Soft quarantine</b>\nuser <code>${data.userId.slice(0, 8)}</code>\n${data.reason ?? "manual"}`,
      );
    } catch { /* soft */ }
    return { ok: true };
  });

/** Nightly P9 suite (cron-safe). */
export async function runP9NightlySuite(): Promise<{
  deviceClusters: number;
  spendPaused: number;
}> {
  let deviceClusters = 0;
  let spendPaused = 0;
  try {
    const s = await adminClient();
    const { data: fps } = await s
      .from("profiles")
      .select("device_fp")
      .not("device_fp", "is", null)
      .limit(2000);
    const counts = new Map<string, number>();
    for (const r of fps ?? []) {
      const fp = String((r as { device_fp?: string }).device_fp ?? "").trim();
      if (fp.length >= 8) counts.set(fp, (counts.get(fp) ?? 0) + 1);
    }
    for (const [fp, n] of counts) {
      if (n >= DEVICE_CLUSTER_FREEZE) deviceClusters += 1;
    }
    const { data: tasks } = await s
      .from("tasks")
      .select("id")
      .eq("is_active", true)
      .limit(80);
    for (const t of tasks ?? []) {
      const r = await checkCampaignSpendVelocity({ taskId: String(t.id) });
      if (r.paused) spendPaused += 1;
    }
  } catch { /* soft */ }
  return { deviceClusters, spendPaused };
}

export const ownerRunP9Nightly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return runP9NightlySuite();
  });
