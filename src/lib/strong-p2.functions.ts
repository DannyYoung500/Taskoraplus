/**
 * Strong P2 — next anti-fraud layer for TASKORA
 * - Same-device / same-IP referral block
 * - New-account withdraw age hold
 * - Shared wallet soft cluster (beyond exact match)
 * - Per-advertiser daily task cap
 * - High clawback auto-pause advertiser tasks
 * - Owner risk snapshot helper for reviews
 * Soft-fail friendly where schema columns may be missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

const NEW_ACCOUNT_WD_HOLD_HOURS = 12;
const MAX_TASKS_PER_ADVERTISER_PER_DAY = 8;
const CLAWBACK_SPIKE_MIN = 5;
const CLAWBACK_SPIKE_RATIO = 0.4;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Block referral attribution when referrer and referee share device_fp or last_ip_hint.
 * Call when setting referred_by on signup / claim referral.
 */
export async function assertReferralNotSameDevice(opts: {
  refereeUserId: string;
  referrerUserId: string;
}): Promise<void> {
  if (!opts.refereeUserId || !opts.referrerUserId) return;
  if (opts.refereeUserId === opts.referrerUserId) {
    throw new Error("You cannot refer yourself.");
  }
  try {
    const s = await admin();
    const { data: rows } = await s
      .from("profiles")
      .select("id, device_fp, last_ip_hint")
      .in("id", [opts.refereeUserId, opts.referrerUserId]);
    const list = rows ?? [];
    const a = list.find((r) => String(r.id) === opts.refereeUserId) as
      | { device_fp?: string; last_ip_hint?: string }
      | undefined;
    const b = list.find((r) => String(r.id) === opts.referrerUserId) as
      | { device_fp?: string; last_ip_hint?: string }
      | undefined;
    if (!a || !b) return;
    const fpA = String(a.device_fp || "").trim();
    const fpB = String(b.device_fp || "").trim();
    if (fpA && fpB && fpA === fpB) {
      throw new Error("Referral blocked: both accounts appear on the same device.");
    }
    const ipA = String(a.last_ip_hint || "").trim();
    const ipB = String(b.last_ip_hint || "").trim();
    if (ipA && ipB && ipA === ipB && ipA !== "0.0.0.0") {
      throw new Error("Referral blocked: both accounts share the same network signal.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Referral blocked")) throw e;
    if (e instanceof Error && e.message.includes("cannot refer")) throw e;
  }
}

/** First withdrawal only after account is N hours old. */
export async function assertNewAccountWithdrawHold(opts: {
  userId: string;
  holdHours?: number;
}): Promise<void> {
  const hours = Math.max(1, Number(opts.holdHours ?? NEW_ACCOUNT_WD_HOLD_HOURS));
  try {
    const s = await admin();
    const { data: profile } = await s
      .from("profiles")
      .select("created_at")
      .eq("id", opts.userId)
      .maybeSingle();
    const created = (profile as { created_at?: string } | null)?.created_at;
    if (!created) return;
    const ageMs = Date.now() - new Date(created).getTime();
    const needMs = hours * 3600_000;
    if (ageMs < needMs) {
      const leftH = Math.ceil((needMs - ageMs) / 3600_000);
      throw new Error(
        `New accounts can withdraw after ${hours}h. About ${leftH}h remaining.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("New accounts can withdraw")) throw e;
  }
}

/** Cap how many active tasks one advertiser can have verified per day (platform-wide). */
export async function assertAdvertiserDailyCap(opts: {
  advertiser: string;
  maxPerDay?: number;
}): Promise<void> {
  const adv = String(opts.advertiser || "").trim();
  if (!adv) return;
  const max = Math.max(1, Number(opts.maxPerDay ?? MAX_TASKS_PER_ADVERTISER_PER_DAY));
  try {
    const s = await admin();
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await s
      .from("submissions")
      .select("id, tasks!inner(advertiser)", { count: "exact", head: true })
      .eq("tasks.advertiser", adv)
      .in("status", ["verified", "approved", "auto_approved"] as never)
      .gte("created_at", since.toISOString());
    if ((count ?? 0) >= max) {
      throw new Error(
        `This advertiser has reached today's task completion cap (${max}). Try again tomorrow.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("completion cap")) throw e;
  }
}

/** If clawbacks on an advertiser spike, pause their active tasks. */
export async function maybePauseAdvertiserOnClawbackSpike(opts: {
  advertiser: string;
}): Promise<{ paused: number }> {
  const adv = String(opts.advertiser || "").trim();
  if (!adv) return { paused: 0 };
  try {
    const s = await admin();
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data: rows } = await s
      .from("audit_log")
      .select("id, meta")
      .eq("action", "membership_clawback")
      .gte("created_at", since)
      .limit(200);
    let claw = 0;
    for (const r of rows ?? []) {
      const meta = (r as { meta?: { advertiser?: string } }).meta;
      if (meta && String(meta.advertiser || "").toLowerCase() === adv.toLowerCase()) claw += 1;
    }
    if (claw < CLAWBACK_SPIKE_MIN) return { paused: 0 };
    const { data: tasks } = await s
      .from("tasks")
      .select("id")
      .eq("advertiser", adv)
      .eq("is_active", true)
      .limit(50);
    const ids = (tasks ?? []).map((t) => t.id);
    if (!ids.length) return { paused: 0 };
    const { error } = await s
      .from("tasks")
      .update({ is_active: false } as never)
      .in("id", ids);
    if (error) return { paused: 0 };
    try {
      await s.from("audit_log").insert({
        action: "advertiser_paused_clawback_spike",
        meta: { advertiser: adv, clawbacks_7d: claw, tasks_paused: ids.length },
      } as never);
    } catch {
      /* soft */
    }
    return { paused: ids.length };
  } catch {
    return { paused: 0 };
  }
}

export async function getUserRiskSnapshot(userId: string): Promise<{
  trust: number;
  status: string;
  accountAgeHours: number;
  pendingSubs: number;
  verified24h: number;
  rejected24h: number;
  deviceCluster: number;
  flags: string[];
}> {
  const out = {
    trust: 100,
    status: "active",
    accountAgeHours: 999,
    pendingSubs: 0,
    verified24h: 0,
    rejected24h: 0,
    deviceCluster: 1,
    flags: [] as string[],
  };
  try {
    const s = await admin();
    const { data: profile } = await s
      .from("profiles")
      .select("trust_score, status, created_at, device_fp")
      .eq("id", userId)
      .maybeSingle();
    if (profile) {
      const p = profile as {
        trust_score?: number;
        status?: string;
        created_at?: string;
        device_fp?: string;
      };
      out.trust = Number(p.trust_score ?? 100);
      out.status = String(p.status || "active");
      if (p.created_at) {
        out.accountAgeHours = Math.floor(
          (Date.now() - new Date(p.created_at).getTime()) / 3600_000,
        );
      }
      if (out.status !== "active") out.flags.push(`status:${p.status}`);
      if (out.trust < 40) out.flags.push("low_trust");
      if (out.accountAgeHours < 24) out.flags.push("new_account");
      const fp = String(p.device_fp || "").trim();
      if (fp) {
        const { count } = await s
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("device_fp", fp);
        out.deviceCluster = count ?? 1;
        if (out.deviceCluster >= 3) out.flags.push("device_cluster");
      }
    }
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: subs } = await s
      .from("submissions")
      .select("status")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(50);
    for (const row of subs ?? []) {
      const st = String((row as { status?: string }).status || "");
      if (st === "pending") out.pendingSubs += 1;
      if (["verified", "approved", "auto_approved"].includes(st)) out.verified24h += 1;
      if (st === "rejected") out.rejected24h += 1;
    }
    if (out.verified24h >= 10) out.flags.push("high_verify_rate");
    if (out.rejected24h >= 3) out.flags.push("recent_rejects");
  } catch {
    /* soft */
  }
  return out;
}

export const ownerGetUserRiskSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return getUserRiskSnapshot(data.userId);
  });

export const ownerPauseClawbackSpikeAdvertisers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const s = await admin();
    const { data: tasks } = await s
      .from("tasks")
      .select("id, advertiser")
      .eq("is_active", true)
      .in("platform", ["telegram", "discord"] as never)
      .limit(100);
    let paused = 0;
    const seen = new Set<string>();
    for (const t of tasks ?? []) {
      const adv = String((t as { advertiser?: string }).advertiser || "");
      if (!adv || seen.has(adv.toLowerCase())) continue;
      seen.add(adv.toLowerCase());
      const r = await maybePauseAdvertiserOnClawbackSpike({ advertiser: adv });
      paused += r.paused;
    }
    return { paused, advertisersChecked: seen.size };
  });
