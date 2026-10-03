/**
 * Withdrawal elite gates: trust, Telegram quality, graduated daily cap.
 * Soft-fail when columns missing.
 */
export async function runEliteWithdrawalGates(opts: {
  userId: string;
  amount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
}): Promise<void> {
  const { userId, amount, supabaseAdmin } = opts;

  // Trust min 40 + Telegram quality min 35
  try {
    const { assertTrustScoreForAction, assertTelegramQualityGate } = await import(
      "@/lib/strong-elite.functions"
    );
    await assertTrustScoreForAction({ userId, minTrust: 40, actionLabel: "withdrawal" });
    const { data: qProf } = await supabaseAdmin
      .from("profiles")
      .select("username, photo_url, display_name, is_premium")
      .eq("id", userId)
      .maybeSingle();
    await assertTelegramQualityGate({
      userId,
      minScore: 35,
      username: qProf?.username,
      firstName: qProf?.display_name,
      photoUrl: qProf?.photo_url,
      isPremium: qProf?.is_premium,
    });
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("Trust score") || e.message.includes("quality too low"))
    ) {
      throw e;
    }
  }

  // Graduated daily cap by trust: 40–60 → $5 · 60–80 → $15 · 80+ → $500
  try {
    const { data: trustProf } = await supabaseAdmin
      .from("profiles")
      .select("trust_score")
      .eq("id", userId)
      .maybeSingle();
    const trust = Number(trustProf?.trust_score ?? 70);
    let dailyCap = 500;
    if (trust < 60) dailyCap = 5;
    else if (trust < 80) dailyCap = 15;
    const dayStart = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
    const { data: todayWds } = await supabaseAdmin
      .from("withdrawals")
      .select("amount")
      .eq("user_id", userId)
      .neq("status", "rejected")
      .gte("created_at", dayStart);
    const usedToday = (todayWds ?? []).reduce(
      (s: number, w: { amount?: number }) => s + Math.abs(Number(w.amount ?? 0)),
      0,
    );
    if (usedToday + amount > dailyCap + 0.0001) {
      throw new Error(
        `Daily withdrawal limit for your trust level (${trust}) is $${dailyCap.toFixed(2)}. Used today: $${usedToday.toFixed(2)}.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Daily withdrawal limit")) throw e;
  }
}
