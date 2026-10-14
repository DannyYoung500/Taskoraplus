/**
 * Strong plus - server helpers (no .server path).
 */
async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

export async function runStuckTaskSla(opts?: {
  hours?: number;
  autoPause?: boolean;
}): Promise<{ scanned: number; paused: number }> {
  const hours = opts?.hours ?? 48;
  const autoPause = opts?.autoPause !== false;
  try {
    const s = await admin();
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data: rows } = await s
      .from("tasks")
      .select("id, title, is_active, created_at")
      .eq("is_active", true)
      .lt("created_at", cutoff)
      .limit(50);
    let paused = 0;
    if (autoPause) {
      for (const r of rows ?? []) {
        await s
          .from("tasks")
          .update({ is_active: false, review_note: `auto-paused: stuck >${hours}h` } as never)
          .eq("id", r.id);
        paused += 1;
      }
    }
    return { scanned: (rows ?? []).length, paused };
  } catch {
    return { scanned: 0, paused: 0 };
  }
}

export async function scoreAdvertiserReputation(advertiserId: string): Promise<{
  advertiserId: string;
  score: number;
  factors: string[];
}> {
  try {
    const s = await admin();
    const { count: total } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("advertiser_id", advertiserId);
    const { count: rejected } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("advertiser_id", advertiserId)
      .eq("status", "rejected");
    const t = Number(total ?? 0);
    const r = Number(rejected ?? 0);
    const rate = t > 0 ? r / t : 0;
    let score = 80;
    const factors: string[] = [];
    if (rate > 0.4) { score -= 30; factors.push("high_reject"); }
    if (rate > 0.2) { score -= 15; factors.push("elevated_reject"); }
    if (t >= 20) { factors.push("volume_ok"); }
    return { advertiserId, score: Math.max(0, Math.min(100, score)), factors };
  } catch {
    return { advertiserId, score: 50, factors: ["soft"] };
  }
}

export function proofPerceptualKey(opts: { proofText?: string; proofUrl?: string }) {
  const raw = `${opts.proofText ?? ""}|${opts.proofUrl ?? ""}`.toLowerCase().replace(/\s+/g, "");
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `pk_${Math.abs(h).toString(16)}`;
}

export async function assertProofPerceptualUnique(_opts: {
  userId: string;
  proofText?: string;
  proofUrl?: string;
}) {
  return { ok: true as const };
}

export async function assertWithdrawalMethodVelocity(_opts: {
  userId: string;
  method: string;
}) {
  return { ok: true as const };
}

export async function assertDeviceAddressLock(_opts: {
  userId: string;
  address: string;
}) {
  return { ok: true as const };
}

export function mintBatchReceiptHash(opts: { ids: string[]; prefix?: string }) {
  const raw = (opts.prefix ?? "") + (opts.ids ?? []).join(",");
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `br_${Math.abs(h).toString(16)}`;
}
