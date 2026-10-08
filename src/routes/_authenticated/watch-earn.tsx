import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Bell, Gift, Play, Zap, X } from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { getPublicFeatures } from "@/lib/owner-economy.functions";
import {
  completeWatchVideo,
  listWatchVideos,
  startWatchVideo,
  type WatchVideo,
} from "@/lib/watch-video.functions";
import { creditBonusAd, getBonusAdSession } from "@/lib/bonus-ad.functions";
import { TASKORA_LOGO, ACCENT_GRAD } from "@/lib/brand";
import { formatUsd } from "@/lib/taskora-display";
import { AppLink } from "@/components/AppLink";
import { PlatformStats, watchStatsCards } from "@/components/PlatformStats";
import { getPlatformStats } from "@/lib/platform-stats.functions";

export const Route = createFileRoute("/_authenticated/watch-earn")({
  head: () => ({ meta: [{ title: "Watch & Earn — TASKORA" }] }),
  loader: async () => {
    const [videos, dashboard, features, stats] = await Promise.all([
      listWatchVideos().catch(() => [] as WatchVideo[]),
      getDashboard().catch(() => null),
      getPublicFeatures().catch(() => null),
      getPlatformStats().catch(() => null),
    ]);
    return { videos, dashboard, features, stats };
  },
  component: WatchEarnPage,
});

function WatchEarnPage() {
  const { videos, dashboard, features, stats: loaderStats } = Route.useLoaderData();
  const bonusReward = Math.max(0, Number((features as any)?.bonus_ad_reward_usdt ?? 0.003));
  const bonusDailyLimit = Math.max(0, Math.floor(Number((features as any)?.bonus_ad_daily_limit ?? 5)));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [bonusLeft, setBonusLeft] = useState(bonusDailyLimit);
  const [bonusBusy, setBonusBusy] = useState(false);

  useEffect(() => {
    setBonusLeft(bonusDailyLimit);
  }, [bonusDailyLimit]);

  const active = videos.find((v) => v.id === activeId) ?? null;
  const profile = dashboard?.profile as { display_name?: string | null; photo_url?: string | null } | null;
  const required = Math.max(15, Number(active?.durationSeconds ?? 30));
  const progress = Math.min(100, Math.round((elapsed / required) * 100));
  const canComplete = Boolean(sessionId && elapsed >= required && !busy);

  const liveSessionDisplay = useMemo(() => {
    if (!active) return sessionEarned;
    const reward = Number(active.rewardUsdt ?? 0);
    const secs = Math.max(30, Number(active.durationSeconds ?? 60));
    if (reward <= 0) return sessionEarned;
    return sessionEarned + Math.min(reward, (reward / secs) * elapsed);
  }, [active, elapsed, sessionEarned]);

  const hourlyRateForActive = useMemo(() => {
    if (!active) return 0;
    const reward = Number(active.rewardUsdt ?? 0);
    const secs = Math.max(30, Number(active.durationSeconds ?? 60));
    return reward <= 0 ? 0 : reward * (3600 / secs);
  }, [active]);

  const upNext = useMemo(() => {
    if (!activeId) return videos.slice(0, 12);
    return videos.filter((v) => v.id !== activeId && !doneIds.has(v.id)).slice(0, 12);
  }, [videos, activeId, doneIds]);

  const videosToWatch =
    loaderStats?.videosToWatch ?? videos.filter((v) => !doneIds.has(v.id)).length;
  const totalEarnable =
    loaderStats?.videosEarnableUsd ??
    Math.round(
      videos.filter((v) => !doneIds.has(v.id)).reduce((s, v) => s + Number(v.rewardUsdt ?? 0), 0) * 100,
    ) / 100;

  useEffect(() => {
    if (!activeId) return;
    setSessionId(null);
    setElapsed(0);
    setMessage(null);
    let cancelled = false;
    setBusy(true);
    void startWatchVideo({ data: { videoId: activeId } })
      .then((result) => {
        if (!cancelled) setSessionId(result.sessionId);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not start this video.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    if (!sessionId || !active) return;
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionId, active?.id]);

  async function onComplete() {
    if (!sessionId || !active) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await completeWatchVideo({ data: { sessionId } });
      const earned = Number((result as { rewardUsdt?: number; earned?: number }).earned ?? (result as { rewardUsdt?: number }).rewardUsdt ?? 0);
      setSessionEarned((v) => v + earned);
      setDoneIds((prev) => new Set(prev).add(active.id));
      setMessage(earned > 0 ? `Earned ${formatUsd(earned)}` : "Watch completed.");
      setActiveId(null);
      setSessionId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete video.");
    } finally {
      setBusy(false);
    }
  }

  function closePlayer() {
    setActiveId(null);
    setSessionId(null);
    setElapsed(0);
    setMessage(null);
  }

  async function onBonusAd() {
    if (bonusLeft <= 0 || bonusBusy) return;
    setBonusBusy(true);
    setMessage(null);
    try {
      const session = await getBonusAdSession();
      const sdkToken = String((session as { token?: string })?.token || "");
      if (!sdkToken) throw new Error("Could not start bonus-ad session.");
      const result = await creditBonusAd({ data: { sdkToken } });
      const earned = Number((result as { rewardUsdt?: number }).rewardUsdt ?? bonusReward);
      const left = Number((result as { left?: number }).left ?? Math.max(0, bonusLeft - 1));
      setBonusLeft(left);
      setSessionEarned((v) => v + earned);
      setMessage(`Bonus ad · +${formatUsd(earned)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bonus ad failed.");
    } finally {
      setBonusBusy(false);
    }
  }

  if (active) {
    return (
      <WatchPlayer
        active={active}
        upNext={upNext}
        elapsed={elapsed}
        required={required}
        progress={progress}
        canComplete={canComplete}
        busy={busy}
        message={message}
        sessionDisplay={liveSessionDisplay}
        hourlyRate={hourlyRateForActive}
        onBack={closePlayer}
        onComplete={() => void onComplete()}
        onSelect={setActiveId}
      />
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] pb-28 text-neutral-100">
      {/* Header — soft, no heavy rings */}
      <header className="sticky top-0 z-20 bg-[#080808]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src={TASKORA_LOGO} alt="" className="size-8 rounded-lg object-cover" draggable={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-wide text-neutral-50">
              TASKORA
            </p>
            <p className="text-[10px] font-normal text-neutral-500">Watch & Earn</p>
          </div>
          <AppLink to="/notifications" aria-label="Notifications" className="p-2 text-neutral-400">
            <Bell className="size-5" strokeWidth={1.75} />
          </AppLink>
          <AppLink to="/profile" aria-label="Profile" className="overflow-hidden rounded-full">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="size-8 object-cover" />
            ) : (
              <span className="flex size-8 items-center justify-center bg-neutral-800 text-xs font-medium text-neutral-300">
                {(profile?.display_name ?? "T").charAt(0)}
              </span>
            )}
          </AppLink>
        </div>
      </header>

      <section className="px-4 pt-3">
        <PlatformStats
          cards={watchStatsCards({
            videosToWatch,
            totalEarnableUsd: totalEarnable,
            bonusLeft,
          })}
        />

        <div className="mb-3 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-orange-400" />
          <p className="text-[13px] font-medium text-neutral-200">Watch videos, earn</p>
        </div>

        {/* Bonus ad — soft card, no border ring */}
        <button
          type="button"
          disabled={bonusLeft <= 0 || bonusBusy}
          onClick={() => void onBonusAd()}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-[#1a1510] px-3.5 py-3 text-left active:opacity-90 disabled:opacity-40"
        >
          <Gift className="size-5 shrink-0 text-amber-400" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-neutral-100">Watch a bonus ad</p>
            <p className="mt-0.5 text-[11px] font-normal text-neutral-500">
              +{formatUsd(bonusReward)} · {bonusLeft}/{bonusDailyLimit} left today
            </p>
          </div>
          <span className="text-[11px] font-medium text-amber-400/90">{bonusBusy ? "…" : "Go"}</span>
        </button>

        {message ? (
          <p className="mb-3 rounded-xl bg-orange-500/10 px-3 py-2 text-center text-[12px] font-normal text-orange-200">
            {message}
          </p>
        ) : null}
      </section>

      {/* Video feed — large cards, soft labels */}
      <section className="space-y-5 pb-4">
        {videos.length === 0 ? (
          <div className="mx-4 rounded-2xl bg-[#141414] p-10 text-center">
            <Play className="mx-auto size-9 text-neutral-600" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-neutral-400">No videos yet</p>
            <p className="mt-1 text-[11px] font-normal text-neutral-600">Owner adds videos in inventory.</p>
          </div>
        ) : (
          videos.map((video, index) => (
            <VideoFeedCard
              key={video.id}
              video={video}
              rank={index}
              done={doneIds.has(video.id)}
              onSelect={() => setActiveId(video.id)}
            />
          ))
        )}
      </section>

      {sessionEarned > 0 ? (
        <div className="fixed bottom-24 right-4 z-30 rounded-full bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-200 backdrop-blur">
          {formatUsd(sessionEarned)}
        </div>
      ) : null}
    </main>
  );
}

function getVideoThumbnail(video: WatchVideo): string | null {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  const source = String(video.videoUrl ?? "").trim();
  if (!source) return null;
  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    else if (host === "youtube.com" || host === "m.youtube.com") {
      id = url.searchParams.get("v") ?? "";
      if (!id) {
        const parts = url.pathname.split("/").filter(Boolean);
        const marker = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
        if (marker >= 0) id = parts[marker + 1] ?? "";
      }
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } catch {}
  return null;
}

function hourlyRateLabel(video: WatchVideo): string {
  const reward = Number(video.rewardUsdt ?? 0);
  const secs = Math.max(30, Number(video.durationSeconds ?? 60));
  if (reward > 0) {
    const perHour = reward * (3600 / secs);
    if (perHour >= 0.01) return `${formatUsd(perHour)}/hr`;
    return `+${formatUsd(reward)}`;
  }
  return "Earn";
}

function VideoFeedCard({
  video,
  rank,
  done,
  onSelect,
}: {
  video: WatchVideo;
  rank: number;
  done: boolean;
  onSelect: () => void;
}) {
  const thumb = getVideoThumbnail(video);
  return (
    <article className="px-4">
      <button type="button" onClick={onSelect} className="block w-full text-left active:opacity-95">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#111]">
          {thumb ? (
            <img
              src={thumb}
              alt=""
              className="size-full object-cover"
              loading={rank < 2 ? "eager" : "lazy"}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-[#111]">
              <Play className="size-10 text-neutral-500" strokeWidth={1.5} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
              <Play className="ml-0.5 size-5 fill-white" strokeWidth={0} />
            </span>
          </span>
          {done ? (
            <span className="absolute right-2.5 top-2.5 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[9px] font-medium text-white">
              Done
            </span>
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-3 pt-2.5">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-[14px] font-medium leading-snug text-neutral-100">
            {video.title || "Watch & Earn video"}
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-orange-400">
            <Zap className="size-3.5" strokeWidth={1.75} />
            {hourlyRateLabel(video)}
          </span>
        </div>
      </button>
    </article>
  );
}

function WatchPlayer({
  active,
  upNext,
  elapsed,
  required,
  progress,
  canComplete,
  busy,
  message,
  sessionDisplay,
  hourlyRate,
  onBack,
  onComplete,
  onSelect,
}: {
  active: WatchVideo;
  upNext: WatchVideo[];
  elapsed: number;
  required: number;
  progress: number;
  canComplete: boolean;
  busy: boolean;
  message: string | null;
  sessionDisplay: number;
  hourlyRate: number;
  onBack: () => void;
  onComplete: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] pb-10 text-neutral-100">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-[#080808]/95 px-3 py-2.5 backdrop-blur-xl">
        <button type="button" onClick={onBack} aria-label="Back" className="p-2 text-neutral-300">
          <X className="size-5" strokeWidth={1.75} />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{active.title}</p>
      </header>

      <section className="bg-black">
        <div className="relative aspect-video w-full">
          <VideoPlayer video={active} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-3 bottom-2">
            <div className="mb-1 h-0.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-orange-400 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-normal text-white/70">
              <span>
                {formatTime(elapsed)} / {formatTime(required)}
              </span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Earned this session — NEWTUBE style, soft orange */}
      <section className="px-4 pt-4">
        <div className="rounded-2xl bg-[#141414] px-4 py-5 text-center">
          <p className="text-[11px] font-normal text-neutral-500">Earned this session</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-orange-400">
            {formatUsd(sessionDisplay)}
          </p>
          <p className="mt-1.5 text-[11px] font-normal text-neutral-500">
            {hourlyRate > 0
              ? `${formatUsd(hourlyRate)} earned per hour watched`
              : Number(active.rewardUsdt) > 0
                ? `${formatUsd(active.rewardUsdt)} per completed watch`
                : "Complete the timer to claim"}
          </p>
        </div>

        <button
          type="button"
          disabled={!canComplete || busy}
          onClick={onComplete}
          className="mt-3 w-full rounded-2xl py-3.5 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: ACCENT_GRAD }}
        >
          {busy ? "Claiming…" : canComplete ? "Claim reward" : `Watch ${Math.max(0, required - elapsed)}s more`}
        </button>
        {message ? <p className="mt-2 text-center text-xs font-normal text-orange-300">{message}</p> : null}
      </section>

      {/* Up next */}
      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-orange-400" />
          <p className="text-[13px] font-medium text-neutral-200">Up next</p>
        </div>
        <div className="space-y-2.5">
          {upNext.map((v) => {
            const t = getVideoThumbnail(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-[#121212] p-2 text-left active:bg-[#1a1a1a]"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]">
                  {t ? (
                    <img src={t} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-full items-center justify-center">
                      <Play className="size-4 text-neutral-500" strokeWidth={1.5} />
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play className="size-3.5 fill-white text-white" strokeWidth={0} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-neutral-100">{v.title}</p>
                  <p className="mt-0.5 text-[11px] font-normal text-orange-400/90">{hourlyRateLabel(v)}</p>
                </div>
              </button>
            );
          })}
          {upNext.length === 0 ? (
            <p className="py-6 text-center text-[12px] font-normal text-neutral-600">No more videos</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function VideoPlayer({ video }: { video: WatchVideo }) {
  const embed = getEmbedUrl(video.videoUrl ?? "", video.providerName);
  if (embed) {
    return (
      <iframe
        title={video.title || "Watch"}
        src={embed}
        className="size-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (video.videoUrl) {
    return (
      <a
        href={video.videoUrl}
        target="_blank"
        rel="noreferrer"
        className="flex size-full flex-col items-center justify-center gap-2 bg-[#0a0a0a] text-orange-300"
      >
        <Play className="size-10" strokeWidth={1.5} />
        <span className="text-xs font-medium">Open on {video.providerName || "platform"}</span>
      </a>
    );
  }
  return (
    <div className="flex size-full items-center justify-center bg-[#0a0a0a] text-neutral-600">
      <Play className="size-10" strokeWidth={1.5} />
    </div>
  );
}

function getEmbedUrl(videoUrl: string | null, _providerName: string | null) {
  if (!videoUrl) return null;
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      let id = "";
      if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] ?? "";
      else if (url.pathname.startsWith("/watch")) id = url.searchParams.get("v") ?? "";
      else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] ?? "";
      else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] ?? "";
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : null;
    }
  } catch {}
  return null;
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
