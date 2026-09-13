import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** All-time leaderboard from positive transaction sums (real ledger only). */
export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: txs, error } = await supabaseAdmin.from("transactions").select("user_id, amount");
    if (error) throw new Error(error.message);

    const sums = new Map<string, number>();
    for (const t of txs ?? []) {
      const a = Number(t.amount);
      if (a <= 0) continue;
      sums.set(t.user_id, (sums.get(t.user_id) ?? 0) + a);
    }

    const top = [...sums.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    if (top.length === 0) return [];

    const ids = top.map(([id]) => id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    return top.map(([user_id, earned]) => ({
      user_id,
      display_name: nameById.get(user_id) ?? "Tasker",
      earned,
    }));
  });
