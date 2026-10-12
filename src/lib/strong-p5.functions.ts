/**
 * Strong P5 — remaining P0–P3 anti-fraud / ops for TASKORA
 * P0: force money-session on withdraw, tx-hash required ≥ $5
 * P1: watch session binding, shadowban, feed ranking by advertiser reputation
 * P2: proof signed URL, geo×method matrix, first-3 tasks manual, referral depth limit
 * P3: fraud heat map, auto-close zero-slot tasks, strict 24h address cool-off
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

const TX_HASH_REQUIRED_USD = 5;
const FIRST_TASKS_MANUAL_COUNT = 3;
const REFERRAL_MAX_DEPTH = 1;
const ADDRESS_COOL_HOURS = 24;
const PROOF_SIGNED_TTL_SEC = 5 * 60;

const GEO_METHOD_MATRIX: Record<string, string[]> = {
  NG: ["USDT", "BEP20", "TRC20"],
  GH: ["USDT", "BEP20", "TRC20"],
  KE: ["USDT", "BEP20", "TRC20"],
  IN: ["USDT", "BEP20", "TRC20"],
  PK: ["USDT", "BEP20", "TRC20"],
  BD: ["USDT", "BEP20", "TRC20"],
  RU: ["USDT"],
  IR: [],
  KP: [],
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function assertTxHashForPaidAmount(opts: {
  amount: number;
  txHash?: string | null;
  thresholdUsd?: number;
}): void {
  const thr = Number(opts.thresholdUsd ?? TX_HASH_REQUIRED_USD);
  if (opts.amount < thr) return;
  const hash = String(opts.txHash || "").trim();
  if (!hash || hash.length < 8) {
    throw new Error(
      `On-chain tx hash required for payouts ≥ $${thr}. Paste the transaction hash before marking Paid.`,
    );
  }
}

export async function assertNotShadowbanned(opts: { userId: string }): Promise<void> {
  try {
    const s = await admin();
    const { data: profile } = await s
      .from("profiles")
      .select("status, shadowbanned, wallet_frozen")
      .eq("id", opts.userId)
      .maybeSingle();
    const p = profile as { status?: string; shadowbanned?: boolean } | null;
    if (p?.shadowbanned === true || String(p?.status || "") === "shadowban") {
      throw new Error(
        "Withdrawals are temporarily limited on this account. Keep earning — contact support if this persists.",
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Withdrawals are temporarily")) throw e;
  }
}

export async function ownerSetShadowban(opts: {
  userId: string;
  on: boolean;
  reason?: string;
}): Promise<void> {
  const s = await admin();
  try {
    await s
      .from("profiles")
      .update({
        shadowbanned: opts.on,
        status: opts.on ? "shadowban" : "active",
        review_note: opts.reason ?? (opts.on ? "Shadowbanned by owner" : "Shadowban lifted"),
      } as never)
      .eq("id", opts.userId);
  } catch {
    await s
      .from("profiles")
      .update({
        status: opts.on ? "shadowban" : "active",
        review_note: opts.reason ?? null,
      } as never)
      .eq("id", opts.userId);
  }
  try {
    await s.from("audit_log").insert({
      action: opts.on ? "shadowban_on" : "shadowban_off",
      entity_type: "profile",
      entity_id: opts.userId,
      detail: opts.reason ?? null,
    } as never);
  } catch {
    /* soft */
  }
}

export const ownerToggleShadowban = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; on: boolean; reason?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    await ownerSetShadowban(data);
    return { ok: true, on: data.on };
  });

export async function rankTasksByAdvertiserReputation<
  T extends { advertiser?: string | null; reward?: number | null; id?: string },
>(tasks: T[]): Promise<T[]> {
  if (!tasks.length) return tasks;
  const { getAdvertiserReputation } = await import("@/lib/strong-p4.functions");
  const scores = new Map<string, number>();
  const unique = [
    ...new Set(tasks.map((t) => String(t.advertiser || "").trim()).filter(Boolean)),
  ].slice(0, 40);
  await Promise.all(
    unique.map(async (adv) => {
      try {
        const r = await getAdvertiserReputation({ advertiser: adv });
        scores.set(adv.toLowerCase(), r.score);
      } catch {
        scores.set(adv.toLowerCase(), 70);
      }
    }),
  );
  return [...tasks].sort((a, b) => {
    const sa = scores.get(String(a.advertiser || "").toLowerCase()) ?? 70;
    const sb = scores.get(String(b.advertiser || "").toLowerCase()) ?? 70;
    if (sb !== sa) return sb - sa;
    return Number(b.reward ?? 0) - Number(a.reward ?? 0);
  });
}

export async function assertWatchSessionBound(opts: {
  sessionId: string;
  userId: string;
  minHeartbeats?: number;
}): Promise<void> {
  const minHb = Math.max(1, Number(opts.minHeartbeats ?? 2));
  try {
    const s = await admin();
    const { data: session } = await s
      .from("watch_video_sessions")
      .select("id, user_id, status, qualified_seconds, last_heartbeat_at, started_at, heartbeat_count")
      .eq("id", opts.sessionId)
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (!session) throw new Error("Watch session not found. Start the video again.");
    const row = session as {
      status?: string;
      last_heartbeat_at?: string | null;
      heartbeat_count?: number;
    };
    if (row.status === "completed") return;
    if (!row.last_heartbeat_at) {
      throw new Error("No watch heartbeats received. Keep the video playing in the foreground.");
    }
    const ageMs = Date.now() - new Date(row.last_heartbeat_at).getTime();
    if (ageMs > 90_000) {
      throw new Error("Watch session timed out. Resume playback and try again.");
    }
    const hbCount = Number(row.heartbeat_count ?? 0);
    if (hbCount > 0 && hbCount < minHb) {
      throw new Error("Not enough playback heartbeats. Watch a bit longer.");
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("Watch") ||
        e.message.includes("heartbeat") ||
        e.message.includes("session"))
    ) {
      throw e;
    }
  }
}

export function assertGeoMethodMatrix(opts: {
  countryCode?: string | null;
  method: string;
}): void {
  const cc = String(opts.countryCode || "").trim().toUpperCase();
  if (!cc || !(cc in GEO_METHOD_MATRIX)) return;
  const allowed = GEO_METHOD_MATRIX[cc]!;
  if (allowed.length === 0) {
    throw new Error(`Payouts are not available for your region (${cc}). Contact support.`);
  }
  const method = String(opts.method || "").toUpperCase();
  const ok = allowed.some((a) => method.includes(a.toUpperCase()));
  if (!ok) {
    throw new Error(`Payout method not allowed for ${cc}. Use: ${allowed.join(" / ")}.`);
  }
}

export async function shouldForceManualReview(opts: {
  userId: string;
}): Promise<boolean> {
  try {
    const s = await admin();
    const { count } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .in("status", ["verified", "approved", "auto_approved"] as never);
    return (count ?? 0) < FIRST_TASKS_MANUAL_COUNT;
  } catch {
    return false;
  }
}

export async function assertReferralDepthLimit(opts: {
  referrerUserId: string;
}): Promise<void> {
  if (REFERRAL_MAX_DEPTH < 1) return;
  try {
    const s = await admin();
    const { data: ref } = await s
      .from("profiles")
      .select("referred_by")
      .eq("id", opts.referrerUserId)
      .maybeSingle();
    const parent = String(
      (ref as { referred_by?: string | null } | null)?.referred_by || "",
    ).trim();
    if (parent) {
      throw new Error(
        "This invite code belongs to a referred account. Only root referrers can invite.",
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("invite code")) throw e;
  }
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const mintProofUploadToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + PROOF_SIGNED_TTL_SEC * 1000).toISOString();
    try {
      const s = await admin();
      await s.from("proof_upload_tokens").upsert(
        {
          user_id: context.userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
        } as never,
        { onConflict: "user_id" } as never,
      );
    } catch {
      /* table may not exist */
    }
    return { token, expiresAt, ttlSec: PROOF_SIGNED_TTL_SEC };
  });

export async function assertProofUploadToken(opts: {
  userId: string;
  token?: string | null;
}): Promise<void> {
  const token = String(opts.token || "").trim();
  if (!token) return;
  try {
    const tokenHash = await sha256Hex(token);
    const s = await admin();
    const { data } = await s
      .from("proof_upload_tokens")
      .select("expires_at")
      .eq("user_id", opts.userId)
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!data) throw new Error("Proof upload session expired. Re-open the task and upload again.");
    const exp = String((data as { expires_at?: string }).expires_at || "");
    if (exp && exp < new Date().toISOString()) {
      throw new Error("Proof upload session expired. Re-open the task and upload again.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Proof upload")) throw e;
  }
}

export async function assertStrictAddressCoolOff(opts: {
  userId: string;
  address: string;
}): Promise<void> {
  const addr = String(opts.address || "").trim().toLowerCase();
  if (!addr || addr.length < 10) return;
  try {
    const s = await admin();
    try {
      const { data: row } = await s
        .from("payout_address_allowlist")
        .select("created_at, address")
        .eq("user_id", opts.userId)
        .ilike("address", addr)
        .maybeSingle();
      if (row) {
        const created = String((row as { created_at?: string }).created_at || "");
        if (created) {
          const ageH = (Date.now() - new Date(created).getTime()) / 3600_000;
          if (ageH < ADDRESS_COOL_HOURS) {
            const left = Math.ceil(ADDRESS_COOL_HOURS - ageH);
            throw new Error(
              `New payout address is cooling down. Wait ~${left}h before withdrawing to this address (anti-theft).`,
            );
          }
        }
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("cooling down")) throw e;
    }
    try {
      const { data: existing } = await s
        .from("withdrawals")
        .select("id, created_at")
        .eq("user_id", opts.userId)
        .ilike("address", addr)
        .neq("status", "rejected")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!existing) {
        try {
          await s.from("payout_address_allowlist").upsert(
            {
              user_id: opts.userId,
              address: addr,
              created_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id,address" } as never,
          );
        } catch {
          /* soft */
        }
        throw new Error(
          `This address was just added. Wait ${ADDRESS_COOL_HOURS}h before the first payout (security cool-down).`,
        );
      }
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Wait") || e.message.includes("cooling"))) {
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("Wait") || e.message.includes("cooling"))) {
      throw e;
    }
  }
}

export const ownerGetFraudHeatMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const s = await admin();
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

    const deviceClusters: Array<{ fp: string; count: number; userIds: string[] }> = [];
    try {
      const { data: profs } = await s
        .from("profiles")
        .select("id, device_fp")
        .not("device_fp", "is", null)
        .gte("created_at", since)
        .limit(500);
      const map = new Map<string, string[]>();
      for (const p of profs ?? []) {
        const fp = String((p as { device_fp?: string }).device_fp || "").trim();
        const id = String((p as { id: string }).id);
        if (!fp) continue;
        if (!map.has(fp)) map.set(fp, []);
        map.get(fp)!.push(id);
      }
      for (const [fp, ids] of map) {
        if (ids.length >= 2) {
          deviceClusters.push({ fp: fp.slice(0, 12) + "…", count: ids.length, userIds: ids.slice(0, 8) });
        }
      }
      deviceClusters.sort((a, b) => b.count - a.count);
    } catch {
      /* soft */
    }

    const ipClusters: Array<{ ip: string; count: number }> = [];
    try {
      const { data: profs } = await s
        .from("profiles")
        .select("last_ip_hint")
        .not("last_ip_hint", "is", null)
        .gte("created_at", since)
        .limit(500);
      const map = new Map<string, number>();
      for (const p of profs ?? []) {
        const ip = String((p as { last_ip_hint?: string }).last_ip_hint || "").trim();
        if (!ip || ip === "0.0.0.0") continue;
        map.set(ip, (map.get(ip) ?? 0) + 1);
      }
      for (const [ip, count] of map) {
        if (count >= 2) ipClusters.push({ ip, count });
      }
      ipClusters.sort((a, b) => b.count - a.count);
    } catch {
      /* soft */
    }

    const walletClusters: Array<{ address: string; count: number }> = [];
    try {
      const { data: wds } = await s
        .from("withdrawals")
        .select("address, user_id")
        .neq("status", "rejected")
        .gte("created_at", since)
        .limit(400);
      const map = new Map<string, Set<string>>();
      for (const w of wds ?? []) {
        const addr = String((w as { address?: string }).address || "").trim().toLowerCase();
        const uid = String((w as { user_id?: string }).user_id || "");
        if (!addr || !uid) continue;
        if (!map.has(addr)) map.set(addr, new Set());
        map.get(addr)!.add(uid);
      }
      for (const [address, users] of map) {
        if (users.size >= 2) {
          walletClusters.push({
            address: address.slice(0, 10) + "…" + address.slice(-6),
            count: users.size,
          });
        }
      }
      walletClusters.sort((a, b) => b.count - a.count);
    } catch {
      /* soft */
    }

    let shadowbanned = 0;
    try {
      const { count } = await s
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .or("status.eq.shadowban,shadowbanned.eq.true");
      shadowbanned = count ?? 0;
    } catch {
      /* soft */
    }

    return {
      deviceClusters: deviceClusters.slice(0, 15),
      ipClusters: ipClusters.slice(0, 15),
      walletClusters: walletClusters.slice(0, 15),
      shadowbanned,
      since,
    };
  });

export async function autoCloseZeroSlotTasks(): Promise<{ closed: number; ids: string[] }> {
  const s = await admin();
  const ids: string[] = [];
  try {
    const { data: tasks } = await s
      .from("tasks")
      .select("id, title, advertiser, created_by, slots_left")
      .eq("is_active", true)
      .lte("slots_left", 0)
      .limit(50);
    for (const t of tasks ?? []) {
      const id = String((t as { id: string }).id);
      try {
        await s
          .from("tasks")
          .update({ is_active: false, status: "completed" } as never)
          .eq("id", id);
        ids.push(id);
      } catch {
        /* soft */
      }
    }
  } catch {
    /* soft */
  }
  return { closed: ids.length, ids };
}

export const ownerAutoCloseZeroSlotTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return autoCloseZeroSlotTasks();
  });
