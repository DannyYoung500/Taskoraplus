import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const supabaseAdmin = await adminClient();
  const { data: role } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (role) return;
  const { data: profile } = await supabaseAdmin.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  const telegramId = (profile as { telegram_id?: number | string | null } | null)?.telegram_id;
  if (isOwnerTelegramId(telegramId ?? null)) return;
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

export const listWatchVideos = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const supabaseAdmin = await adminClient();
  const { data, error } = await (supabaseAdmin as any).from("watch_videos").select("id,title,description,thumbnail_url,video_url,source_type,provider_name,provider_video_id,reward_usdt,reward_points,duration_seconds,status").eq("status", "active").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapVideo);
});

export const startWatchVideo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { videoId: string }) => data).handler(async ({ data, context }) => {
  const supabaseAdmin = await adminClient();
  const { data: video } = await (supabaseAdmin as any).from("watch_videos").select("id,status,source_type,duration_seconds,reward_usdt,reward_points,max_views,views_count").eq("id", data.videoId).eq("status", "active").maybeSingle();
  if (!video) throw new Error("This video is no longer available.");
  if (video.max_views != null && Number(video.views_count) >= Number(video.max_views)) throw new Error("This video has reached its view limit.");
  const { data: existing } = await (supabaseAdmin as any).from("watch_video_sessions").select("id,status").eq("video_id", data.videoId).eq("user_id", context.userId).eq("status", "started").maybeSingle();
  if (existing) return { sessionId: String(existing.id), sourceType: String(video.source_type) };
  const { data: session, error } = await (supabaseAdmin as any).from("watch_video_sessions").insert({ video_id: data.videoId, user_id: context.userId }).select("id").single();
  if (error || !session) throw new Error(error?.message ?? "Could not start video session.");
  return { sessionId: String(session.id), sourceType: String(video.source_type) };
});

export const completeWatchVideo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { sessionId: string }) => data).handler(async ({ data, context }) => {
  const supabaseAdmin = await adminClient();
  const { data: session } = await (supabaseAdmin as any).from("watch_video_sessions").select("id,video_id,user_id,started_at,status").eq("id", data.sessionId).eq("user_id", context.userId).maybeSingle();
  if (!session) throw new Error("Video session not found.");
  if (session.status === "completed") return { ok: true as const, already: true as const };
  if (session.status !== "started") throw new Error("This video session is no longer valid.");
  const { data: video } = await (supabaseAdmin as any).from("watch_videos").select("id,source_type,duration_seconds,reward_usdt,reward_points,title,views_count").eq("id", session.video_id).maybeSingle();
  if (!video) throw new Error("Video not found.");
  if (video.source_type === "external_provider") throw new Error("External-provider rewards are credited only after the provider verifies the completion.");
  const elapsed = (Date.now() - new Date(String(session.started_at)).getTime()) / 1000;
  const required = Math.max(3, Number(video.duration_seconds || 0));
  if (elapsed + 1 < required) throw new Error(`Keep watching for ${Math.ceil(required - elapsed)} more seconds.`);
  const { data: updated, error: updateError } = await (supabaseAdmin as any).from("watch_video_sessions").update({ status: "completed", completed_at: new Date().toISOString(), reward_usdt: Number(video.reward_usdt ?? 0), reward_points: Number(video.reward_points ?? 0) }).eq("id", session.id).eq("status", "started").select("id").maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) return { ok: true as const, already: true as const };
  const rewardUsdt = Number(video.reward_usdt ?? 0);
  const rewardPoints = Number(video.reward_points ?? 0);
  if (rewardUsdt > 0) {
    const { error } = await supabaseAdmin.from("transactions").insert({ user_id: context.userId, label: `Watch video — ${String(video.title)}`, amount: rewardUsdt, kind: "reward" });
    if (error) throw new Error(error.message);
  }
  if (rewardPoints > 0) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("xp").eq("id", context.userId).maybeSingle();
    await (supabaseAdmin as any).from("profiles").update({ xp: Number(profile?.xp ?? 0) + rewardPoints }).eq("id", context.userId);
  }
  await (supabaseAdmin as any).from("watch_videos").update({ views_count: Number(video.views_count ?? 0) + 1 }).eq("id", video.id);
  return { ok: true as const, already: false as const, rewardUsdt, rewardPoints };
});

export const createOwnerVideoUploadUrl = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { fileName: string; mimeType: string }) => data).handler(async ({ data, context }) => {
  await assertOwner(context.userId);
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(data.mimeType)) throw new Error("Use MP4, WebM, or MOV video.");
  const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `${context.userId}/${Date.now()}_${safe}`;
  const supabaseAdmin = await adminClient();
  const { data: signed, error } = await supabaseAdmin.storage.from("taskora-videos").createSignedUploadUrl(path);
  if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL.");
  const base = process.env["SUPABASE_URL"] ?? "";
  const publicUrl = `${base}/storage/v1/object/public/taskora-videos/${path.split("/").map(encodeURIComponent).join("/")}`;
  return { path, signedUrl: signed.signedUrl, publicUrl };
});

export const registerOwnerVideo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { title: string; description?: string; videoPath: string; videoUrl: string; durationSeconds: number; rewardUsdt: number; rewardPoints: number }) => data).handler(async ({ data, context }) => {
  await assertOwner(context.userId);
  if (!data.title.trim()) throw new Error("Video title is required.");
  if (data.rewardUsdt < 0 || data.rewardPoints < 0) throw new Error("Rewards cannot be negative.");
  const supabaseAdmin = await adminClient();
  const { data: row, error } = await (supabaseAdmin as any).from("watch_videos").insert({ title: data.title.trim(), description: data.description?.trim() || null, video_url: data.videoUrl, source_type: "owner_uploaded", reward_usdt: data.rewardUsdt, reward_points: data.rewardPoints, duration_seconds: Math.max(0, Math.round(data.durationSeconds)), status: "active", created_by: context.userId }).select("*").single();
  if (error) throw new Error(error.message);
  return mapVideo(row as Record<string, unknown>);
});

export const listOwnerVideos = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertOwner(context.userId);
  const supabaseAdmin = await adminClient();
  const { data, error } = await (supabaseAdmin as any).from("watch_videos").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapVideo);
});
