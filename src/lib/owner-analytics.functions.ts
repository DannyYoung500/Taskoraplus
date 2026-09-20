/**
 * Owner analytics: country breakdown, online counts, growth.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(userId: string) {
  const { assertOwner, admin } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return admin();
}

export const ownerGetAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { ONLINE_MS, RECENT_MS } = await import("@/lib/locale-geo");

    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, created_at, status, country, country_code, language_code, last_active_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const rows = profiles ?? [];
    const now = Date.now();
    let online = 0;
    let recent = 0;
    const byCountry = new Map<string, number>();
    const byStatus = { active: 0, suspended: 0, banned: 0, other: 0 };
    const dayMs = 86_400_000;
    let new24h = 0;
    let new7d = 0;
    let new30d = 0;

    for (const p of rows) {
      const st = String((p as { status?: string }).status ?? "active");
      if (st === "active") byStatus.active += 1;
      else if (st === "suspended") byStatus.suspended += 1;
      else if (st === "banned") byStatus.banned += 1;
      else byStatus.other += 1;

      const last = (p as { last_active_at?: string | null }).last_active_at;
      if (last) {
        const t = new Date(last).getTime();
        if (Number.isFinite(t)) {
          const d = now - t;
          if (d <= ONLINE_MS) online += 1;
          else if (d <= RECENT_MS) recent += 1;
        }
      }

      const created = (p as { created_at?: string }).created_at;
      if (created) {
        const c = new Date(created).getTime();
        if (Number.isFinite(c)) {
          const age = now - c;
          if (age <= dayMs) new24h += 1;
          if (age <= 7 * dayMs) new7d += 1;
          if (age <= 30 * dayMs) new30d += 1;
        }
      }

      const code = String((p as { country_code?: string | null }).country_code ?? "").trim().toUpperCase();
      const name = String((p as { country?: string | null }).country ?? "").trim();
      const key = code || name || "Unknown";
      byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
    }

    const countries = [...byCountry.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const [subs, wds, txs] = await Promise.all([
      db.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("transactions").select("amount, kind").limit(5000),
    ]);

    const rewardsPaid = (txs.data ?? [])
      .filter((t) => ["reward", "referral", "bonus"].includes(String(t.kind)))
      .reduce((s, t) => s + Number(t.amount), 0);

    return {
      totalUsers: rows.length,
      online,
      recent,
      offline: Math.max(0, rows.length - online - recent),
      byStatus,
      countries,
      new24h,
      new7d,
      new30d,
      pendingReviews: subs.count ?? 0,
      pendingWithdrawals: wds.count ?? 0,
      rewardsPaid,
    };
  });
