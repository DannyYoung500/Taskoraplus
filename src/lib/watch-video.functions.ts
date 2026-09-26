import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";
import { extractYoutubeId, youtubeWatchUrl } from "@/lib/youtube-url";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const s = await adminClient();
  const { data: role } = await s.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (role) return;
  const { data: p } = await s.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  if (isOwnerTelegramId((p as { telegram_id?: number | string | null } | null)?.telegram_id ?? null))
    return;
  throw new Error("Owner/admin authorization required.");
}

export type WatchVideo = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  sourceType: "owner_uploaded" | "external_provider";
  providerName: string | null;
  providerVideoId: string | null;
  rewardUsdt: number;
  rewardPoints: number;
  durationSeconds: number;
  status: string;
};

function mapVideo(row: Record<string, unknown>): WatchVideo {
  return {
    id: String(row.id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    videoUrl: (row.video_url as string | null) ?? null,
    sourceType: row.source_type === "external_provider" ? "external_provider" : "owner_uploaded",
    providerName: (row.provider_name as string | null) ?? null,
    providerVideoId: (row.provider_video_id as string | null) ?? null,
    rewardUsdt: Number(row.reward_usdt ?? 0),
    rewardPoints: Number(row.reward_points ?? 0),
    durationSeconds: Number(row.duration_seconds ?? 0),
    status: String(row.status ?? "active"),
  };
}

/** Normalize any YouTube paste to canonical watch URL + id. */
function normalizeYoutubeInput(raw: string): { id: string; url: string } {
  const id = extractYoutubeId(raw);
  if (!id) throw new Error("Paste a valid YouTube URL (youtube.com/watch?v=… or youtu.be/…).");
  return { id, url: youtubeWatchUrl(id) };
}

export const listWatchVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const s = await adminClient();
    const { data, error } = await (s as any)
      .from("watch_videos")
      .select(
        "id,title,description,thumbnail_url,video_url,source_type,provider_name,provider_video_id,reward_usdt,reward_points,duration_seconds,status",
      )
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
      .select("id,status,source_type,duration_seconds,reward_usdt,reward_points,max_views,views_count")
      .eq("id", data.videoId)
      .eq("status", "active")
      .maybeSingle();
    if (!v) throw new Error("This video is no longer available.");
    if (v.max_views != null && Number(v.views_count) >= Number(v.max_views)) {
      throw new Error("This video has reached its view limit.");
    }

    // One reward per user per video — block restart if already completed
    const { data: done } = await (s as any)
      .from("watch_video_sessions")
      .select("id")
      .eq("video_id", data.videoId)
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .maybeSingle();
    if (done) throw new Error("You already earned the reward for this video.");

    const { data: existing } = await (s as any)
      .from("watch_video_sessions")
      .select("id,status")
      .eq("video_id", data.videoId)
      .eq("user_id", context.userId)
      .eq("status", "started")
      .maybeSingle();
    if (existing) {
      return { sessionId: String(existing.id), sourceType: String(v.source_type) };
    }

    const { data: session, error } = await (s as any)
      .from("watch_video_sessions")
      .insert({
        video_id: data.videoId,
        user_id: context.userId,
        status: "started",
        qualified_seconds: 0,
        last_heartbeat_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !session) {
      if (error && /qualified_seconds|last_heartbeat/i.test(error.message)) {
        const r2 = await (s as any)
          .from("watch_video_sessions")
          .insert({ video_id: data.videoId, user_id: context.userId })
          .select("id")
          .single();
        if (r2.error || !r2.data) throw new Error(r2.error?.message ?? "Could not start video session.");
        return { sessionId: String(r2.data.id), sourceType: String(v.source_type) };
      }
      throw new Error(error?.message ?? "Could not start video session.");
    }
    return { sessionId: String(session.id), sourceType: String(v.source_type) };
  });

/**
 * Client sends heartbeats while video is playing.
 * Only increments qualified_seconds when gap since last beat is 1–15s (anti-skip / anti-burst).
 */
export const heartbeatWatchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; playing?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const s = await adminClient();
    const { data: session } = await (s as any)
      .from("watch_video_sessions")
      .select("id,video_id,user_id,started_at,status,qualified_seconds,last_heartbeat_at")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!session) throw new Error("Video session not found.");
    if (session.status === "completed") {
      return { ok: true as const, already: true as const, qualifiedSeconds: Number(session.qualified_seconds ?? 0) };
    }
    if (session.status !== "started") throw new Error("This video session is no longer valid.");

    const { data: v } = await (s as any)
      .from("watch_videos")
      .select("duration_seconds")
      .eq("id", session.video_id)
      .maybeSingle();
    const required = Math.max(3, Number(v?.duration_seconds ?? 0));

    let qualified = Number(session.qualified_seconds ?? 0);
    const now = Date.now();
    const last = session.last_heartbeat_at
      ? new Date(String(session.last_heartbeat_at)).getTime()
      : new Date(String(session.started_at)).getTime();
    const gapSec = (now - last) / 1000;

    if (data.playing !== false && gapSec >= 1 && gapSec <= 15) {
      qualified = Math.min(required + 5, qualified + Math.floor(gapSec));
    }

    const patch: Record<string, unknown> = {
      last_heartbeat_at: new Date(now).toISOString(),
      qualified_seconds: qualified,
    };
    const { error } = await (s as any)
      .from("watch_video_sessions")
      .update(patch)
      .eq("id", session.id)
      .eq("status", "started");
    if (error && /qualified_seconds|last_heartbeat/i.test(error.message)) {
      return {
        ok: true as const,
        qualifiedSeconds: Math.floor((now - new Date(String(session.started_at)).getTime()) / 1000),
        required,
      };
    }
    if (error) throw new Error(error.message);

    return { ok: true as const, qualifiedSeconds: qualified, required };
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
    if (session.status === "completed") return { ok: true as const, already: true as const };
    if (session.status !== "started") throw new Error("This video session is no longer valid.");

    const { data: prior } = await (s as any)
      .from("watch_video_sessions")
      .select("id")
      .eq("video_id", session.video_id)
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .neq("id", session.id)
      .maybeSingle();
    if (prior) throw new Error("You already earned the reward for this video.");

    const { data: v } = await (s as any)
      .from("watch_videos")
      .select("id,source_type,duration_seconds,reward_usdt,reward_points,title,views_count")
      .eq("id", session.video_id)
      .maybeSingle();
    if (!v) throw new Error("Video not found.");
    if (v.source_type === "external_provider") {
      throw new Error(
        "External-provider rewards are credited only after the provider verifies the completion.",
      );
    }

    const required = Math.max(3, Number(v.duration_seconds || 0));
    const wallElapsed = (Date.now() - new Date(String(session.started_at)).getTime()) / 1000;
    const qualified = Number(session.qualified_seconds ?? 0);

    const credit =
      session.qualified_seconds != null && session.qualified_seconds !== undefined
        ? qualified
        : wallElapsed;

    if (credit + 1 < required) {
      throw new Error(`Keep watching for ${Math.ceil(required - credit)} more seconds.`);
    }
    if (wallElapsed + 2 < required * 0.85) {
      throw new Error("Watch session too short. Play the video without skipping.");
    }

    const { data: updated, error: updateError } = await (s as any)
      .from("watch_video_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        reward_usdt: Number(v.reward_usdt ?? 0),
        reward_points: 0,
        qualified_seconds: Math.floor(credit),
      })
      .eq("id", session.id)
      .eq("status", "started")
      .select("id")
      .maybeSingle();
    if (updateError) {
      if (/qualified_seconds/i.test(updateError.message)) {
        const r2 = await (s as any)
          .from("watch_video_sessions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            reward_usdt: Number(v.reward_usdt ?? 0),
            reward_points: 0,
          })
          .eq("id", session.id)
          .eq("status", "started")
          .select("id")
          .maybeSingle();
        if (r2.error) throw new Error(r2.error.message);
        if (!r2.data) return { ok: true as const, already: true as const };
      } else {
        throw new Error(updateError.message);
      }
    } else if (!updated) {
      return { ok: true as const, already: true as const };
    }

    const rewardUsdt = Number(v.reward_usdt ?? 0);
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
      .eq("id", v.id);
    return { ok: true as const, already: false as const, rewardUsdt };
  });

export const registerOwnerVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      title: string;
      description?: string;
      videoUrl: string;
      platform: string;
      rewardUsdt: number;
      durationSeconds?: number;
      thumbnailUrl?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    if (!data.title.trim()) throw new Error("Video title is required.");
    if (data.rewardUsdt < 0) throw new Error("USDT reward cannot be negative.");
    const platform = data.platform.trim() || "youtube";

    let videoUrl = data.videoUrl.trim();
    let providerVideoId = videoUrl;
    if (/youtube|youtu\.be/i.test(videoUrl) || platform.toLowerCase() === "youtube") {
      const norm = normalizeYoutubeInput(videoUrl);
      videoUrl = norm.url;
      providerVideoId = norm.id;

      const s0 = await adminClient();
      const { count } = await (s0 as any)
        .from("watch_videos")
        .select("id", { count: "exact", head: true })
        .eq("provider_video_id", norm.id)
        .eq("status", "active");
      if ((count ?? 0) >= 8) {
        throw new Error(
          "This YouTube video is already used on too many active campaigns. Pick another video.",
        );
      }
    } else if (!/^https?:\/\//i.test(videoUrl)) {
      throw new Error("Enter a valid video link.");
    }

    const s = await adminClient();
    const { data: row, error } = await (s as any)
      .from("watch_videos")
      .insert({
        title: data.title.trim(),
        description: data.description?.trim() || null,
        video_url: videoUrl,
        thumbnail_url: data.thumbnailUrl?.trim() || null,
        source_type: "owner_uploaded",
        provider_name: platform,
        provider_video_id: providerVideoId,
        reward_usdt: data.rewardUsdt,
        reward_points: 0,
        duration_seconds: Math.max(0, Math.min(28800, Math.round(data.durationSeconds ?? 0))),
        status: "active",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapVideo(row as Record<string, unknown>);
  });

export const listOwnerVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    const { data, error } = await (s as any)
      .from("watch_videos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map(mapVideo);
  });
