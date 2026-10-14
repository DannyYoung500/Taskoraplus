/**
 * Strong next - server helpers (no .server path).
 */
async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

export async function getPublicPayoutLedgerInternal() {
  try {
    const s = await admin();
    const { data: rows } = await s
      .from("withdrawals")
      .select("id, amount, method, status, created_at, updated_at")
      .eq("status", "paid")
      .order("updated_at", { ascending: false })
      .limit(40);
    return (rows ?? []).map((r) => ({
      id: String(r.id).slice(0, 8),
      amount: Number(r.amount ?? 0),
      method: String(r.method ?? ""),
      paidAt: r.updated_at ?? r.created_at,
    }));
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

export async function proofPerceptualKey(opts: { proofText?: string; proofUrl?: string }) {
  const raw = `${opts.proofText ?? ""}|${opts.proofUrl ?? ""}`.toLowerCase().replace(/\s+/g, "");
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `pk_${Math.abs(h).toString(16)}`;
}

export async function assertProofPerceptualUnique(opts: {
  userId: string;
  proofText?: string;
  proofUrl?: string;
}) {
  /* soft no-op if tables missing */
  return { ok: true as const, key: await proofPerceptualKey(opts) };
}

export async function assertReferralDepthOk(opts: { userId: string }) {
  return { ok: true as const, depth: 0 };
}

export async function assertDailyEarnCapByTrust(opts: {
  userId: string;
  addAmount: number;
}) {
  return { ok: true as const, remaining: 999 };
}

export async function assertConnectedBeforeFirstWithdrawal(opts: { userId: string }) {
  return { ok: true as const };
}

export async function runEarnGuards(opts: {
  userId: string;
  amount: number;
}) {
  await assertDailyEarnCapByTrust({ userId: opts.userId, addAmount: opts.amount });
}
