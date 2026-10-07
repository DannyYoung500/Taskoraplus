/**
 * Strong next wave (server-only):
 * C  perceptual-ish proof key
 * D  referral graph depth limit
 * E  graduated daily earn cap by trust
 * F  owner unfreeze cluster + audit
 * H  public masked payout ledger
 * J  connected-account before first withdrawal
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** C · Normalize proof into a stable perceptual-ish key (strip tracking query params). */
export async function proofPerceptualKey(opts: {
  proofText?: string | null;
  proofUrl?: string | null;
}): Promise<string | null> {
  let url = String(opts.proofUrl ?? "").trim().toLowerCase();
  const text = String(opts.proofText ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (url) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid", "t"].forEach((k) =>
        u.searchParams.delete(k),
      );
      url = `${u.hostname}${u.pathname}`.replace(/\/+$/, "");
    } catch {
      url = url.split("?")[0] ?? url;
    }
  }
  const material = [url, text].filter((x) => x && x.length >= 6).join("|");
  if (!material || material.length < 8) return null;
  return (await sha256Hex(material)).slice(0, 40);
}

/** C · Reject recycled perceptual keys across accounts. */
export async function assertProofPerceptualUnique(opts: {
  userId: string;
  proofText?: string | null;
  proofUrl?: string | null;
}): Promise<{ key: string | null }> {
  const key = await proofPerceptualKey(opts);
  if (!key) return { key: null };
  try {
    const s = await adminClient();
    const { data } = await s
      .from("submissions")
      .select("id, user_id")
      .eq("proof_perceptual_key", key)
      .limit(5);
    const other = (data ?? []).find((r) => r.user_id !== opts.userId);
    if (other) {
      throw new Error(
        "This proof appears recycled (same image/link fingerprint as another account). Submit original proof only.",
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("recycled")) throw e;
  }
  return { key };
}

/** D · Referral depth / cycle guard (max depth 2). */
export async function assertReferralDepthOk(opts: {
  inviterId: string;
  refereeId: string;
  maxDepth?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const maxDepth = opts.maxDepth ?? 2;
  try {
    const s = await adminClient();
    let cursor: string | null = opts.inviterId;
    const seen = new Set<string>([opts.refereeId]);
    for (let depth = 0; depth < maxDepth + 2 && cursor; depth++) {
      if (seen.has(cursor)) return { ok: false, reason: "referral_cycle" };
      seen.add(cursor);
      if (depth >= maxDepth) return { ok: false, reason: `depth_exceeded:${depth}` };
      const { data } = await s
        .from("profiles")
        .select("referred_by")
        .eq("id", cursor)
        .maybeSingle();
      cursor = (data as { referred_by?: string | null } | null)?.referred_by ?? null;
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/** E · Daily earn cap by trust score. */
export async function assertDailyEarnCapByTrust(opts: {
  userId: string;
  addAmount: number;
}): Promise<{ cap: number; earnedToday: number }> {
  if (opts.addAmount <= 0) return { cap: 999, earnedToday: 0 };
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("trust_score")
      .eq("id", opts.userId)
      .maybeSingle();
    const trust = Number((profile as { trust_score?: number } | null)?.trust_score ?? 70);
    let cap = 25;
    if (trust < 40) cap = 3;
    else if (trust < 55) cap = 8;
    else if (trust < 70) cap = 15;
    else if (trust >= 85) cap = 50;

    const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
    const { data: txs } = await s
      .from("transactions")
      .select("amount")
      .eq("user_id", opts.userId)
      .in("kind", ["reward", "referral", "bonus"])
      .gt("amount", 0)
      .gte("created_at", dayStart);
    const earnedToday = (txs ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    if (earnedToday + opts.addAmount > cap) {
      throw new Error(
        `Daily earn limit reached ($${cap.toFixed(2)} for your trust level). Try again tomorrow.`,
      );
    }
    return { cap, earnedToday };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily earn")) throw e;
    return { cap: 999, earnedToday: 0 };
  }
}

/** F · Owner unfreeze wallet + audit. */
export const ownerUnfreezeWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner, audit } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const s = await adminClient();
    const { data: prev } = await s
      .from("profiles")
      .select("wallet_frozen, wallet_frozen_reason")
      .eq("id", data.userId)
      .maybeSingle();
    const { error } = await s
      .from("profiles")
      .update({
        wallet_frozen: false,
        wallet_frozen_reason: null,
        wallet_frozen_at: null,
      } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit({
      adminId: context.userId,
      action: "wallet.unfreeze",
      targetType: "user",
      targetId: data.userId,
      previous: prev,
      next: { note: data.note ?? "manual unfreeze" },
    });
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(
        `🔓 <b>Wallet unfrozen</b>\nUser <code>${data.userId.slice(0, 8)}</code>\nNote: ${data.note ?? "—"}`,
      );
    } catch {
      /* soft */
    }
    return { ok: true as const };
  });

/** H · Public masked paid withdrawals. */
export const getPublicPayoutLedger = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const s = await adminClient();
    const { data } = await s
      .from("withdrawals")
      .select("id, amount, method, address, tx_hash, created_at, updated_at, status, user_id")
      .in("status", ["paid", "completed"])
      .order("updated_at", { ascending: false })
      .limit(40);

    const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles } = await s
        .from("profiles")
        .select("id, display_name, username")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        const name =
          String((p as { display_name?: string }).display_name ?? "").trim() ||
          (String((p as { username?: string }).username ?? "").trim()
            ? `@${String((p as { username?: string }).username).trim()}`
            : "Tasker");
        const masked = name.startsWith("@")
          ? `@${name.slice(1, 2)}***`
          : `${name.slice(0, 1)}***`;
        names.set(p.id, masked);
      }
    }

    return (data ?? []).map((r) => {
      const addr = String(r.address ?? "");
      const tx = String(r.tx_hash ?? "").trim();
      return {
        id: String(r.id).slice(0, 8),
        amount: Number(r.amount ?? 0),
        method: String(r.method ?? "USDT"),
        addressMasked: addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "••••",
        txMasked: tx ? `${tx.slice(0, 8)}…` : null,
        name: names.get(r.user_id) ?? "T***",
        at: r.updated_at ?? r.created_at,
      };
    });
  } catch {
    return [];
  }
});

/** J · Require connected account before first withdrawal. */
export async function assertConnectedBeforeFirstWithdrawal(opts: {
  userId: string;
}): Promise<void> {
  try {
    const s = await adminClient();
    const { count: paid } = await s
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId)
      .in("status", ["paid", "completed", "approved"]);
    if (Number(paid ?? 0) > 0) return;

    const { count: connected } = await s
      .from("connected_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", opts.userId);
    if (Number(connected ?? 0) < 1) {
      throw new Error(
        "Connect at least one social account (Connected Accounts) before your first withdrawal.",
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Connect at least")) throw e;
  }
}

export async function runEarnGuards(opts: {
  userId: string;
  amount: number;
}): Promise<void> {
  await assertDailyEarnCapByTrust({ userId: opts.userId, addAmount: opts.amount });
}
