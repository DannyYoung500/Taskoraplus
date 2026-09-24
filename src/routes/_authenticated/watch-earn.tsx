import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  Play,
  ShieldCheck,
  Zap,
  Star,
  Flame,
  Bell,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import {
  completeWatchVideo,
  listWatchVideos,
  startWatchVideo,
  type WatchVideo,
} from "@/lib/watch-video.functions";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd } from "@/lib/taskora-display";

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

  const active = videos.find((v) => v.id === activeId) ?? null;

  const filtered = useMemo(() => {
    if (filter === "all") return videos;
    const copy = [...videos];
    if (filter === "trending" || filter === "hot") {
      copy.sort((a, b) => Number(b.rewardUsdt ?? 0) - Number(a.rewardUsdt ?? 0));
    }
    return copy;
  }, [videos, filter]);

  const dailyCap = 5;
  const watchedCount = doneIds.size;

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
      .catch((e) => {
        if (!cancelled) setMessage(e instanceof Error ? e.message : "Could not start this video.");
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

  const required = Math.max(3, Number(active?.durationSeconds ?? 30));
  const progress = Math.min(100, Math.round((elapsed / required) * 100));
  const canComplete = Boolean(sessionId && elapsed >= required && !busy);

  async function onComplete() {
    if (!sessionId || !active) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await completeWatchVideo({ data: { sessionId } });
      const earned = Number((r as { rewardUsdt?: number }).rewardUsdt ?? 0);
      setSessionEarned((v) => v + earned);
      setDoneIds((prev) => new Set(prev).add(active.id));
      setMessage(`Earned ${formatUsd(earned)}`);
      setActiveId(null);
      setSessionId(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not complete video.");
    } finally {
      setBusy(false);
    }
  }

  const profile = dashboard?.profile as {
    display_name?: string;
    photo_url?: string;
    level_num?: number;
  } | null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <img
          src={TASKORA_LOGO}
          alt="TASKORA"
          className="size-10 rounded-full object-cover ring-2 ring-cyan-400/50"
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-xl font-black tracking-[0.06em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            TASKORA
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
            Earn · Play · Grow
          </p>
        </div>
        <Link to="/notifications" className="rounded-full border border-cyan-400/20 bg-[#0b1628] p-2.5">
          <Bell className="size-4 text-slate-300" />
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-1 rounded-full border border-cyan-400/25 bg-[#0b1628] py-1 pl-1 pr-2"
        >
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold">
              {(profile?.display_name ?? "T").charAt(0)}
            </span>
          )}
          <div className="leading-tight">
            <p className="max-w-[64px] truncate text-[10px] font-bold">
              {profile?.display_name ?? "Tasker"}
            </p>
            <p className="text-[8px] text-cyan-300/70">Level {profile?.level_num ?? 1}</p>
          </div>
        </Link>
      </header>

      <section
        className="relative mb-3.5 overflow-hidden rounded-[22px] border border-cyan-400/30 p-4 shadow-[0_0_36px_rgba(14,165,233,0.15)]"
        style={{
          background:
            "radial-gradient(circle at 90% 30%,rgba(56,189,248,0.25),transparent 40%), linear-gradient(145deg,#0a1a33,#060f1c)",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-200">
            <Play className="size-6 fill-cyan-200" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black">
              Watch & <span className="text-cyan-300">Earn</span>
            </h1>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Watch short videos, earn rewards and grow your balance.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip icon={Zap} label="Quick & Easy" />
          <Chip icon={ShieldCheck} label="Trusted Providers" />
          <Chip icon={Star} label="Real Rewards" />
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/8 bg-[#0b1628] px-3.5 py-3">
        <div>
          <p className="text-sm font-bold">Available Videos</p>
          <p className="text-[10px] text-slate-500">Watch videos and earn rewards</p>
        </div>
        <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-200">
          {watchedCount}/{Math.max(dailyCap, videos.length || dailyCap)}
        </span>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {(
          [
            ["all", "All", null],
            ["trending", "Trending", Flame],
            ["hot", "Hot", Flame],
            ["recommended", "Recommended", Star],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
              filter === id
                ? "bg-sky-400 text-[#04101c]"
                : "border border-white/10 bg-[#0b1628] text-slate-400"
            }`}
          >
            {Icon ? <Icon className="size-3" /> : null}
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="mb-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-center text-xs text-cyan-100">
          {message}
        </p>
      ) : null}

      {active ? (
        <section className="mb-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0b1628] shadow-2xl">
          <div className="relative aspect-video w-full bg-black">
            <VideoPlayer video={active} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute inset-x-3 bottom-3">
              <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-[9px] font-semibold text-white/80">
                <span>{elapsed}s / {required}s</span>
                <span>{formatUsd(Number(active.rewardUsdt ?? 0))} reward</span>
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 text-base font-black">{active.title ?? "Watch video"}</h2>
                <p className="mt-1 text-[10px] text-slate-500">{active.providerName ?? "TASKORA"} · Watch the full video to qualify</p>
              </div>
              <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black text-amber-200">+{formatUsd(Number(active.rewardUsdt ?? 0)).replace("$", "")}</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={!canComplete} onClick={() => void onComplete()} className="flex-1 rounded-2xl py-3 text-xs font-black text-white disabled:opacity-40" style={{ background: BLUE_GRAD }}>
                {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : canComplete ? "Claim reward" : `Keep watching · ${Math.max(0, required - elapsed)}s`}
              </button>
              <button type="button" onClick={() => { setActiveId(null); setSessionId(null); }} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-slate-300">Close</button>
            </div>
          </div>
        </section>
      ) : null}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#0b1628] p-5 text-center text-sm text-slate-400">
            No watch videos available yet. Owner can add providers and inventory.
          </p>
        ) : (
          filtered.map((v) => {
            const reward = Number(v.rewardUsdt ?? 0);
            const dur = Number(v.durationSeconds ?? 0);
            const done = doneIds.has(v.id);
            return (
              <button
                key={v.id}
                type="button"
                disabled={done}
                onClick={() => setActiveId(v.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1628] p-3 text-left active:scale-[0.995] disabled:opacity-50"
              >
                <span className="relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-blue-900/40">
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Play className="size-6 text-cyan-200" />
                  )}
                  {dur > 0 ? (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[8px] font-bold">
                      {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, "0")}
                    </span>
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{v.title ?? "Video"}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {v.providerName ?? "Watch"} ·{" "}
                    {v.rewardPoints > 0 ? `+${v.rewardPoints} TP` : "Live"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[11px] font-black text-amber-200">
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-amber-400/20 text-[9px]">
                      T
                    </span>
                    +{reward > 0 ? formatUsd(reward).replace("$", "") : "TP"}
                  </span>
                  <p className="mt-1 text-[9px] text-slate-500">{done ? "Done" : "Task Points"}</p>
                </div>
                <span
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: BLUE_GRAD }}
                >
                  {done ? <CheckCircle2 className="size-4" /> : <Play className="size-4 fill-white" />}
                </span>
              </button>
            );
          })
        )}
      </div>

      {sessionEarned > 0 ? (
        <p className="mt-3 text-center text-[11px] text-emerald-300">
          Session earned {formatUsd(sessionEarned)}
        </p>
      ) : null}
    </main>
  );
}


function VideoPlayer({ video }: { video: WatchVideo }) {
  const src = getEmbedUrl(video.videoUrl, video.providerName);
  if (src) {
    return <iframe title={video.title} src={src} className="absolute inset-0 size-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
  }
  if (video.videoUrl && /\.(mp4|webm|ogg)(\?.*)?$/i.test(video.videoUrl)) {
    return <video className="absolute inset-0 size-full object-contain" src={video.videoUrl} controls playsInline />;
  }
  return (
    <a href={video.videoUrl ?? "#"} target="_blank" rel="noreferrer" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#07111f] text-center">
      {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover opacity-60" /> : null}
      <span className="relative flex size-14 items-center justify-center rounded-full bg-white text-[#06111f] shadow-xl"><Play className="size-6 fill-current" /></span>
      <span className="relative px-5 text-xs font-bold text-white">Open this video on {video.providerName ?? "the original platform"}</span>
    </a>
  );
}

function getEmbedUrl(videoUrl: string | null, providerName: string | null) {
  if (!videoUrl) return null;
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      let id = "";
      if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
      else if (url.pathname.startsWith("/watch")) id = url.searchParams.get("v") ?? "";
      else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] ?? "";
      else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] ?? "";
      return id ? "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1" : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? "https://player.vimeo.com/video/" + id + "?autoplay=1" : null;
    }
    if (host === "tiktok.com" || host === "vm.tiktok.com") {
      const match = url.pathname.match(/\/video\/(\d+)/);
      return match ? "https://www.tiktok.com/player/v1/" + match[1] + "?description=1&music_info=1" : null;
    }
  } catch {}
  return null;
}
function Chip({ icon: Icon, label }: { icon: typeof Zap; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
      <Icon className="size-3 text-amber-300" />
      {label}
    </span>
  );
}
