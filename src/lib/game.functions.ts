import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AvailableGame = {
  id: string;
  providerId: string;
  providerName: string;
  providerKey: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  launchUrl: string | null;
  embedUrl: string | null;
  category: string;
  rewardType: "task_points" | "usdt" | "mixed";
  rewardValue: number;
  providerValue: number;
  estimatedMinutes: number | null;
  featured: boolean;
};

export const getAvailableGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const s = await adminClient();
    const { data, error } = await (s as any)
      .from("games")
      .select(
        "id,provider_id,external_game_id,slug,title,description,thumbnail_url,launch_url,embed_url,category,status,featured,reward_type,reward_value,provider_value,estimated_minutes,provider:provider_id(id,provider_name,provider_key,enabled)",
      )
      .eq("status", "active")
      .eq("provider.enabled", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return ((data ?? []) as any[])
      .filter((row) => row.provider?.enabled)
      .map(
        (row): AvailableGame => ({
          id: String(row.id),
          providerId: String(row.provider_id),
          providerName: String(row.provider?.provider_name ?? "Game Provider"),
          providerKey: String(row.provider?.provider_key ?? ""),
          title: String(row.title),
          slug: String(row.slug),
          description: row.description ? String(row.description) : null,
          thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
          launchUrl: row.launch_url ? String(row.launch_url) : null,
          embedUrl: row.embed_url ? String(row.embed_url) : null,
          category: String(row.category ?? "arcade"),
          rewardType: row.reward_type === "usdt" || row.reward_type === "mixed" ? row.reward_type : "task_points",
          rewardValue: Number(row.reward_value ?? 0),
          providerValue: Number(row.provider_value ?? 0),
          estimatedMinutes: row.estimated_minutes == null ? null : Number(row.estimated_minutes),
          featured: Boolean(row.featured),
        }),
      );
  });

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
