import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const GAME_KEY = "tap_rush";
const ROUND_SECONDS = 30;
const DAILY_CAP = 100;

export type GameStats = {
  taskPoints: number;
  dailyPoints: number;
  dailyRemaining: number;
  roundsToday: number;
  bestScore: number;
};

export const getGameStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await adminClient();
    const [{ data: profile, error: profileError }, { data: rounds, error: roundsError }] =
      await Promise.all([
        s.from("profiles").select("task_points").eq("id", context.userId).maybeSingle(),
        (s as any)
          .from("game_rounds")
          .select("score,awarded_points,created_at,status")
          .eq("user_id", context.userId)
          .eq("game_key", GAME_KEY)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (roundsError) throw new Error(roundsError.message);

    const today = new Date().toISOString().slice(0, 10);
    const completedToday = ((rounds ?? []) as Record<string, unknown>[]).filter(
      (r) => r.status === "completed" && String(r.created_at ?? "").slice(0, 10) === today,
    );
    const dailyPoints = completedToday.reduce((sum, r) => sum + Number(r.awarded_points ?? 0), 0);

    return {
      taskPoints: Number(profile?.task_points ?? 0),
      dailyPoints,
      dailyRemaining: Math.max(0, DAILY_CAP - dailyPoints),
      roundsToday: completedToday.length,
      bestScore: completedToday.reduce((max, r) => Math.max(max, Number(r.score ?? 0)), 0),
    } satisfies GameStats;
  });

export const startGameRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await adminClient();
    await (s as any)
      .from("game_rounds")
      .update({ status: "expired", completed_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("game_key", GAME_KEY)
      .eq("status", "started")
      .lt("started_at", new Date(Date.now() - 180_000).toISOString());

    const { data: existing } = await (s as any)
      .from("game_rounds")
      .select("id,started_at")
      .eq("user_id", context.userId)
      .eq("game_key", GAME_KEY)
      .eq("status", "started")
      .maybeSingle();

    if (existing) {
      return { roundId: String(existing.id), startedAt: String(existing.started_at), roundSeconds: ROUND_SECONDS, dailyCap: DAILY_CAP };
    }

    const { data: row, error } = await (s as any)
      .from("game_rounds")
      .insert({ user_id: context.userId, game_key: GAME_KEY, status: "started" })
      .select("id,started_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not start the game.");
    return { roundId: String(row.id), startedAt: String(row.started_at), roundSeconds: ROUND_SECONDS, dailyCap: DAILY_CAP };
  });

export const completeGameRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: string; score: number }) => data)
  .handler(async ({ data, context }) => {
    if (!data.roundId.trim()) throw new Error("Game session is missing.");
    if (!Number.isInteger(data.score) || data.score < 0 || data.score > 10000) {
      throw new Error("Invalid game score.");
    }
    const s = await adminClient();
    const { data: result, error } = await (s as any).rpc("complete_taskora_game_round", {
      _round_id: data.roundId,
      _user_id: context.userId,
      _score: data.score,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    return {
      awardedPoints: Number(row?.awarded_points ?? 0),
      totalPoints: Number(row?.total_points ?? 0),
      dailyPoints: Number(row?.daily_points ?? 0),
      dailyRemaining: Math.max(0, DAILY_CAP - Number(row?.daily_points ?? 0)),
    };
  });
