/** Premium strong A: IP v2, perceptual v2, dual-control, geo v2 */
import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function assertAdmin(userId: string) {
  const { assertOwner } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
}
function ipFamily(ip: string): string {
  const t = ip.trim();
  if (!t) return "";
  if (t.includes(".")) return t.split(".").slice(0, 3).join(".");
  if (t.includes(":")) return t.split(":").slice(0, 4).join(":");
  return t.slice(0, 12);
}

/* ───────── 3 · IP-family velocity v2 ───────── */
export async function assertIpFamilyVelocityV2(opts: {
  userId: string;
  ipHint?: string | null;
}): Promise<{ accounts: number; dualRequired: boolean; blocked?: string }> {
  const { RULES } = await import("@/lib/platform-rules");
  const family = ipFamily(opts.ipHint ?? "");
  if (!family || family.length < 4) return { accounts: 1, dualRequired: false };

  try {
    const s = await admin();
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: rows } = await s
      .from("profiles")
      .select("id, last_ip_hint, last_seen_at, device_fp")
      .ilike("last_ip_hint", `${family}%`)
      .gte("last_seen_at", since)
      .limit(50);

    const accounts = new Set((rows ?? []).map((r) => r.id)).size;
    const fps = new Set(
      (rows ?? [])
        .map((r) => String((r as { device_fp?: string }).device_fp || ""))
        .filter((f) => f.length >= 8),
    );

    if (accounts >= RULES.hardBlockAccountsPerIpFamily24h || fps.size >= 12) {
      return {
        accounts,
        dualRequired: true,
        blocked:
          "Too many accounts from this network in 24h. Withdrawals blocked — contact support.",
      };
    }

    return {
      accounts,
      dualRequired: accounts >= RULES.maxAccountsPerIpFamily24h || fps.size >= 6,
    };
  } catch {
    return { accounts: 1, dualRequired: false };
  }
}

/* ───────── 4 · Proof perceptual hash v2 ───────── */
export function proofPerceptualKeyV2(opts: {
  proofText?: string | null;
  proofUrl?: string | null;
}): string | null {
  const parts: string[] = [];
  if (opts.proofUrl) {
    let u = String(opts.proofUrl).trim().toLowerCase();
    try {
      const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
      u = `${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, "");
    } catch {
      u = u.split("?")[0].split("#")[0];
    }
    u = u
      .replace(/\/(w|h|s|q|c)\d+\//g, "/")
      .replace(/_\d+x\d+/g, "")
      .replace(/\/thumb(nail)?s?\//g, "/")
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
    if (u.length >= 8) parts.push(u);
  }
  if (opts.proofText) {
    const t = String(opts.proofText)
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[0-9a-f]{8,}/gi, "")
      .replace(/\b\d{6,}\b/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    if (t.length >= 16) parts.push(t);
  }
  if (!parts.length) return null;
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function assertProofPerceptualV2(opts: {
  userId: string;
  proofText?: string | null;
  proofUrl?: string | null;
}): Promise<{ proofHash: string | null; perceptualKey: string | null }> {
  const { assertProofNotRecycled } = await import("@/lib/strong-ops");
  const base = await assertProofNotRecycled(opts);
  const pKey = proofPerceptualKeyV2(opts);
  if (!pKey) return { proofHash: base.proofHash, perceptualKey: null };

  try {
    const s = await admin();
    const { data } = await s
      .from("submissions")
      .select("id, user_id, proof_hash, proof_url, proof_text")
      .neq("user_id", opts.userId)
      .order("created_at", { ascending: false })
      .limit(500);

    for (const row of data ?? []) {
      const otherKey = proofPerceptualKeyV2({
        proofUrl: (row as { proof_url?: string }).proof_url,
        proofText: (row as { proof_text?: string }).proof_text,
      });
      if (otherKey && otherKey === pKey) {
        throw new Error(
          "This proof looks like a recycled screenshot/link used by another account. Submit original proof only.",
        );
      }
      const ph = String((row as { proof_hash?: string }).proof_hash ?? "");
      if (ph && base.proofHash && ph === base.proofHash) {
        throw new Error("This proof was already used on another account.");
      }
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("proof") || e.message.includes("recycled") || e.message.includes("original"))
    ) {
      throw e;
    }
  }
  return { proofHash: base.proofHash, perceptualKey: pKey };
}

/* ───────── 7 · Country / method geo-match v2 ───────── */
const GEO_METHOD_RULES: Array<{
  methodRe: RegExp;
  allowed: string[];
  label: string;
}> = [
  { methodRe: /OPAY|PALMPAY|MONIEPOINT|GTBANK|ACCESS|UBA|ZENITH|NGN/i, allowed: ["NG"], label: "Nigerian bank/wallet" },
  { methodRe: /MTN.?MOMO|VODAFONE|AIRTELTIGO|GHS/i, allowed: ["GH"], label: "Ghana mobile money" },
  { methodRe: /MPESA|SAFARICOM|KES/i, allowed: ["KE"], label: "Kenya M-Pesa" },
  { methodRe: /WAVE|ORANGE.?MONEY|XOF|XAF/i, allowed: ["SN", "CI", "BF", "ML", "TG", "BJ", "CM"], label: "West/Central Africa mobile money" },
  { methodRe: /GCASH|MAYA|PHP/i, allowed: ["PH"], label: "Philippines e-wallet" },
  { methodRe: /JAZZCASH|EASYPAISA|PKR/i, allowed: ["PK"], label: "Pakistan wallet" },
  { methodRe: /BKASH|NAGAD|BDT/i, allowed: ["BD"], label: "Bangladesh wallet" },
  { methodRe: /UPI|PAYTM|PHONEPE|INR/i, allowed: ["IN"], label: "India UPI" },
];

export function assertGeoMethodMatchV2(opts: {
  countryCode: string;
  method: string;
  hardBlock?: boolean;
}): { dualRequired: boolean; blocked?: string } {
  const cc = String(opts.countryCode || "").trim().toUpperCase();
  if (!cc || cc.length !== 2) return { dualRequired: false };
  const method = String(opts.method || "");
  const hard = opts.hardBlock !== false;

  for (const rule of GEO_METHOD_RULES) {
    if (!rule.methodRe.test(method)) continue;
    if (rule.allowed.includes(cc)) return { dualRequired: false };
    if (hard) {
      return {
        dualRequired: true,
        blocked: `${rule.label} requires profile country in [${rule.allowed.join(", ")}] (yours: ${cc}).`,
      };
    }
    return { dualRequired: true };
  }
  return { dualRequired: false };
}

/* ───────── 5 · Withdrawal dual-control (centralized) ───────── */
export async function assertWithdrawalDualControl(opts: {
  userId: string;
  amount: number;
  method: string;
  address: string;
  ipHint?: string | null;
  countryCode?: string | null;
}): Promise<{ requiresDual: boolean; reasons: string[]; blocked?: string }> {
  const reasons: string[] = [];
  let requiresDual = false;
  const { RULES } = await import("@/lib/platform-rules");

  if (opts.amount >= Number(RULES.maxAutoWithdrawalUsd) * 0.1 || opts.amount >= 25) {
    requiresDual = true;
    reasons.push("amount");
  }

  try {
    const { applyGraduatedWithdrawalHold } = await import("@/lib/strong-ops");
    const g = await applyGraduatedWithdrawalHold({
      userId: opts.userId,
      requiresDual,
    });
    if (g.requiresDual) {
      requiresDual = true;
      reasons.push(`graduated_hold:${g.paidCount}`);
    }
  } catch {
    /* soft */
  }

  try {
    const { applyNewDeviceWithdrawalLock } = await import("@/lib/strong-wave.functions");
    const nd = await applyNewDeviceWithdrawalLock({
      userId: opts.userId,
      amount: opts.amount,
      requiresDual,
    });
    if (nd.blocked) return { requiresDual: true, reasons: [...reasons, "new_device"], blocked: nd.blocked };
    if (nd.requiresDual) {
      requiresDual = true;
      reasons.push("new_device");
    }
  } catch {
    /* soft */
  }

  const ipV = await assertIpFamilyVelocityV2({
    userId: opts.userId,
    ipHint: opts.ipHint,
  });
  if (ipV.blocked) {
    return { requiresDual: true, reasons: [...reasons, "ip_family"], blocked: ipV.blocked };
  }
  if (ipV.dualRequired) {
    requiresDual = true;
    reasons.push(`ip_family:${ipV.accounts}`);
  }

  if (opts.countryCode) {
    const geo = assertGeoMethodMatchV2({
      countryCode: opts.countryCode,
      method: opts.method,
    });
    if (geo.blocked) {
      return { requiresDual: true, reasons: [...reasons, "geo"], blocked: geo.blocked };
    }
    if (geo.dualRequired) {
      requiresDual = true;
      reasons.push("geo_mismatch");
    }
  }

  try {
    const s = await admin();
    const { data: prof } = await s
      .from("profiles")
      .select("device_fp")
      .eq("id", opts.userId)
      .maybeSingle();
    const fp = (prof as { device_fp?: string } | null)?.device_fp;
    if (fp && String(fp).length >= 8) {
      const { count } = await s
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("device_fp", fp);
      if ((count ?? 0) >= 2) {
        requiresDual = true;
        reasons.push(`device_cluster:${count}`);
      }
      if ((count ?? 0) >= RULES.maxAccountsPerDevice) {
        return {
          requiresDual: true,
          reasons: [...reasons, "device_hard"],
          blocked: "Withdrawal blocked: this device is linked to too many accounts. Contact support.",
        };
      }
    }
  } catch {
    /* soft */
  }

  return { requiresDual, reasons };
}
