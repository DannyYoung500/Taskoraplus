/**
 * Strong P7 — next anti-fraud / trust layer for TASKORA
 * - Task cooldown graph (same device/IP × advertiser)
 * - Advertiser bond slash on high leave/clawback rate
 * - Public payout feed (trust signal)
 * - Soft KYC gate before larger withdrawals
 * Soft-fail friendly where schema columns may be missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

const ADVERTISER_COOLDOWN_HOURS = 4;
const DEVICE_SAME_ADV_MAX = 3;
const BOND_SLASH_LEAVE_RATE = 0.35;
const BOND_SLASH_MIN_SAMPLES = 12;
const KYC_WD_THRESHOLD_USD = 15;
const PUBLIC_PAYOUT_LIMIT = 50;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function assertTaskCooldownGraph(opts: {
  userId: string;
  taskId: string;
  advertiserId?: string | null;
  deviceFp?: string | null;
}): Promise<void> {
  try {
    const s = await admin();
    let advertiserKey = String(opts.advertiserId || "").trim();
    if (!advertiserKey) {
      const { data: task } = await s
        .from("tasks")
        .select("advertiser_id, advertiser, owner_id, user_id")
        .eq("id", opts.taskId)
        .maybeSingle();
      const t = task as {
        advertiser_id?: string;
        advertiser?: string;
        owner_id?: string;
        user_id?: string;
      } | null;
      advertiserKey = String(
        t?.advertiser_id || t?.owner_id || t?.user_id || t?.advertiser || "",
      ).trim();
    }
    if (!advertiserKey) return;

    const since = new Date(Date.now() - ADVERTISER_COOLDOWN_HOURS * 3600_000).toISOString();

    const { data: mine } = await s
      .from("submissions")
      .select("id, task_id, status, created_at")
      .eq("user_id", opts.userId)
      .in("status", ["verified", "approved", "auto_approved", "pending"] as never)
      .gte("created_at", since)
      .limit(30);

    const myRows = mine ?? [];
    if (myRows.length >= 2) {
      const taskIds = [...new Set(myRows.map((r) => String((r as { task_id?: string }).task_id)))];
      if (taskIds.length >= 2) {
        const { data: related } = await s
          .from("tasks")
          .select("id, advertiser_id, advertiser, owner_id, user_id")
          .in("id", taskIds);
        const sameAdv = (related ?? []).filter((t) => {
          const key = String(
            (t as { advertiser_id?: string }).advertiser_id ||
              (t as { owner_id?: string }).owner_id ||
              (t as { user_id?: string }).user_id ||
              (t as { advertiser?: string }).advertiser ||
              "",
          ).trim();
          return key && key === advertiserKey;
        });
        if (sameAdv.length >= 2) {
          throw new Error(
            `Cooldown: wait ${ADVERTISER_COOLDOWN_HOURS}h before more tasks from this advertiser.`,
          );
        }
      }
    }

    let deviceFp = String(opts.deviceFp || "").trim();
    if (!deviceFp) {
      const { data: profile } = await s
        .from("profiles")
        .select("device_fp")
        .eq("id", opts.userId)
        .maybeSingle();
      deviceFp = String((profile as { device_fp?: string } | null)?.device_fp || "").trim();
    }
    if (deviceFp && deviceFp.length >= 6) {
      const { data: cluster } = await s
        .from("profiles")
        .select("id")
        .eq("device_fp", deviceFp)
        .limit(20);
      const userIds = (cluster ?? []).map((p) => String((p as { id: string }).id)).filter(Boolean);
      if (userIds.length >= 2) {
        const { count } = await s
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .in("user_id", userIds)
          .in("status", ["verified", "approved", "auto_approved"] as never)
          .gte("created_at", since);
        if ((count ?? 0) >= DEVICE_SAME_ADV_MAX + 2) {
          throw new Error(
            "This device has completed too many tasks recently. Take a short break.",
          );
        }
      }
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("Cooldown") || e.message.includes("device has completed"))
    ) {
      throw e;
    }
  }
}

export async function evaluateAdvertiserBond(opts: {
  advertiserId?: string | null;
  campaignId?: string | null;
  autoSlash?: boolean;
}): Promise<{
  samples: number;
  leaveRate: number;
  slashCandidate: boolean;
  slashedUsd: number;
}> {
  const s = await admin();
  let samples = 0;
  let left = 0;
  let slashedUsd = 0;

  try {
    let q = s
      .from("submissions")
      .select("id, status, clawback, left_channel, meta")
      .in("status", ["verified", "approved", "auto_approved", "clawed_back"] as never)
      .limit(200);

    if (opts.campaignId) {
      const { data: tasks } = await s
        .from("tasks")
        .select("id")
        .eq("campaign_id", opts.campaignId)
        .limit(50);
      const ids = (tasks ?? []).map((t) => String((t as { id: string }).id));
      if (ids.length) q = q.in("task_id", ids);
    }

    const { data: rows } = await q;
    const list = rows ?? [];
    samples = list.length;
    left = list.filter((r) => {
      const row = r as { clawback?: boolean; left_channel?: boolean; status?: string; meta?: unknown };
      if (row.clawback || row.left_channel) return true;
      if (String(row.status) === "clawed_back") return true;
      const meta = row.meta as { left?: boolean; clawback?: boolean } | null;
      return Boolean(meta?.left || meta?.clawback);
    }).length;
  } catch {
    /* soft */
  }

  const leaveRate = samples > 0 ? left / samples : 0;
  const slashCandidate =
    samples >= BOND_SLASH_MIN_SAMPLES && leaveRate >= BOND_SLASH_LEAVE_RATE;

  if (slashCandidate && opts.autoSlash && (opts.advertiserId || opts.campaignId)) {
    try {
      await s.from("audit_log").insert({
        action: "advertiser_bond_slash_candidate",
        actor_id: null,
        meta: {
          advertiserId: opts.advertiserId,
          campaignId: opts.campaignId,
          samples,
          leaveRate,
          threshold: BOND_SLASH_LEAVE_RATE,
        },
      } as never);
      if (opts.campaignId) {
        const { data: camp } = await s
          .from("campaigns")
          .select("id, bond_usd, bond_slashed_usd")
          .eq("id", opts.campaignId)
          .maybeSingle();
        const bond = Number((camp as { bond_usd?: number } | null)?.bond_usd ?? 0);
        const already = Number((camp as { bond_slashed_usd?: number } | null)?.bond_slashed_usd ?? 0);
        const slash = Math.min(bond - already, Math.max(0, bond * 0.25));
        if (slash > 0) {
          await s
            .from("campaigns")
            .update({
              bond_slashed_usd: already + slash,
              review_note: `Bond slash ${(leaveRate * 100).toFixed(0)}% leave rate`,
            } as never)
            .eq("id", opts.campaignId);
          slashedUsd = slash;
        }
      }
    } catch {
      /* soft */
    }
  }

  return { samples, leaveRate, slashCandidate, slashedUsd };
}

export const ownerEvaluateAdvertiserBond = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { advertiserId?: string; campaignId?: string; autoSlash?: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return evaluateAdvertiserBond({
      advertiserId: data.advertiserId,
      campaignId: data.campaignId,
      autoSlash: Boolean(data.autoSlash),
    });
  });

function maskAddress(addr: string): string {
  const a = String(addr || "").trim();
  if (a.length < 12) return "••••";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export async function getPublicPayoutFeed(opts?: { limit?: number }) {
  const limit = Math.min(PUBLIC_PAYOUT_LIMIT, Math.max(5, Number(opts?.limit ?? 30)));
  const s = await admin();
  const items: Array<{
    amount: number;
    addressMask: string;
    paidAt: string;
    method: string;
  }> = [];

  try {
    const { data } = await s
      .from("withdrawals")
      .select("amount, address, paid_at, updated_at, method, status")
      .in("status", ["paid", "completed", "success"] as never)
      .order("updated_at", { ascending: false })
      .limit(limit);

    for (const row of data ?? []) {
      const r = row as {
        amount?: number;
        address?: string;
        paid_at?: string;
        updated_at?: string;
        method?: string;
      };
      const amount = Number(r.amount ?? 0);
      if (amount <= 0) continue;
      items.push({
        amount,
        addressMask: maskAddress(String(r.address || "")),
        paidAt: String(r.paid_at || r.updated_at || ""),
        method: String(r.method || "USDT"),
      });
    }
  } catch {
    /* soft */
  }

  return { items, count: items.length };
}

export const listPublicPayouts = createServerFn({ method: "GET" }).handler(async () => {
  return getPublicPayoutFeed({ limit: 30 });
});

export async function assertKycForWithdraw(opts: {
  userId: string;
  amountUsd: number;
  thresholdUsd?: number;
}): Promise<{ required: boolean; status: string }> {
  const thr = Number(opts.thresholdUsd ?? KYC_WD_THRESHOLD_USD);
  if (opts.amountUsd < thr) return { required: false, status: "not_needed" };

  try {
    const s = await admin();
    const { data: profile } = await s
      .from("profiles")
      .select("kyc_status, selfie_passed, trust_score")
      .eq("id", opts.userId)
      .maybeSingle();
    const p = profile as {
      kyc_status?: string;
      selfie_passed?: boolean;
      trust_score?: number;
    } | null;

    if (!p) return { required: true, status: "unknown" };

    const status = String(p.kyc_status || "").toLowerCase();
    if (status === "verified" || status === "approved" || p.selfie_passed === true) {
      return { required: true, status: "ok" };
    }

    if (Number(p.trust_score ?? 0) >= 85) {
      return { required: true, status: "trust_bypass" };
    }

    throw new Error(
      `Identity check required for withdrawals ≥ $${thr}. Complete the quick selfie verification in Settings.`,
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("Identity check")) throw e;
    return { required: false, status: "soft_skip" };
  }
}

export const markSelfiePassed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passed?: boolean }) => d)
  .handler(async ({ context, data }) => {
    if (!data.passed) return { ok: false };
    try {
      const s = await admin();
      await s
        .from("profiles")
        .update({
          selfie_passed: true,
          kyc_status: "selfie_ok",
          kyc_at: new Date().toISOString(),
        } as never)
        .eq("id", context.userId);
    } catch {
      /* soft */
    }
    return { ok: true };
  });

export async function runP7NightlySuite(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  try {
    const s = await admin();
    const { data: camps } = await s
      .from("campaigns")
      .select("id, advertiser_id")
      .eq("status", "active")
      .limit(20);
    let candidates = 0;
    let slashed = 0;
    for (const c of camps ?? []) {
      const row = c as { id: string; advertiser_id?: string };
      const r = await evaluateAdvertiserBond({
        campaignId: row.id,
        advertiserId: row.advertiser_id,
        autoSlash: true,
      });
      if (r.slashCandidate) candidates += 1;
      if (r.slashedUsd > 0) slashed += 1;
    }
    out.bond = { checked: (camps ?? []).length, candidates, slashed };
  } catch (e) {
    out.bond = { error: e instanceof Error ? e.message : "fail" };
  }
  try {
    out.payoutFeed = await getPublicPayoutFeed({ limit: 10 });
  } catch (e) {
    out.payoutFeed = { error: e instanceof Error ? e.message : "fail" };
  }
  return out;
}

export const ownerRunP7Nightly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return runP7NightlySuite();
  });
