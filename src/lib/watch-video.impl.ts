import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const { assertOwner: ao } = await import("@/lib/owner-guard.server");
  await ao(userId);
}

function mapVideo(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    videoUrl: String(row.video_url ?? ""),
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    sourceType: String(row.source_type ?? "owner_uploaded"),
    providerName: row.provider_name ? String(row.provider_name) : null,
    rewardUsdt: Number(row.reward_usdt ?? 0),
    durationSeconds: Number(row.duration_seconds ?? 0),
    dailyLimit: Number(row.daily_limit ?? 1),
    maxViews: Number(row.max_views ?? 0),
    viewsCount: Number(row.views_count ?? 0),
    status: String(row.status ?? "active"),
  };
}

export type WatchVideo = ReturnType<typeof mapVideo>;

export const listWatchVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const s = await adminClient();
    const { data, error } = await (s as any)
      .from("watch_videos")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map(mapVideo);
  });

export const startWatchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { videoId: string }) => data)
  .handler(async ({ data, context }) => {
    const s = await adminClient();
    const { data: v } = await (s as any)
      .from("watch_videos")
      .select("*")
      .eq("id", data.videoId)
      .eq("status", "active")
      .maybeSingle();
    if (!v) throw new Error("Video not found or inactive.");
    if (v.created_by && String(v.created_by) === String(context.userId)) {
      throw new Error("You cannot complete your own posted video.");
    }
    const { data: prior } = await (s as any)
      .from("watch_video_sessions")
      .select("id")
      .eq("video_id", data.videoId)
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .maybeSingle();
    if (prior) throw new Error("You already earned the reward for this video.");

    const { data: session, error } = await (s as any)
      .from("watch_video_sessions")
      .insert({
        video_id: data.videoId,
        user_id: context.userId,
        status: "started",
        started_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        qualified_seconds: 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: String(session.id), durationSeconds: Number(v.duration_seconds ?? 0), rewardUsdt: Number(v.reward_usdt ?? 0) };
  });

/** Heartbeat: only accumulate qualified time when tab is visible + optional attention ack. */
export const heartbeatWatchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; attentionAck?: boolean; visible?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const s = await adminClient();
    const { data: session } = await (s as any)
      .from("watch_video_sessions")
      .select("id,status,qualified_seconds,last_heartbeat_at")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!session) throw new Error("Video session not found.");
    if (session.status === "completed") return { ok: true as const, already: true as const };

    const now = Date.now();
    const last = session.last_heartbeat_at ? new Date(String(session.last_heartbeat_at)).getTime() : now;
    const delta = Math.min(15, Math.max(0, (now - last) / 1000));
    // Visibility gate: if client reports tab hidden, do not credit watch time
    const isVisible = data.visible !== false;
    const add = isVisible ? delta : 0;
    const qualified = Number(session.qualified_seconds ?? 0) + add;
    const patch: Record<string, unknown> = {
      qualified_seconds: qualified,
      last_heartbeat_at: new Date(now).toISOString(),
    };
    if (data.attentionAck) {
      patch.attention_ack_at = new Date(now).toISOString();
      patch.attention_acked = true;
    }
    await (s as any).from("watch_video_sessions").update(patch).eq("id", data.sessionId);
    return { ok: true as const, qualifiedSeconds: qualified, credited: add };
  });

export const completeWatchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data, context }) => {
    const s = await adminClient();
    const { data: session } = await (s as any)
      .from("watch_video_sessions")
      .select("id,video_id,user_id,started_at,status,qualified_seconds,last_heartbeat_at")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!session) throw new Error("Video session not found.");
    if (session.status === "completed") return { ok: true as const, already: true as const, earned: 0 };
    if (session.status !== "started") throw new Error("This video session is no longer valid.");

    const { data: v } = await (s as any)
      .from("watch_videos")
      .select("id,source_type,duration_seconds,reward_usdt,title,views_count")
      .eq("id", session.video_id)
      .maybeSingle();
    if (!v) throw new Error("Video not found.");
    if (v.source_type === "external_provider") {
      throw new Error("External-provider rewards are credited only after the provider verifies the completion.");
    }

    const required = Math.max(3, Number(v.duration_seconds || 0));
    const wallElapsed = (Date.now() - new Date(String(session.started_at)).getTime()) / 1000;
    const qualified = Number(session.qualified_seconds ?? 0);
    const credit = session.qualified_seconds != null ? qualified : wallElapsed;

    if (credit + 1 < required) {
      throw new Error(`Keep watching for ${Math.ceil(required - credit)} more seconds.`);
    }
    if (wallElapsed + 2 < required * 0.9) {
      throw new Error("Watch session too short. Play the video without skipping.");
    }

    try {
      const { RULES } = await import("@/lib/platform-rules");
      if (required >= RULES.attentionRequiredSeconds) {
        const { data: sess2 } = await (s as any)
          .from("watch_video_sessions")
          .select("attention_ack_at, attention_acked")
          .eq("id", data.sessionId)
          .maybeSingle();
        const acked =
          Boolean(sess2?.attention_acked) || Boolean(sess2?.attention_ack_at);
        if (!acked) {
          throw new Error('Tap "I\'m still watching" once during the video, then finish the timer.');
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("still watching")) throw e;
    }

    const rewardUsdt = Number(v.reward_usdt ?? 0);
    if (rewardUsdt > 0) {
      try {
        const { runEarnGuards } = await import("@/lib/strong-next.functions");
        await runEarnGuards({ userId: context.userId, amount: rewardUsdt });
      } catch (e) {
        if (e instanceof Error && e.message.includes("Daily earn")) throw e;
      }
    }

    await (s as any)
      .from("watch_video_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        reward_usdt: rewardUsdt,
      })
      .eq("id", data.sessionId);

    if (rewardUsdt > 0) {
      const { error } = await s.from("transactions").insert({
        user_id: context.userId,
        label: `Watch video — ${String(v.title)}`,
        amount: rewardUsdt,
        kind: "reward",
      });
      if (error) throw new Error(error.message);
    }

    await (s as any)
      .from("watch_videos")
      .update({ views_count: Number(v.views_count ?? 0) + 1 })
      .eq("id", session.video_id);

    return { ok: true as const, earned: rewardUsdt };
  });

export const getYoutubeVideoMetadata = createServerFn({ method: "GET" })
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    return { title: "YouTube video", durationSeconds: 60, thumbnailUrl: null as string | null, url: data.url };
  });

export const registerOwnerVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    rewardUsdt: number;
    durationSeconds: number;
    dailyLimit?: number;
    maxViews?: number;
  }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    const { data: row, error } = await (s as any)
      .from("watch_videos")
      .insert({
        title: data.title.trim(),
        description: data.description?.trim() || null,
        video_url: data.videoUrl.trim(),
        thumbnail_url: data.thumbnailUrl?.trim() || null,
        source_type: "owner_uploaded",
        reward_usdt: data.rewardUsdt,
        reward_points: 0,
        duration_seconds: Math.max(1, Math.min(28800, Math.round(data.durationSeconds ?? 0))),
        daily_limit: Math.max(1, Math.min(1000, Math.floor(data.dailyLimit ?? 1))),
        max_views: Math.max(0, Math.min(1000000, Math.floor(data.maxViews ?? 0))),
        status: "active",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapVideo(row as Record<string, unknown>);
  });

export const setOwnerVideoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { videoId: string; status: "active" | "paused" }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    const { error } = await (s as any)
      .from("watch_videos")
      .update({ status: data.status })
      .eq("id", data.videoId)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteOwnerVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { videoId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    const { error } = await (s as any)
      .from("watch_videos")
      .update({ status: "completed" })
      .eq("id", data.videoId)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listOwnerVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    const { data, error } = await (s as any)
      .from("watch_videos")
      .select("*")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map(mapVideo);
  });
