/**
 * Lightweight platform stats for Tasks / Watch&Earn cards.
 * Real production counts — not demo.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PlatformStatsPayload = {
  tasksAvailable: number;
  rewardPoolUsd: number;
  newTasksToday: number;
  videosToWatch: number;
  videosEarnableUsd: number;
  referralsTotal: number;
  referralsValid: number;
};

export const getPlatformStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformStatsPayload> => {
    const s = await adminClient();
    const today = new Date().toISOString().slice(0, 10);

    const [tasksRes, videosRes, friendsRes] = await Promise.all([
      s
        .from("tasks")
        .select("id, reward, slots_left, created_at, is_active")
        .eq("is_active", true)
        .gt("slots_left", 0)
        .limit(200),
      (s as any)
        .from("watch_videos")
        .select("id, reward_usdt, status")
        .eq("status", "active")
        .limit(100),
      s.from("profiles").select("id").eq("referred_by", context.userId),
    ]);

    const tasks = (tasksRes.data ?? []) as Array<{
      id: string;
      reward?: number;
      slots_left?: number;
      created_at?: string;
    }>;

    // Exclude tasks already submitted by this user
    const { data: mySubs } = await s
      .from("submissions")
      .select("task_id")
      .eq("user_id", context.userId)
      .limit(300);
    const doneTaskIds = new Set((mySubs ?? []).map((x) => x.task_id));
    const openTasks = tasks.filter((t) => !doneTaskIds.has(t.id));

    const rewardPoolUsd =
      Math.round(
        openTasks.reduce((sum, t) => sum + Number(t.reward ?? 0), 0) * 100,
      ) / 100;
    const newTasksToday = openTasks.filter((t) =>
      String(t.created_at ?? "").startsWith(today),
    ).length;

    const videos = ((videosRes.data ?? []) as Array<{ id: string; reward_usdt?: number }>) ?? [];
    const { data: doneVids } = await (s as any)
      .from("watch_video_sessions")
      .select("video_id")
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .limit(200);
    const doneVideoIds = new Set((doneVids ?? []).map((x: { video_id: string }) => x.video_id));
    const openVideos = videos.filter((v) => !doneVideoIds.has(v.id));
    const videosEarnableUsd =
      Math.round(
        openVideos.reduce((sum, v) => sum + Number(v.reward_usdt ?? 0), 0) * 100,
      ) / 100;

    return {
      tasksAvailable: openTasks.length,
      rewardPoolUsd,
      newTasksToday,
      videosToWatch: openVideos.length,
      videosEarnableUsd,
      referralsTotal: (friendsRes.data ?? []).length,
      referralsValid: (friendsRes.data ?? []).length, // lightweight; growth has full valid logic
    };
  });
