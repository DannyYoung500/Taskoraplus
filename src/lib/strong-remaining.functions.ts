/** Soft KYC+ and cluster block compatibility layer. */
export async function assertSoftKycPlus(opts: {
  userId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("trust_score, hold_until")
      .eq("id", opts.userId)
      .maybeSingle();
    const hold = (data as { hold_until?: string | null } | null)?.hold_until;
    if (hold && new Date(hold).getTime() > Date.now()) {
      return { ok: false, reason: "Account temporarily held. Try again later." };
    }
    const trust = Number((data as { trust_score?: number } | null)?.trust_score ?? 70);
    if (trust < 25) {
      return { ok: false, reason: "Trust score too low for this action." };
    }
  } catch {
    /* soft ok */
  }
  return { ok: true };
}

export async function assertClusterNotBlocked(opts: { userId: string }): Promise<void> {
  try {
    const { assertDeviceClusterOk } = await import("@/lib/strong-next.functions");
    await assertDeviceClusterOk({ userId: opts.userId, forWithdraw: true });
  } catch (e) {
    if (e instanceof Error && (e.message.includes("accounts") || e.message.includes("device"))) {
      throw e;
    }
  }
}
