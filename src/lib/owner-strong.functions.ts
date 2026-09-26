/**
 * Strong owner controls: wallet freeze + Telegram ops digest.
 * Kept separate for clean deploys.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner, audit } from "@/lib/owner-guard.server";

/** Freeze / unfreeze a user's ability to withdraw (owner only). */
export const ownerSetWalletFrozen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; frozen: boolean; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        wallet_frozen: Boolean(data.frozen),
        wallet_frozen_reason: data.frozen
          ? (data.reason?.trim().slice(0, 200) || "Frozen by owner")
          : null,
        wallet_frozen_at: data.frozen ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit({
      adminId: context.userId,
      action: data.frozen ? "wallet.freeze" : "wallet.unfreeze",
      targetType: "user",
      targetId: data.userId,
      metadata: { reason: data.reason ?? null },
    }).catch(() => undefined);
    return { ok: true, frozen: Boolean(data.frozen) };
  });

/** Build + send ops digest to owner Telegram (online, queues, new users). */
export const ownerSendOpsDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ONLINE_MS } = await import("@/lib/locale-geo");
    const now = Date.now();
    const since24 = new Date(now - 86_400_000).toISOString();

    const [profilesRes, wdRes, subRes, flagsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, last_active_at, created_at, country_code, status")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin.from("withdrawals").select("id, amount", { count: "exact" }).eq("status", "pending"),
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("fraud_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);

    const rows = profilesRes.data ?? [];
    let online = 0;
    let new24h = 0;
    const byCc = new Map<string, number>();
    for (const p of rows) {
      const last = (p as { last_active_at?: string | null }).last_active_at;
      if (last) {
        const t = new Date(last).getTime();
        if (Number.isFinite(t) && now - t <= ONLINE_MS) online += 1;
      }
      const created = (p as { created_at?: string }).created_at;
      if (created && created >= since24) new24h += 1;
      const cc = String((p as { country_code?: string | null }).country_code ?? "").trim().toUpperCase();
      if (cc) byCc.set(cc, (byCc.get(cc) ?? 0) + 1);
    }
    const topCountries = [...byCc.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, n]) => `${c}:${n}`)
      .join(" · ");

    const pendingWd = wdRes.count ?? 0;
    const pendingAmt = (wdRes.data ?? []).reduce(
      (s, w) => s + Number((w as { amount?: number }).amount ?? 0),
      0,
    );
    const pendingSub = subRes.count ?? 0;
    const openFlags = flagsRes.count ?? 0;

    const msg =
      `📊 <b>TASKORA Ops Digest</b>\n` +
      `Online now: <b>${online}</b>\n` +
      `Users (sample): ${rows.length}\n` +
      `New 24h: <b>${new24h}</b>\n` +
      `Pending WD: <b>${pendingWd}</b> ($${pendingAmt.toFixed(2)})\n` +
      `Pending reviews: <b>${pendingSub}</b>\n` +
      `Open fraud flags: <b>${openFlags}</b>\n` +
      (topCountries ? `Top countries: ${topCountries}\n` : "") +
      `Time: ${new Date().toISOString()}`;

    const { sendOwnerHtml } = await import("@/lib/notify-owner");
    await sendOwnerHtml(msg);
    await audit({
      adminId: context.userId,
      action: "ops.digest",
      targetType: "system",
      metadata: { online, new24h, pendingWd, pendingSub, openFlags },
    }).catch(() => undefined);

    return {
      ok: true,
      online,
      new24h,
      pendingWd,
      pendingAmt,
      pendingSub,
      openFlags,
    };
  });

/** Pending withdrawals enriched with risk, country, presence, freeze. */
export const listPendingWithdrawalsWithRisk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeUserRiskScore } = await import("@/lib/owner-ops.functions");
    const { presenceFromLastActive, formatCountryLine } = await import("@/lib/locale-geo");

    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select(
        "*, profiles:user_id(display_name, username, telegram_id, photo_url, last_active_at, country, country_code, language_code, wallet_frozen)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const enriched = [];
    for (const row of rows as any[]) {
      const uid = String(row.user_id);
      let risk = { score: 0, signals: [] as string[] };
      try {
        risk = await computeUserRiskScore(uid);
      } catch {
        /* soft */
      }
      const prof = row.profiles ?? {};
      const presence = presenceFromLastActive(prof.last_active_at ?? null);
      const country_line = formatCountryLine({
        country: prof.country,
        country_code: prof.country_code,
        language_code: prof.language_code,
      });
      enriched.push({
        ...row,
        photo_url: prof.photo_url ?? null,
        display_name: prof.display_name ?? null,
        username: prof.username ?? null,
        risk_score: risk.score,
        risk_signals: risk.signals,
        presence_status: presence.status,
        presence_label: presence.label,
        country_line,
        wallet_frozen: Boolean(prof.wallet_frozen),
      });
    }
    return enriched;
  });
