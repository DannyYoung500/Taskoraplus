import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Film, Link2, Loader2, PlayCircle, WalletCards, Zap } from "lucide-react";
import { OwnerShell } from "@/components/OwnerShell";
import { listOwnerVideos, registerOwnerVideo, type WatchVideo } from "@/lib/watch-video.functions";

export const Route = createFileRoute("/_authenticated/owner/videos")({ component: OwnerVideosPage });
const PLATFORMS = ["YouTube", "TikTok", "X", "Instagram", "Facebook", "Other"] as const;

function OwnerVideosPage() {
  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("YouTube");
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardUsdt, setRewardUsdt] = useState("0.0010");
  const [rewardPoints, setRewardPoints] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() { try { setVideos(await listOwnerVideos()); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load videos."); } }
  useEffect(() => { void refresh(); }, []);

  async function addVideo() {
    if (!videoUrl.trim()) { setMessage("Paste the video link first."); return; }
    if (!/^https?:\/\//i.test(videoUrl.trim())) { setMessage("Enter a valid video link."); return; }
    if (!title.trim()) { setMessage("Video title is required."); return; }
    setBusy(true); setMessage(null);
    try {
      await registerOwnerVideo({ data: { platform, videoUrl: videoUrl.trim(), title: title.trim(), description: description.trim() || undefined, rewardUsdt: Math.max(0, Number(rewardUsdt) || 0), rewardPoints: Math.max(0, Math.floor(Number(rewardPoints) || 0)) } });
      setVideoUrl(""); setTitle(""); setDescription(""); setRewardUsdt("0.0010"); setRewardPoints("0");
      setMessage("Video added to Watch & Earn."); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not add video."); }
    finally { setBusy(false); }
  }

  return (
    <OwnerShell>
      <main className="px-4 pb-10 pt-4">
        <div className="mb-4 flex items-center gap-2"><Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60"><ChevronLeft className="size-4" /></Link><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Monetization</p><h1 className="text-xl font-extrabold">Video Studio</h1></div></div>
        <section className="rounded-3xl border border-blue-400/20 bg-[#121f33] p-4">
          <div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300"><Film className="size-5" /></span><div><p className="text-sm font-bold">Add a Watch & Earn video</p><p className="text-[11px] text-slate-500">Choose the platform and paste the public video link. TASKORA does not upload or store the video.</p></div></div>
          <label className="mt-4 block"><span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Platform</span><select value={platform} onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none"><option>YouTube</option><option>TikTok</option><option>X</option><option>Instagram</option><option>Facebook</option><option>Other</option></select></label>
          <label className="mt-2 block"><span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Video link 🔗</span><div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3"><Link2 className="size-4 text-blue-300" /><input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full bg-transparent py-3 text-sm outline-none" /></div></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description (optional)" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none" />
          <div className="mt-2 grid grid-cols-2 gap-2"><label className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3"><span className="text-[9px] uppercase tracking-wide text-emerald-300/70">USDT reward</span><input inputMode="decimal" value={rewardUsdt} onChange={(e) => setRewardUsdt(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-bold text-emerald-300 outline-none" /></label><label className="rounded-2xl border border-blue-400/15 bg-blue-400/5 p-3"><span className="text-[9px] uppercase tracking-wide text-blue-300/70">Task Points (optional)</span><input inputMode="numeric" value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-bold text-blue-300 outline-none" /></label></div>
          <p className="mt-2 text-[10px] text-slate-500">USDT is the normal reward. Task Points stay at 0 unless you explicitly set them.</p>
          <button type="button" disabled={busy} onClick={() => void addVideo()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy ? <><Loader2 className="size-4 animate-spin" /> Adding…</> : <><Link2 className="size-4" /> Add Video</>}</button>
          {message ? <p className="mt-3 text-center text-xs text-slate-400">{message}</p> : null}
        </section>
        <div className="mt-6 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Published videos</p><span className="text-[10px] text-slate-500">{videos.length}</span></div>
        <div className="mt-2 space-y-2">{videos.length === 0 ? <div className="rounded-2xl border border-white/7 bg-[#121f33] p-4 text-sm text-slate-500">No videos added yet.</div> : videos.map((video) => <div key={video.id} className="rounded-2xl border border-white/7 bg-[#121f33] p-3"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><PlayCircle className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{video.title}</p><p className="text-[10px] text-slate-500">{video.providerName ?? "Platform"} · {video.durationSeconds ? `${video.durationSeconds}s` : "duration pending"} · {video.status}</p></div><div className="text-right"><p className="text-[10px] font-bold text-emerald-300">${video.rewardUsdt.toFixed(4)}</p>{video.rewardPoints ? <p className="text-[9px] text-blue-300">+{video.rewardPoints} TP</p> : null}</div></div></div>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] text-slate-500"><div className="rounded-2xl border border-white/7 bg-[#121f33] p-3"><WalletCards className="size-4 text-emerald-300" /><p className="mt-2">USDT rewards use the existing wallet ledger.</p></div><div className="rounded-2xl border border-white/7 bg-[#121f33] p-3"><Zap className="size-4 text-blue-300" /><p className="mt-2">Provider completions must be verified before rewards are credited.</p></div></div>
      </main>
    </OwnerShell>
  );
}
