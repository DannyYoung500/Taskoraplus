/**
 * Advertiser escrow + trust decay / recovery.
 * Build-safe (no node:crypto). Soft-fail friendly for owner tooling.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const { assertOwner: ao } = await import("@/lib/owner-guard.server");
  await ao(userId);
}

/** Hours after last verification before unused budget can auto-release */
const ESCROW_HOLD_HOURS = 36;

/**
 * Mark campaign escrow window — call after each verification against the campaign.
 * Updates campaigns.last_verification_at so release can wait ESCROW_HOLD_HOURS.
 */
export async function touchCampaignEscrow(opts: {
  campaignId: string;
}): Promise<void> {
  try {
    const s = await adminClient();
    await s
      .from("campaigns")
      .update({ last_verification_at: new Date().toISOString() } as never)
      .eq("id", opts.campaignId);
  } catch {
    /* soft */
  }
}

/**
 * Release unused campaign budget after hold window.
 * Safe to run as cron / owner button.
 * Returns count of campaigns processed.
 */
export async function releaseExpiredCampaignEscrow(opts?: {
  holdHours?: number;
  limit?: number;
}): Promise<{ released: number; totalUsd: number }> {
  const holdH = opts?.holdHours ?? ESCROW_HOLD_HOURS;
  const limit = opts?.limit ?? 40;
  const s = await adminClient();
  const cutoff = new Date(Date.now() - holdH * 3600_000).toISOString();

  let released = 0;
  let totalUsd = 0;

  try {
    const { data: rows } = await s
      .from("campaigns")
      .select("id, advertiser_id, funding_reserved, funding_status, status, last_verification_at, created_at")
      .in("funding_status", ["funded", "reserved"])
      .gt("funding_reserved", 0)
      .order("created_at", { ascending: true })
      .limit(limit);

    for (const row of rows ?? []) {
      const last =
        (row as { last_verification_at?: string | null }).last_verification_at ??
        (row as { created_at?: string }).created_at;
      if (!last || last > cutoff) continue;
      const reserved = Number((row as { funding_reserved?: number }).funding_reserved ?? 0);
      if (reserved <= 0) continue;

      try {
        const { error } = await s.rpc("release_campaign_budget", {
          p_campaign_id: (row as { id: string }).id,
        });
        if (error) continue;
        await s
          .from("campaigns")
          .update({
            funding_status: "released",
            status: "completed",
            funding_reserved: 0,
          } as never)
          .eq("id", (row as { id: string }).id);
        released += 1;
        totalUsd += reserved;
      } catch {
        /* next */
      }
    }
  } catch {
    /* soft */
  }

  if (released > 0) {
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(
        `💸 <b>Escrow release</b>\n${released} campaigns · ~$${totalUsd.toFixed(2)} returned after ${holdH}h hold`,
      );
    } catch {
      /* soft */
    }
  }
  return { released, totalUsd };
}

export const runEscrowRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return releaseExpiredCampaignEscrow();
  });

// ─── Trust decay & recovery ─────────────────────────────────────────

const TRUST_DEFAULT = 70;
const TRUST_FLOOR = 10;
const TRUST_CEIL = 100;

/**
 * Apply trust delta after verification outcome.
 * Reject spikes hurt; verified activity recovers slowly.
 */
export async function applyTrustOutcome(opts: {
  userId: string;
  outcome: "approved" | "rejected" | "amended";
}): Promise<{ trustScore: number }> {
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("trust_score, approved_count, rejected_count")
      .eq("id", opts.userId)
      .maybeSingle();

    let trust = Number((profile as { trust_score?: number } | null)?.trust_score ?? TRUST_DEFAULT);
    let approved = Number((profile as { approved_count?: number } | null)?.approved_count ?? 0);
    let rejected = Number((profile as { rejected_count?: number } | null)?.rejected_count ?? 0);

    if (opts.outcome === "approved") {
      approved += 1;
      // Slow recovery: +1.5 per approve, capped
      trust = Math.min(TRUST_CEIL, trust + 1.5);
    } else if (opts.outcome === "rejected") {
      rejected += 1;
      trust = Math.max(TRUST_FLOOR, trust - 6);
    } else if (opts.outcome === "amended") {
      // Amendment accepted — small recovery
      trust = Math.min(TRUST_CEIL, trust + 0.5);
    }

    // Spike penalty: recent reject ratio
    const total = approved + rejected;
    if (total >= 5) {
      const ratio = rejected / total;
      if (ratio >= 0.55) trust = Math.max(TRUST_FLOOR, trust - 8);
      else if (ratio >= 0.35) trust = Math.max(TRUST_FLOOR, trust - 3);
    }

    trust = Math.round(trust * 10) / 10;

    await s
      .from("profiles")
      .update({
        trust_score: trust,
        approved_count: approved,
        rejected_count: rejected,
      } as never)
      .eq("id", opts.userId);

    return { trustScore: trust };
  } catch {
    return { trustScore: TRUST_DEFAULT };
  }
}

/**
 * Passive trust decay for inactive accounts (cron).
 * -1 point per 7 days idle after 14 days with no verified activity.
 */
export async function applyPassiveTrustDecay(opts?: {
  limit?: number;
}): Promise<{ decayed: number }> {
  const limit = opts?.limit ?? 100;
  const s = await adminClient();
  const idleCutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
  let decayed = 0;

  try {
    const { data: rows } = await s
      .from("profiles")
      .select("id, trust_score, last_verified_at, updated_at")
      .lt("trust_score", TRUST_DEFAULT + 5)
      .order("updated_at", { ascending: true })
      .limit(limit);

    for (const row of rows ?? []) {
      const last =
        (row as { last_verified_at?: string | null }).last_verified_at ??
        (row as { updated_at?: string }).updated_at;
      if (!last || last > idleCutoff) continue;
      const trust = Number((row as { trust_score?: number }).trust_score ?? TRUST_DEFAULT);
      if (trust <= TRUST_FLOOR + 5) continue;
      const next = Math.max(TRUST_FLOOR, trust - 1);
      await s
        .from("profiles")
        .update({ trust_score: next } as never)
        .eq("id", (row as { id: string }).id);
      decayed += 1;
    }
  } catch {
    /* soft */
  }
  return { decayed };
}

export const runPassiveTrustDecay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return applyPassiveTrustDecay();
  });
