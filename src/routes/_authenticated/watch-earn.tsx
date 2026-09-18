import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Coins, Loader2, Play, ShieldCheck, Sparkles, Video, WalletCards } from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { completeWatchVideo, listWatchVideos, startWatchVideo, type WatchVideo } from "@/lib/watch-video.functions";
import { TASKORA_LOGO } from "@/lib/brand";
import { formatUsd } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/watch-earn")({
  head: () => ({ meta: [{ title: "Watch & Earn — TASKORA" }] }),
  loader: async () => {
    const [videos, dashboard] = await Promise.all([
      listWatchVideos().catch(() => []),
      getDashboard().catch(() => null),
    ]);
    return { videos, dashboard };
  },
  component: WatchEarnPage,
});

function money(value: number) { return formatUsd(value); }

function WatchEarnPage() {
  const { videos, dashboard } = Route.useLoaderData();
  const [activeId, setActiveId] = useState(videos[0]?.id ?? null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const active = videos.find((v) => v.id === activeId) ?? null;
  const next = useMemo(() => videos.filter((v) => v.id !== activeId), [videos, activeId]);

  useEffect(() => {
    setSessionId(null); setElapsed(0); setMessage(null);
    if (!active) return;
    let cancelled = false;
    setBusy(true);
    void startWatchVideo({ data: { videoId: active.id } })
      .then((result) => { if (!cancelled) setSessionId(result.sessionId); })
      .catch((e) => { if (!cancelled) setMessage(e instanceof Error ? e.message : "Could not start this video."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [active?.id]);

  useEffect(() => {
    if (!sessionId || !active) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionId, active?.id]);

  const required = Math.max(3, active?.durationSeconds ?? 0);
  const progress = active ? Math.min(100, (elapsed / required) * 100) : 0;
  const ready = Boolean(sessionId && active && elapsed >= required);

  async function finish() {
    if (!sessionId || !active || busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = await completeWatchVideo({ data: { sessionId } });
      if (!result.already) {
        setSessionEarned((value) => value + Number(result.rewardUsdt ?? 0));
        setMessage(result.rewardUsdt ? `Reward credited: ${money(Number(result.rewardUsdt))}` : "Video completed.");
      } else setMessage("This video was already completed.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Reward verification is still pending."); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#060914] pb-32 text-white">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#060914]/95 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src={TASKORA_LOGO} alt="" className="size-10 rounded-2xl object-cover ring-1 ring-blue-400/30" />
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">TASKORA</p><h1 className="text-lg font-extrabold tracking-tight">Watch & Earn</h1></div>
          {dashboard?.isOwner ? <Link to="/owner/videos" className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-2.5 py-2 text-[10px] font-bold text-blue-300">Manage</Link> : null}
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-right"><p className="text-[9px] uppercase tracking-wide text-slate-500">Wallet</p><p className="text-xs font-bold text-blue-300">{formatUsd(Number(dashboard?.balance ?? 0))}</p></div>
        </div>
      </header>

      {active ? <>
        <section className="border-b border-white/5 bg-black">
          <div className="relative aspect-video w-full overflow-hidden bg-black">
            {active.videoUrl ? <video key={active.id} src={active.videoUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" onEnded={() => void finish()} /> : <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(37,99,235,.28),transparent_55%)]"><Video className="size-12 text-blue-300/60" /></div>}
            <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-semibold backdrop-blur">{active.sourceType === "external_provider" ? active.providerName ?? "Provider" : "TASKORA"}</div>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-base font-bold leading-tight">{active.title}</h2><p className="mt-1 text-[11px] text-slate-500">{active.durationSeconds}s · verified reward flow</p></div><div className="rounded-xl bg-emerald-400/10 px-2.5 py-1.5 text-right"><p className="text-[9px] uppercase tracking-wide text-emerald-300/70">Reward</p><p className="text-xs font-extrabold text-emerald-300">{money(active.rewardUsdt)}</p></div></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500"><span>{Math.min(elapsed, required)}s / {required}s watched</span><span>{ready ? "Ready to verify" : "Keep watching"}</span></div>
            <button type="button" onClick={() => void finish()} disabled={!ready || busy || active.sourceType === "external_provider"} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-[#031018] disabled:opacity-40" style={{ background: "linear-gradient(135deg,#22d3ee,#3b82f6)" }}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {active.sourceType === "external_provider" ? "Provider verifies reward" : ready ? "Claim reward" : "Watch to unlock reward"}
            </button>
            {message ? <p className="mt-3 text-center text-[11px] text-slate-400">{message}</p> : null}
          </div>
        </section>

        <section className="mx-4 mt-4 rounded-3xl border border-violet-400/15 bg-violet-500/[0.05] p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">✦</div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white">Task Points stay separate</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Daily check-in and referrals earn Task Points. Watching videos earns USDT.</p>
            </div>
          </div>
        </section>

        <section className="px-4 pt-5">
          <div className="mb-3 flex items-center gap-2"><span className="size-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.7)]" /><h2 className="text-base font-bold">Up next</h2></div>
          {next.length ? <div className="space-y-3">{next.map((video) => <VideoRow key={video.id} video={video} onClick={() => setActiveId(video.id)} />)}</div> : <div className="rounded-3xl border border-white/7 bg-white/[0.025] p-5 text-center"><Sparkles className="mx-auto size-6 text-blue-300/60" /><p className="mt-2 text-sm font-semibold">You’re all caught up</p><p className="mt-1 text-[11px] text-slate-500">New provider videos and Owner uploads will appear here.</p></div>}
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 px-4">
          <div className="rounded-3xl border border-blue-400/15 bg-blue-500/[0.06] p-4"><WalletCards className="size-5 text-blue-300" /><p className="mt-3 text-[10px] uppercase tracking-wide text-slate-500">This session</p><p className="mt-1 text-lg font-extrabold text-blue-300">{money(sessionEarned)}</p></div>
          <div className="rounded-3xl border border-emerald-400/15 bg-emerald-500/[0.05] p-4"><ShieldCheck className="size-5 text-emerald-300" /><p className="mt-3 text-[10px] uppercase tracking-wide text-slate-500">Reward type</p><p className="mt-1 text-sm font-extrabold text-emerald-300">USDT</p><p className="text-[10px] text-slate-500">Watch rewards go to your withdrawable wallet.</p></div>
        </section>
      </> : <section className="px-4 pt-10"><div className="rounded-[2rem] border border-blue-400/15 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,.2),transparent_55%)] p-7 text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20"><Play className="size-7" /></div><h2 className="mt-5 text-xl font-extrabold">No videos available</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">External provider inventory and Owner-uploaded videos will appear here when they are active.</p><div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500"><Clock3 className="size-3.5" /> Verified completions only <Coins className="ml-2 size-3.5" /> USDT rewards</div>{dashboard?.isOwner ? <Link to="/owner/videos" className="mx-auto mt-5 inline-flex rounded-2xl bg-blue-500/15 px-4 py-2.5 text-xs font-bold text-blue-300">Upload a TASKORA video</Link> : null}</div></section>}
    </main>
  );
}

function VideoRow({ video, onClick }: { video: WatchVideo; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 text-left"><div className="relative size-[86px] shrink-0 overflow-hidden rounded-2xl bg-[#111827] ring-1 ring-white/5">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : video.videoUrl ? <video src={video.videoUrl} muted preload="metadata" className="h-full w-full object-cover" /> : null}<span className="absolute inset-0 flex items-center justify-center bg-black/15"><span className="rounded-full bg-black/65 p-2"><Play className="size-3 fill-white text-white" /></span></span></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold leading-5">{video.title}</p><div className="mt-1.5 flex items-center gap-2"><span className="text-[10px] text-slate-500">{video.durationSeconds}s</span><span className="text-[10px] font-bold text-emerald-300">⚡ {money(video.rewardUsdt)}</span></div></div></button>;
}
