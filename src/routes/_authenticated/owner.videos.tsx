import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Film, Loader2, PlayCircle, WalletCards, Zap } from "lucide-react";
import { OwnerShell } from "@/components/OwnerShell";
import { createOwnerVideoUploadUrl, listOwnerVideos, registerOwnerVideo, type WatchVideo } from "@/lib/watch-video.functions";

export const Route = createFileRoute("/_authenticated/owner/videos")({ component: OwnerVideosPage });

function OwnerVideosPage() {
  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardUsdt, setRewardUsdt] = useState("0.0010");
  const [rewardPoints, setRewardPoints] = useState("0");
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try { setVideos(await listOwnerVideos()); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not load videos."); }
  }
  useEffect(() => { void refresh(); }, []);

  async function upload(file: File | null) {
    if (!file) return;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) { setMessage("Use MP4, WebM, or MOV video."); return; }
    if (file.size > 500 * 1024 * 1024) { setMessage("Maximum video size is 500MB."); return; }
    setBusy(true); setMessage(null);
    try {
      const seconds = await readDuration(file);
      setDuration(Math.round(seconds));
      const signed = await createOwnerVideoUploadUrl({ data: { fileName: file.name, mimeType: file.type } });
      const put = await fetch(signed.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await registerOwnerVideo({ data: {
        title: title.trim() || file.name,
        description: description.trim() || undefined,
        videoPath: signed.path,
        videoUrl: signed.publicUrl,
        durationSeconds: seconds,
        rewardUsdt: Math.max(0, Number(rewardUsdt) || 0),
        rewardPoints: Math.max(0, Math.floor(Number(rewardPoints) || 0)),
      }});
      setTitle(""); setDescription(""); setRewardUsdt("0.0010"); setRewardPoints("0"); setDuration(0);
      setMessage("Video published to Watch & Earn."); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Video upload failed."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <OwnerShell>
      <main className="px-4 pb-10 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60"><ChevronLeft className="size-4" /></Link>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Monetization</p><h1 className="text-xl font-extrabold">Video Studio</h1></div>
        </div>

        <section className="rounded-3xl border border-blue-400/20 bg-[#121f33] p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300"><Film className="size-5" /></span>
            <div><p className="text-sm font-bold">Upload a TASKORA video</p><p className="text-[11px] text-slate-500">It appears in the same Watch & Earn queue as provider inventory.</p></div>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-blue-400/40" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description (optional)" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-blue-400/40" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3"><span className="text-[9px] uppercase tracking-wide text-emerald-300/70">USDT reward</span><input inputMode="decimal" value={rewardUsdt} onChange={(e) => setRewardUsdt(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-bold text-emerald-300 outline-none" /></label>
            <label className="rounded-2xl border border-blue-400/15 bg-blue-400/5 p-3"><span className="text-[9px] uppercase tracking-wide text-blue-300/70">Task Points (optional)</span><input inputMode="numeric" value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-bold text-blue-300 outline-none" /></label>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">USDT is the normal reward. Task Points stay at 0 unless you explicitly set them.</p>
          <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" disabled={busy} onChange={(e) => void upload(e.target.files?.[0] ?? null)} className="mt-4 block w-full text-xs text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-400 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#061018]" />
          {busy ? <p className="mt-2 flex items-center justify-center gap-2 text-xs text-blue-300"><Loader2 className="size-3.5 animate-spin" /> Uploading video…</p> : null}
          {duration > 0 ? <p className="mt-2 text-center text-[10px] text-slate-500">Detected duration: {duration}s</p> : null}
          {message ? <p className="mt-3 text-center text-xs text-slate-400">{message}</p> : null}
        </section>

        <div className="mt-6 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Published videos</p><span className="text-[10px] text-slate-500">{videos.length}</span></div>
        <div className="mt-2 space-y-2">
          {videos.length === 0 ? <div className="rounded-2xl border border-white/7 bg-[#121f33] p-4 text-sm text-slate-500">No Owner-uploaded videos yet.</div> : videos.map((video) => (
            <div key={video.id} className="rounded-2xl border border-white/7 bg-[#121f33] p-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><PlayCircle className="size-5" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{video.title}</p><p className="text-[10px] text-slate-500">{video.durationSeconds}s · active</p></div>
                <div className="text-right"><p className="text-[10px] font-bold text-emerald-300">${video.rewardUsdt.toFixed(4)}</p>{video.rewardPoints ? <p className="text-[9px] text-blue-300">+{video.rewardPoints} TP</p> : null}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] text-slate-500"><div className="rounded-2xl border border-white/7 bg-[#121f33] p-3"><WalletCards className="size-4 text-emerald-300" /><p className="mt-2">USDT rewards use the existing wallet ledger.</p></div><div className="rounded-2xl border border-white/7 bg-[#121f33] p-3"><Zap className="size-4 text-blue-300" /><p className="mt-2">External provider rewards remain provider-verified.</p></div></div>
      </main>
    </OwnerShell>
  );
}

function readDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => { const seconds = Number(video.duration); URL.revokeObjectURL(url); resolve(Number.isFinite(seconds) ? seconds : 0); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read video duration.")); };
    video.src = url;
  });
}
