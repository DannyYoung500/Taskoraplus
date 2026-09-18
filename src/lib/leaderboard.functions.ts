import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaderboardRow = {
  user_id: string;
  rank: number;
  display_name: string;
  username: string | null;
  /** Telegram profile photo URL stored on profiles.photo_url */
  photo_url: string | null;
  telegram_id: number | null;
  earned: number;
  referrals: number;
};

/** Top earners — only active (not banned/suspended) users. */
export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LeaderboardRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, photo_url, telegram_id, status, task_points, referred_by")
      .order("task_points", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const active = (profiles ?? []).filter(
      (p) => String((p as { status?: string }).status ?? "active") === "active",
    );
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
    }));
  });
