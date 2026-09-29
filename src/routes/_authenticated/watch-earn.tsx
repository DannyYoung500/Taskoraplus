import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock3,
  Flame,
  Gamepad2,
  History,
  Home,
  Loader2,
  Play,
  PlayCircle,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
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

type Filter = "all" | "trending" | "hot" | "recommended";

function WatchEarnPage() {
  const { videos, dashboard } = Route.useLoaderData();
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);

  const active = videos.find((v) => v.id === activeId) ?? null;
  const profile = dashboard?.profile as {
    display_name?: string | null;
    photo_url?: string | null;
    level_num?: number | null;
  } | null;

  const filtered = useMemo(() => {
    if (filter === "all") return videos;
    const copy = [...videos];
    if (filter === "trending" || filter === "hot") {
      copy.sort((a, b) => Number(b.rewardUsdt ?? 0) - Number(a.rewardUsdt ?? 0));
    }
    if (filter === "recommended") {
      copy.sort((a, b) => Number(b.rewardPoints ?? 0) - Number(a.rewardPoints ?? 0));
    }
    return copy;
  }, [videos, filter]);

  const required = Math.max(3, Number(active?.durationSeconds ?? 30));
  const progress = Math.min(100, Math.round((elapsed / required) * 100));
  const canComplete = Boolean(sessionId && elapsed >= required && !busy);
  const completedCount = doneIds.size;

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
      if (isPlaying && document.visibilityState === "visible") setElapsed((v) => v + 1);
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
      setSessionEarned((value) => value + earned);
      setDoneIds((previous) => new Set(previous).add(active.id));
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
    setIsPlaying(false);
    setMessage(null);
  }

  if (active) {
    return (
      <WatchPlayer
        active={active}
        videos={filtered}
        profile={profile}
        elapsed={elapsed}
        required={required}
        progress={progress}
        canComplete={canComplete}
        busy={busy}
        message={message}
        sessionEarned={sessionEarned}
        onBack={closePlayer}
        onComplete={() => void onComplete()}
        onSelect={setActiveId}
        onPlayingChange={setIsPlaying}
      />
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#05080f] pb-24 text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#05080f]/95 px-3.5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label="Search videos" className="rounded-full p-2 text-slate-300 hover:bg-white/5">
            <Search className="size-5" />
          </button>
          <img src={TASKORA_LOGO} alt="TASKORA" className="size-9 rounded-full object-cover ring-1 ring-cyan-400/40" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-black tracking-wide">TASKORA</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Watch & Earn</p>
          </div>
          <AppLink to="/notifications" aria-label="Notifications" className="rounded-full p-2 text-slate-300 hover:bg-white/5">
            <Bell className="size-5" />
          </AppLink>
          <AppLink to="/profile" aria-label="Profile" className="overflow-hidden rounded-full ring-1 ring-white/10">
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
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Rewarded video</p>
            <h1 className="mt-1 text-[25px] font-black leading-tight">Watch videos.<br />Earn while you watch.</h1>
          </div>
          <div className="shrink-0 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2 text-right">
            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Watched</p>
            <p className="text-lg font-black text-cyan-200">{completedCount}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_90%_20%,rgba(34,211,238,.18),transparent_42%),linear-gradient(145deg,#0d1b2c,#08101c)] p-4 shadow-[0_12px_40px_rgba(8,47,73,.35)]">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20">
              <Zap className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Daily watch bonus</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Watch qualifying videos completely. Rewards are credited only after a valid session is verified.
              </p>
            </div>
            <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black text-cyan-200">LIVE</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {([
            ["all", "All", PlayCircle],
            ["trending", "Trending", Flame],
            ["hot", "Hot", Zap],
            ["recommended", "Recommended", Star],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[10px] font-black transition ${
                filter === id ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-400"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {message ? (
        <div className="mx-3.5 mt-3 flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2.5 text-[11px] text-cyan-100">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="flex-1">{message}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">
            <X className="size-4 text-slate-500" />
          </button>
        </div>
      ) : null}

      <section className="mt-4">
        <div className="mb-2.5 flex items-center justify-between px-3.5">
          <div>
            <h2 className="text-sm font-black">Videos for you</h2>
            <p className="text-[9px] text-slate-500">Choose a video and watch it like a normal player.</p>
          </div>
          <span className="text-[10px] font-bold text-slate-500">{filtered.length} available</span>
        </div>

        {filtered.length === 0 ? (
          <div className="mx-3.5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <PlayCircle className="mx-auto size-10 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">No videos available</p>
            <p className="mt-1 text-[10px] text-slate-500">New qualifying videos will appear here when inventory is live.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((video, index) => (
              <VideoFeedCard
                key={video.id}
                video={video}
                rank={index}
                done={doneIds.has(video.id)}
                onSelect={() => setActiveId(video.id)}
              />
            ))}
          </div>
        )}
      </section>
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
        const marker = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
        if (marker >= 0) id = parts[marker + 1] ?? "";
      }
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } catch {}
  return null;
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
  const duration = Number(video.durationSeconds ?? 0);
  const reward = Number(video.rewardUsdt ?? 0);
  const points = Number(video.rewardPoints ?? 0);
  return (
    <article className="px-3.5">
      <button type="button" onClick={onSelect} className="block w-full text-left active:scale-[0.995]">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#101722] ring-1 ring-white/[0.08]">
          {getVideoThumbnail(video) ? (
            <img
              src={getVideoThumbnail(video)!}
              alt=""
              className="size-full object-cover"
              loading={rank < 2 ? "eager" : "lazy"}
              onError={(event) => {
                event.currentTarget.style.display = "none";
                event.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,.22),transparent_45%),#0b1420]${getVideoThumbnail(video) ? " hidden" : ""}`}>
            <Play className="size-10 fill-white/90 text-white/90" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[9px] font-black backdrop-blur">
            <Play className="size-3 fill-white" /> WATCH
          </span>
          {duration > 0 ? (
            <span className="absolute bottom-2.5 right-2.5 rounded bg-black/80 px-1.5 py-1 text-[9px] font-bold">
              {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
            </span>
          ) : null}
          {done ? (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-emerald-400 px-2 py-1 text-[8px] font-black text-slate-950">COMPLETED</span>
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-black/45 text-white shadow-2xl ring-1 ring-white/30 backdrop-blur-sm">
              <Play className="ml-0.5 size-6 fill-white" />
            </span>
          </span>
        </div>
        <div className="flex gap-3 px-1 pt-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-400/10 ring-1 ring-cyan-400/20">
            <img src={TASKORA_LOGO} alt="" className="size-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[14px] font-extrabold leading-snug text-slate-100">{video.title || "Watch & Earn video"}</h3>
            <p className="mt-1 text-[10px] text-slate-500">{video.providerName || "TASKORA"} · {points > 0 ? `+${points} TP` : reward > 0 ? `+${formatUsd(reward)}` : "Rewarded video"}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-black text-cyan-200">{reward > 0 ? formatUsd(reward) : points > 0 ? `+${points} TP` : "Earn"}</p>
          </div>
        </div>
      </button>
    </article>
  );
}

function WatchPlayer({
  active,
  profile,
  elapsed,
  required,
  progress,
  canComplete,
  busy,
  message,
  sessionEarned,
  onBack,
  onComplete,
}: {
  active: WatchVideo;
  videos: WatchVideo[];
  profile: { display_name?: string | null; photo_url?: string | null; level_num?: number | null } | null;
  elapsed: number;
  required: number;
  progress: number;
  canComplete: boolean;
  busy: boolean;
  message: string | null;
  sessionEarned: number;
  onBack: () => void;
  onComplete: () => void;
  onSelect: (id: string) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#05080f] pb-24 text-white">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/[0.07] bg-[#05080f]/95 px-3 py-2.5 backdrop-blur-xl">
        <button type="button" onClick={onBack} aria-label="Back to videos" className="rounded-full p-2 text-slate-200 hover:bg-white/5">
          <ArrowLeft className="size-5" />
        </button>
        <img src={TASKORA_LOGO} alt="TASKORA" className="size-8 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black">{active.title}</p>
          <p className="text-[8px] text-cyan-300/65">{active.providerName || "TASKORA"} · Watch session</p>
        </div>
        <AppLink to="/profile" className="overflow-hidden rounded-full ring-1 ring-white/10">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="" className="size-8 object-cover" />
          ) : (
            <span className="flex size-8 items-center justify-center bg-cyan-500/15 text-[10px] font-black text-cyan-200">
              {(profile?.display_name ?? "T").charAt(0)}
            </span>
          )}
        </AppLink>
      </header>
      <section className="bg-black">
        <div className="relative aspect-video w-full">
          <VideoPlayer video={active} onPlayingChange={onPlayingChange} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />
          <div className="absolute inset-x-3 bottom-3">
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-cyan-300 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-[9px] font-bold text-white/80">
              <span>{formatTime(elapsed)} / {formatTime(required)}</span>
              <span>{progress}% watched</span>
            </div>
          </div>
        </div>
      </section>
      <section className="border-b border-white/[0.07] px-3.5 py-4">
        <h1 className="text-[17px] font-black leading-snug">{active.title}</h1>
        <div className="mt-4">
          <button
            type="button"
            disabled={!canComplete || busy}
            onClick={onComplete}
            className="w-full rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-50"
            style={{ background: BLUE_GRAD }}
          >
            {busy ? "Claiming…" : canComplete ? "Claim reward" : `Watch ${Math.max(0, required - elapsed)}s more`}
          </button>
          {message ? <p className="mt-2 text-center text-xs text-cyan-200">{message}</p> : null}
          {sessionEarned > 0 ? (
            <p className="mt-1 text-center text-[10px] text-emerald-300">Session earned {formatUsd(sessionEarned)}</p>
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
          onStateChange: (event: any) => onPlayingChange(Number(event?.data) === 1),
        },
      });
    };

    const w = window as any;
    if (w.YT?.Player) {
      createPlayer();
    } else {
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
      const wait = window.setInterval(() => {
        if (w.YT?.Player) {
          window.clearInterval(wait);
          createPlayer();
        }
      }, 250);
      window.setTimeout(() => window.clearInterval(wait), 10000);
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
      <a href={video.videoUrl} target="_blank" rel="noreferrer" className="flex size-full flex-col items-center justify-center gap-3 bg-[#0b1420] text-cyan-200">
        <Play className="size-12" />
        <span className="text-xs font-bold">Open video on {video.providerName || "platform"}</span>
      </a>
    );
  }

  return <div className="flex size-full items-center justify-center bg-[#0b1420] text-slate-400"><Play className="size-12" /></div>;
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
  } catch {}
  return "";
}

function formatTime(totalSeconds: number) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
