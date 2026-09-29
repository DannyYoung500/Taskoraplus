import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Bell, Gift, Play, Zap } from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import {
  completeWatchVideo,
  heartbeatWatchVideo,
  listWatchVideos,
  startWatchVideo,
  type WatchVideo,
} from "@/lib/watch-video.functions";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd } from "@/lib/taskora-display";
import { AppLink } from "@/components/AppLink";

export const Route = createFileRoute("/_authenticated/watch-earn")({
  head: () => ({ meta: [{ title: "Watch & Earn — TASKORA" }] }),
  loader: async () => {
    const [videos, dashboard] = await Promise.all([
      listWatchVideos().catch(() => [] as WatchVideo[]),
      getDashboard().catch(() => null),
    ]);
    return { videos, dashboard };
  },
  component: WatchEarnPage,
});

/**
 * Bonus-ad slot — wire your rewarded ad SDK (Adsgram / Monetag / GigaPub / etc.)
 * into onBonusAd. On successful ad completion, call creditBonus().
 */
const BONUS_AD = {
  rewardUsd: 0.003,
  dailyLimit: 5,
};

function WatchEarnPage() {
  const { videos, dashboard } = Route.useLoaderData();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [bonusLeft, setBonusLeft] = useState(BONUS_AD.dailyLimit);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const active = videos.find((v) => v.id === activeId) ?? null;
  const profile = dashboard?.profile as {
    display_name?: string | null;
    photo_url?: string | null;
  } | null;

  const required = Math.max(15, Number(active?.durationSeconds ?? 30));
  const progress = Math.min(100, Math.round((elapsed / required) * 100));
  const canComplete = Boolean(sessionId && elapsed >= required && !busy);

  const completionReward = active ? Number(active.rewardUsdt ?? 0) : 0;

  const upNext = useMemo(() => {
    if (!activeId) return videos.slice(0, 10);
    return videos.filter((v) => v.id !== activeId).slice(0, 10);
  }, [videos, activeId]);

  useEffect(() => {
    if (!activeId) return;
    setSessionId(null);
    setElapsed(0);
    setIsPlaying(false);
    setMessage(null);
    let cancelled = false;
    setBusy(true);
    void startWatchVideo({ data: { videoId: activeId } })
      .then((result) => {
        if (!cancelled) setSessionId(result.sessionId);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not start this video.");
        }
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
    let cancelled = false;

    const heartbeat = async () => {
      if (!isPlaying || document.visibilityState !== "visible") return;
      try {
        const result = await heartbeatWatchVideo({
          data: { sessionId, playing: true, visible: true },
        });
        if (!cancelled) {
          const qualified = Number((result as { qualifiedSeconds?: number }).qualifiedSeconds ?? 0);
          setElapsed((current) => Math.max(current, qualified));
        }
      } catch {
        // Server remains authoritative; missed heartbeats never grant watch time.
      }
    };

    const timer = window.setInterval(() => {
      if (isPlaying && document.visibilityState === "visible") {
        setElapsed((v) => v + 1);
      }
    }, 1000);
    const beat = window.setInterval(() => void heartbeat(), 5000);
    void heartbeat();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(beat);
    };
  }, [sessionId, active?.id, isPlaying]);

  async function onComplete() {
    if (!sessionId || !active) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await completeWatchVideo({ data: { sessionId } });
      const earned = Number((result as { rewardUsdt?: number }).rewardUsdt ?? 0);
      setSessionEarned((v) => v + earned);
      setDoneIds((prev) => new Set(prev).add(active.id));
      setMessage(earned > 0 ? `Reward credited: ${formatUsd(earned)}` : "Watch completed.");
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

  /**
   * Integrate your ad network here.
   * Example: Adsgram / Monetag / GigaPub show() → onRewarded → creditBonus().
   */
  function onBonusAd() {
    if (bonusLeft <= 0 || bonusBusy) return;
    setBonusBusy(true);
    setMessage(null);
    // TODO: replace this timeout with real ad SDK callback
    window.setTimeout(() => {
      creditBonus();
      setBonusBusy(false);
    }, 800);
  }

  function creditBonus() {
    setBonusLeft((n) => Math.max(0, n - 1));
    setSessionEarned((v) => v + BONUS_AD.rewardUsd);
    setMessage(`Bonus ad · +${formatUsd(BONUS_AD.rewardUsd)}`);
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
        completionReward={completionReward}
        isPlaying={isPlaying}
        onPlayingChange={setIsPlaying}
        onBack={closePlayer}
        onComplete={() => void onComplete()}
        onSelect={setActiveId}
      />
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#05080f] pb-28 text-white">
      {/* Header — TASKORA brand, matches NEWTUBE chrome */}
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#05080f]/95 px-3.5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <img
            src={TASKORA_LOGO}
            alt=""
            className="size-9 rounded-full object-cover ring-1 ring-cyan-400/40"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <p
              className="text-base font-black tracking-wide"
              style={{
                background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              TASKORA
            </p>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
              Watch & Earn
            </p>
          </div>
          <AppLink
            to="/notifications"
            aria-label="Notifications"
            className="rounded-full p-2 text-slate-300 hover:bg-white/5"
          >
            <Bell className="size-5" />
          </AppLink>
          <AppLink
            to="/profile"
            aria-label="Profile"
            className="overflow-hidden rounded-full ring-1 ring-white/10"
          >
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="size-8 object-cover" />
            ) : (
              <span className="flex size-8 items-center justify-center bg-cyan-500/15 text-xs font-black text-cyan-200">
                {(profile?.display_name ?? "T").charAt(0)}
              </span>
            )}
          </AppLink>
        </div>
      </header>

      <section className="px-3.5 pt-4">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-cyan-400" />
          <p className="text-[13px] font-bold text-slate-100">Watch videos, earn</p>
        </div>

        {/* Bonus ad banner — exact NEWTUBE placement; wire your ad SDK to onBonusAd */}
        <button
          type="button"
          disabled={bonusLeft <= 0 || bonusBusy}
          onClick={onBonusAd}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/18 to-orange-500/12 px-3.5 py-3.5 text-left shadow-[0_0_24px_rgba(245,158,11,0.12)] active:scale-[0.99] disabled:opacity-45"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/25 text-amber-100">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black text-amber-50">Watch a bonus ad</p>
            <p className="mt-0.5 text-[11px] font-medium text-amber-200/85">
              +{formatUsd(BONUS_AD.rewardUsd)} · {bonusLeft}/{BONUS_AD.dailyLimit} left today
            </p>
          </div>
          <span className="rounded-full bg-amber-400/25 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-50">
            {bonusBusy ? "…" : "AD"}
          </span>
        </button>

        {message ? (
          <p className="mt-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-center text-[11px] font-semibold text-cyan-100">
            {message}
          </p>
        ) : null}
      </section>

      {/* Vertical video feed — NEWTUBE style */}
      <section className="mt-4 space-y-5">
        {videos.length === 0 ? (
          <div className="mx-3.5 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <Play className="mx-auto size-10 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">No videos yet</p>
            <p className="mt-1 text-[10px] text-slate-500">
              New videos appear here as campaigns become active.
            </p>
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

      {/* Floating session coin — NEWTUBE bottom-right badge */}
      {sessionEarned > 0 ? (
        <div className="pointer-events-none fixed bottom-24 right-4 z-30 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-black text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.45)] ring-2 ring-amber-300/40">
          {formatUsd(sessionEarned).replace("$", "")}
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
  } catch {
    /* ignore */
  }
  return null;
}

function rewardLabel(_video: WatchVideo): string {
  return "Earn after completion";
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
    <article className="px-3.5">
      <button type="button" onClick={onSelect} className="block w-full text-left active:scale-[0.995]">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#101722] ring-1 ring-white/[0.08]">
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
            <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,.2),transparent_45%),#0b1420]">
              <Play className="size-10 fill-white/90 text-white/90" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-black/50 text-white shadow-2xl ring-1 ring-white/30 backdrop-blur-sm">
              <Play className="ml-0.5 size-6 fill-white" />
            </span>
          </span>
          {done ? (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-emerald-400 px-2.5 py-1 text-[8px] font-black text-slate-950">
              DONE
            </span>
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-3 px-0.5 pt-2.5">
          <h3 className="min-w-0 flex-1 line-clamp-2 text-[14px] font-extrabold leading-snug text-slate-100">
            {video.title || "Watch & Earn video"}
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-cyan-300">
            <Zap className="size-3.5 fill-cyan-300/40" />
            Earn after completion
          </span>
        </div>
        <div className="flex items-center gap-2 px-0.5 pt-1.5">
          {video.postedByPhotoUrl ? (
            <img src={video.postedByPhotoUrl} alt="" className="size-5 rounded-full object-cover ring-1 ring-white/10" />
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-cyan-500/15 text-[8px] font-black text-cyan-200">
              {(video.postedByName ?? "T").charAt(0)}
            </span>
          )}
          <span className="min-w-0 truncate text-[10px] font-semibold text-slate-400">
            {video.postedByName ?? "TASKORA"}
          </span>
          <span className="shrink-0 text-[10px] text-slate-600">•</span>
          <span className="shrink-0 text-[10px] font-medium text-slate-500">
            {formatCompactViews(video.youtubeViewsCount ?? video.viewsCount)} views
          </span>
          <span className="shrink-0 text-[10px] font-medium text-slate-500">• {formatTime(video.durationSeconds)}</span>
        </div>
        <div className="px-0.5 pt-1 text-[10px] font-medium text-slate-500">
          Required watch time · {formatTime(video.durationSeconds)}
        </div>
      </button>
    </article>
  );
}

function formatCompactViews(count: number) {
  const n = Math.max(0, Number(count) || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
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
  completionReward,
  isPlaying,
  onPlayingChange,
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
  completionReward: number;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onBack: () => void;
  onComplete: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#05080f] pb-10 text-white">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/[0.07] bg-[#05080f]/95 px-3 py-2.5 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="rounded-full p-2 text-slate-200 hover:bg-white/5"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{active.title}</p>
      </header>

      {/* YouTube embed — full width like NEWTUBE */}
      <section className="bg-black">
        <div className="relative aspect-video w-full">
          <VideoPlayer video={active} onPlayingChange={onPlayingChange} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/85 to-transparent" />
          <div className="absolute inset-x-3 bottom-2">
            <div className="mb-1 h-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-cyan-300 transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-bold text-white/80">
              <span>
                {formatTime(elapsed)} / {formatTime(required)}
              </span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Session earnings card — NEWTUBE style */}
      <section className="px-3.5 pt-4">
        <div className="rounded-2xl border border-cyan-400/25 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,.14),transparent_55%),#0a1424] px-4 py-5 text-center shadow-[0_0_28px_rgba(34,211,238,0.08)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Watch & Earn
          </p>
          <p className="mt-1.5 text-[22px] font-black leading-none text-cyan-100">
            Complete the watch to receive your reward
          </p>
          <p className="mt-2 text-[11px] font-medium text-slate-500">
            Keep watching until the required time is reached.
          </p>
          <p className="mt-1 text-[10px] font-semibold text-cyan-300/80">
            {isPlaying ? "Playing · time is being verified" : "Press play to start verified watch time"}
          </p>
        </div>

        <button
          type="button"
          disabled={!canComplete || busy}
          onClick={onComplete}
          className="mt-3.5 w-full rounded-2xl py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 disabled:opacity-45"
          style={{ background: BLUE_GRAD }}
        >
          {busy
            ? "Claiming…"
            : canComplete
              ? "Claim reward"
              : isPlaying
                ? `Watch ${Math.max(0, required - elapsed)}s more`
                : "Play the video to start"}
        </button>
        {message ? (
          <p className="mt-2 text-center text-xs font-semibold text-cyan-200">{message}</p>
        ) : null}
      </section>

      {/* Up next — NEWTUBE list */}
      <section className="mt-6 px-3.5">
        <div className="mb-3 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-cyan-400" />
          <p className="text-sm font-black">Up next</p>
        </div>
        <div className="space-y-2.5">
          {upNext.map((v) => {
            const t = getVideoThumbnail(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 text-left active:bg-white/[0.06]"
              >
                <div className="relative size-[4.25rem] shrink-0 overflow-hidden rounded-lg bg-[#101722]">
                  {t ? (
                    <img src={t} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-full items-center justify-center">
                      <Play className="size-5 text-slate-500" />
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="size-4 fill-white text-white" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-100">
                    {v.title}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300/90">
                    <Zap className="size-3 fill-cyan-300/30" />
                    {rewardLabel(v)}
                  </p>
                </div>
              </button>
            );
          })}
          {upNext.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-slate-500">No more videos in queue</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function VideoPlayer({ video, onPlayingChange }: { video: WatchVideo; onPlayingChange: (playing: boolean) => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const youtubeId = getYoutubeId(video.videoUrl ?? "");

  useEffect(() => {
    if (!youtubeId) return;
    let cancelled = false;

    const createPlayer = () => {
      if (cancelled || !hostRef.current || !(window as any).YT?.Player) return;
      playerRef.current?.destroy?.();
      playerRef.current = new (window as any).YT.Player(hostRef.current, {
        videoId: youtubeId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1 },
        events: {
          onStateChange: (event: any) => {
            onPlayingChange(Number(event?.data) === 1);
          },
        },
      });
    };

    const w = window as any;
    if (w.YT?.Player) {
      createPlayer();
    } else {
      let wait: ReturnType<typeof setInterval> | undefined;
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        createPlayer();
      };
      wait = setInterval(() => {
        if (w.YT?.Player) {
          clearInterval(wait);
          createPlayer();
        }
      }, 250);
      setTimeout(() => wait && clearInterval(wait), 10000);
    }

    return () => {
      cancelled = true;
      onPlayingChange(false);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [youtubeId, onPlayingChange]);

  if (youtubeId) return <div ref={hostRef} className="size-full" />;

  if (video.videoUrl) {
    return (
      <a href={video.videoUrl} target="_blank" rel="noreferrer" className="flex size-full flex-col items-center justify-center gap-2 bg-[#0b1420] text-cyan-200">
        <Play className="size-12" />
        <span className="text-xs font-bold">Open on {video.providerName || "platform"}</span>
      </a>
    );
  }

  return <div className="flex size-full items-center justify-center bg-[#0b1420] text-slate-500"><Play className="size-12" /></div>;
}

function getYoutubeId(videoUrl: string) {
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v") ?? "";
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      return marker >= 0 ? parts[marker + 1] ?? "" : "";
    }
  } catch {
    return "";
  }
  return "";
}

function formatTime(totalSeconds: number) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
