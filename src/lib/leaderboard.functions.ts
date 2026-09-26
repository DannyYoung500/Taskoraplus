import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaderboardRow = {
  user_id: string;
  rank: number;
  display_name: string;
  username: string | null;
  photo_url: string | null;
  telegram_id: number | null;
  task_points: number;
  referrals: number;
  /** Sum of positive ledger amounts (real USDT credits) */
  usdt_earned: number;
  /** Verified task submissions only — real completions */
  tasks_completed: number;
};

/** Top earners — active users only. Real USDT ledger + Task Points + verified tasks + invites. */
export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LeaderboardRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, photo_url, telegram_id, status, task_points, referred_by")
      .order("task_points", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const active = (profiles ?? []).filter(
      (p) => String((p as { status?: string }).status ?? "active") === "active",
    );
    const ids = active.map((p) => p.id);

    const usdtMap = new Map<string, number>();
    const tasksMap = new Map<string, number>();
    if (ids.length) {
      const [{ data: txs }, { data: subs }] = await Promise.all([
        supabaseAdmin.from("transactions").select("user_id, amount").in("user_id", ids).gt("amount", 0),
        supabaseAdmin
          .from("submissions")
          .select("user_id")
          .in("user_id", ids)
          .eq("status", "verified"),
      ]);
      for (const t of txs ?? []) {
        const uid = String((t as { user_id: string }).user_id);
        usdtMap.set(uid, (usdtMap.get(uid) ?? 0) + Number((t as { amount: number }).amount));
      }
      for (const s of subs ?? []) {
        const uid = String((s as { user_id: string }).user_id);
        tasksMap.set(uid, (tasksMap.get(uid) ?? 0) + 1);
      }
    }

    const refCounts = new Map<string, number>();
    for (const p of profiles ?? []) {
      const ref = (p as { referred_by?: string | null }).referred_by;
      if (ref) refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1);
    }

    return active.map((p, i) => ({
      user_id: p.id,
      rank: i + 1,
      display_name: String(p.display_name ?? "").trim() || "Tasker",
      username: (p as { username?: string | null }).username ?? null,
      photo_url: (p as { photo_url?: string | null }).photo_url ?? null,
      telegram_id: (p as { telegram_id?: number | null }).telegram_id ?? null,
      task_points: Number((p as { task_points?: number | null }).task_points ?? 0),
      referrals: refCounts.get(p.id) ?? 0,
      usdt_earned: Number((usdtMap.get(p.id) ?? 0).toFixed(4)),
      tasks_completed: tasksMap.get(p.id) ?? 0,
    }));
  });
