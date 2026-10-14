/**
 * Compatibility shim — money session + initData gate.
 * Real logic lives in money-session + telegram-initdata.
 */
export async function assertMoneySessionOrInitData(opts: {
  userId: string;
  sessionToken?: string | null;
  initData?: string | null;
  maxAgeSeconds?: number;
}): Promise<void> {
  if (opts.sessionToken) {
    try {
      const { assertMoneySession } = await import("@/lib/money-session.functions");
      await assertMoneySession({ userId: opts.userId, token: opts.sessionToken });
      return;
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Security session") || e.message.includes("expired"))) {
        /* fall through */
      }
    }
  }

  const { assertHardInitDataForMoney } = await import("@/lib/telegram-initdata");
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  let expectedTg: number | string | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id")
      .eq("id", opts.userId)
      .maybeSingle();
    expectedTg = (data as { telegram_id?: number | string } | null)?.telegram_id ?? null;
  } catch {
    /* soft */
  }
  await assertHardInitDataForMoney({
    initData: opts.initData,
    expectedTelegramId: expectedTg,
    maxAgeSeconds: opts.maxAgeSeconds ?? 120,
  });
}
