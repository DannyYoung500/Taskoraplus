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
  viewsCount: number;
  status: string;
  postedByName: string | null;
  postedByUsername: string | null;
  postedByPhotoUrl: string | null;
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
    viewsCount: Number(row.views_count ?? 0),
    status: String(row.status ?? "active"),
    postedByName: (row.posted_by_name as string | null) ?? null,
    postedByUsername: (row.posted_by_username as string | null) ?? null,
    postedByPhotoUrl: (row.posted_by_photo_url as string | null) ?? null,
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
        "id,title,description,thumbnail_url,video_url,source_type,provider_name,provider_video_id,reward_usdt,reward_points,duration_seconds,views_count,status,created_by",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];
    const creatorIds = [...new Set(rows.map((row) => String(row.created_by ?? "")).filter(Boolean))];
    const profiles = creatorIds.length
      ? await s.from("profiles").select("id,display_name,username,photo_url").in("id", creatorIds)
      : ({ data: [] } as any);
    const profileMap = new Map((profiles.data ?? []).map((p: any) => [String(p.id), p]));
    return rows.map((row) => {
      const p = profileMap.get(String(row.created_by ?? ""));
      return mapVideo({
        ...row,
        posted_by_name: p?.display_name ?? null,
        posted_by_username: p?.username ?? null,
        posted_by_photo_url: p?.photo_url ?? null,
      });
    });
  });

export const startWatchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { videoId: string }) => data)
  .handler(async ({ data, context }) => {
    try {
      const { assertActionRateLimit } = await import("@/lib/strong-ops");
      await assertActionRateLimit({ userId: context.userId, kind: "watch_start" });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Too many")) throw e;
    }
    // Kill switch: watches_paused
    try {
      const s0 = await adminClient();
      const { data: sw } = await s0
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_switches")
        .maybeSingle();
      const v = (sw?.value ?? {}) as Record<string, unknown>;
      if (Boolean(v.watches_paused) || Boolean(v.read_only)) {
        throw new Error("Watch & Earn is temporarily paused by the owner. Try again later.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("paused")) throw e;
    }
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
      const { mintWatchNonce } = await import("@/lib/strong-ops");
      const nonce = mintWatchNonce(String(existing.id), context.userId);
      try {
        await (s as any)
          .from("watch_video_sessions")
          .update({ session_nonce: nonce })
          .eq("id", existing.id);
      } catch {
        /* column may not exist */
      }
      return { sessionId: String(existing.id), sourceType: String(v.source_type), nonce };
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
      // Retry without optional columns if schema lacks them
      if (error && /qualified_seconds|last_heartbeat/i.test(error.message)) {
        const r2 = await (s as any)
          .from("watch_video_sessions")
          .insert({ video_id: data.videoId, user_id: context.userId })
          .select("id")
          .single();
        if (r2.error || !r2.data) throw new Error(r2.error?.message ?? "Could not start video session.");
        const { mintWatchNonce } = await import("@/lib/strong-ops");
        const nonce = mintWatchNonce(String(r2.data.id), context.userId);
        return { sessionId: String(r2.data.id), sourceType: String(v.source_type), nonce };
      }
      throw new Error(error?.message ?? "Could not start video session.");
    }
    const { mintWatchNonce } = await import("@/lib/strong-ops");
    const nonce = mintWatchNonce(String(session.id), context.userId);
    try {
      await (s as any)
        .from("watch_video_sessions")
        .update({ session_nonce: nonce })
        .eq("id", session.id);
    } catch {
      /* soft */
    }
    return { sessionId: String(session.id), sourceType: String(v.source_type), nonce };
  });

/**
 * Client sends heartbeats while video is playing.
 * Only increments qualified_seconds when gap since last beat is 1–15s (anti-skip / anti-burst).
 */
export const heartbeatWatchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sessionId: string;
      playing?: boolean;
      /** Page Visibility API — only credit when tab/app is foreground */
      visible?: boolean;
      /** Optional mid-watch human ack */
      attentionAck?: boolean;
    }) => data,
  )
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

    // Only credit when: playing + foreground visible + realistic gap (anti-idle / anti-skip)
    const playing = data.playing !== false;
    const visible = data.visible !== false;
    if (playing && visible && gapSec >= 1 && gapSec <= 15) {
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
      // Schema without heartbeat columns — soft ok
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

    // Hard one-completion guard (race-safe)
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

    // Prefer heartbeat-qualified time; fall back to wall clock if column missing
    const credit =
      session.qualified_seconds != null && session.qualified_seconds !== undefined
        ? qualified
        : wallElapsed;

    if (credit + 1 < required) {
      throw new Error(`Keep watching for ${Math.ceil(required - credit)} more seconds.`);
    }
    // Wall clock must also roughly cover required (blocks pure client lies without heartbeats)
    if (wallElapsed + 2 < required * 0.85) {
      throw new Error("Watch session too short. Play the video without skipping.");
    }
    // Behavioral score: qualified (visible+playing) must cover min ratio of required for longer videos
    try {
      const { RULES } = await import("@/lib/platform-rules");
      if (required >= RULES.attentionRequiredSeconds && wallElapsed > 0) {
        const ratio = credit / Math.max(required, 1);
        if (ratio + 0.02 < RULES.minVisibleWatchRatio) {
          throw new Error(
            "Keep the video in the foreground while watching. Switch back and finish the timer.",
          );
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("foreground")) throw e;
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
      // Retry minimal update
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

export const getYoutubeVideoMetadata = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const normalized = normalizeYoutubeInput(data.url.trim());
    const endpoint =
      "https://www.youtube.com/oembed?url=" +
      encodeURIComponent(normalized.url) +
      "&format=json";
    const response = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(
        "Could not read that YouTube video. Make sure the video is public and embeddable.",
      );
    }
    const metadata = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      videoId: normalized.id,
      url: normalized.url,
      title: String(metadata.title ?? ""),
      authorName: String(metadata.author_name ?? ""),
      thumbnailUrl:
        String(metadata.thumbnail_url ?? "") ||
        "https://img.youtube.com/vi/" + normalized.id + "/hqdefault.jpg",
    };
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
      dailyLimit?: number;
      maxViews?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    if (!data.title.trim()) throw new Error("Video title is required.");
    if (!Number.isFinite(Number(data.durationSeconds)) || Number(data.durationSeconds) < 1) throw new Error("Required watch time must be at least 1 second.");
    if (data.rewardUsdt < 0) throw new Error("USDT reward cannot be negative.");
    const platform = data.platform.trim() || "youtube";

    // YouTube only path for advertise/watch: normalize URL, no upload
    let videoUrl = data.videoUrl.trim();
    let providerVideoId = videoUrl;
    if (/youtube|youtu\.be/i.test(videoUrl) || platform.toLowerCase() === "youtube") {
      const norm = normalizeYoutubeInput(videoUrl);
      videoUrl = norm.url;
      providerVideoId = norm.id;

      // Velocity: same YouTube id already used heavily
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
      .eq("created_by", context.userId)
      .neq("status", "completed");
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
      .eq("created_by", context.userId)
      .neq("status", "completed");
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
