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
