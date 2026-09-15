import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaderboardRow = {
  user_id: string;
  rank: number;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  telegram_id: number | null;
  earned: number;
  referrals: number;
};

/** Top earners with real profile + referral counts (ledger-based). */
export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LeaderboardRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: txs, error } = await supabaseAdmin
      .from("transactions")
      .select("user_id, amount");
    if (error) throw new Error(error.message);

    const sums = new Map<string, number>();
    for (const t of txs ?? []) {
      const a = Number(t.amount);
      if (!(a > 0)) continue;
      sums.set(t.user_id, (sums.get(t.user_id) ?? 0) + a);
    }

    const top = [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
    if (top.length === 0) return [];

    const ids = top.map(([id]) => id);

    const [{ data: profiles }, { data: allProfiles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, username, avatar_url, telegram_id")
        .in("id", ids),
      supabaseAdmin.from("profiles").select("id, referred_by").not("referred_by", "is", null),
    ]);

    const refCounts = new Map<string, number>();
    for (const p of allProfiles ?? []) {
      const ref = (p as { referred_by?: string | null }).referred_by;
      if (!ref) continue;
      refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1);
    }

    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        {
          display_name: p.display_name as string | null,
          username: (p as { username?: string | null }).username ?? null,
          avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
          telegram_id: (p as { telegram_id?: number | null }).telegram_id ?? null,
        },
      ]),
    );

    return top.map(([user_id, earned], i) => {
      const p = byId.get(user_id);
      return {
        user_id,
        rank: i + 1,
        display_name: p?.display_name?.trim() || "Tasker",
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
        telegram_id: p?.telegram_id ?? null,
        earned,
        referrals: refCounts.get(user_id) ?? 0,
      };
    });
  });
