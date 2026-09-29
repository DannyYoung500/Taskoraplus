import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ExternalLink, Film, Loader2, Pause, Play, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { OwnerShell } from "@/components/OwnerShell";
import { deleteOwnerVideo, getYoutubeVideoMetadata, listOwnerVideos, registerOwnerVideo, setOwnerVideoStatus, type WatchVideo } from "@/lib/watch-video.functions";

export const Route = createFileRoute("/_authenticated/owner/videos")({ component: OwnerVideosPage });

function youtubeId(value: string) {
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host.endsWith("youtube.com")) {
      const direct = u.searchParams.get("v");
      if (direct) return direct;
      const parts = u.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((x) => ["shorts", "embed", "live"].includes(x));
      return marker >= 0 ? parts[marker + 1] ?? "" : "";
    }
  } catch {}
  return "";
}

function loadYoutubeApi() {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).YT?.Player) return resolve();
    const existing = document.querySelector('script[data-taskora-youtube-api]');
    if (existing) {
      const started = Date.now();
      const poll = () => {
        if ((window as any).YT?.Player) resolve();
        else if (Date.now() - started > 10000) reject(new Error("YouTube player metadata timed out."));
        else window.setTimeout(poll, 100);
      };
      poll();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.taskoraYoutubeApi = "true";
    (window as any).onYouTubeIframeAPIReady = () => resolve();
    script.onerror = () => reject(new Error("Could not load YouTube metadata service."));
    document.head.appendChild(script);
  });
}

function OwnerVideosPage() {
  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("0.0300");
  const [duration, setDuration] = useState("");
  const [daily, setDaily] = useState("1");
  const [maxViews, setMaxViews] = useState("0");
  const [thumb, setThumb] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try { setVideos(await listOwnerVideos()); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not load campaigns."); }
  };
  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const id = youtubeId(url.trim());
    if (!id) { setThumb(null); setChannel(""); return; }
    setThumb("https://img.youtube.com/vi/" + id + "/hqdefault.jpg");
    const timer = window.setTimeout(async () => {
      setMetadataBusy(true);
      try {
        const m = await getYoutubeVideoMetadata({ data: { url: url.trim() } });
        setTitle((v) => v || m.title);
        setThumb(m.thumbnailUrl);
        setChannel(m.authorName);
        try {
          await loadYoutubeApi();
          const host = document.createElement("div");
          host.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none";
          document.body.appendChild(host);
          const player = new (window as any).YT.Player(host, {
            videoId: id,
            playerVars: { playsinline: 1 },
            events: {
              onReady: () => {
                let tries = 0;
                const poll = () => {
                  const d = Number(player.getDuration?.() || 0);
                  if (d > 0) {
                    setDuration(String(Math.round(d)));
                    player.destroy?.();
                    host.remove();
                    return;
                  }
                  if (++tries < 40) window.setTimeout(poll, 250);
                  else { player.destroy?.(); host.remove(); }
                };
                poll();
              },
            },
          });
        } catch {}
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not read YouTube metadata.");
      } finally { setMetadataBusy(false); }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [url]);

  async function add() {
    if (!youtubeId(url.trim())) { setMessage("Paste a valid public YouTube URL."); return; }
    if (!title.trim()) { setMessage("Video title could not be detected."); return; }
    if (!duration || Number(duration) < 1) { setMessage("Wait for the YouTube duration to load."); return; }
    setBusy(true); setMessage(null);
    try {
      await registerOwnerVideo({ data: { platform: "YouTube", videoUrl: url.trim(), title: title.trim(), description: description.trim() || undefined, rewardUsdt: Math.max(0, Number(reward) || 0), durationSeconds: Math.round(Number(duration)), thumbnailUrl: thumb || undefined, dailyLimit: Math.max(1, Math.floor(Number(daily) || 1)), maxViews: Math.max(0, Math.floor(Number(maxViews) || 0)) } });
      setUrl(""); setTitle(""); setDescription(""); setReward("0.0300"); setDuration(""); setDaily("1"); setMaxViews("0"); setThumb(null); setChannel("");
      setMessage("Campaign published to Watch & Earn."); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not publish video."); }
    finally { setBusy(false); }
  }

  async function remove(v: WatchVideo) {
    if (!window.confirm("Remove this video from Watch & Earn? Existing watch/earning history will be preserved.")) return;
    setActionId(v.id);
    try { await deleteOwnerVideo({ data: { videoId: v.id } }); setMessage("Video deleted from the active feed."); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not remove video."); }
    finally { setActionId(null); }
  }

  async function toggle(v: WatchVideo) {
    setActionId(v.id);
    try { await setOwnerVideoStatus({ data: { videoId: v.id, status: v.status === "active" ? "paused" : "active" } }); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not update video."); }
    finally { setActionId(null); }
  }

  const active = videos.filter((v) => v.status === "active").length;
  const views = videos.reduce((n, v) => n + v.viewsCount, 0);
  const spend = videos.reduce((n, v) => n + v.viewsCount * v.rewardUsdt, 0);

  return (
    <OwnerShell>
      <main className="min-h-screen bg-[#06101d] px-4 pb-12 pt-4 text-white sm:px-6">
        <header className="mb-5 flex items-center gap-3">
          <Link to="/owner" className="rounded-xl border border-white/10 bg-white/5 p-2"><ChevronLeft className="size-4" /></Link>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Watch & Earn</p><h1 className="text-2xl font-black">Video Campaigns</h1><p className="text-xs text-slate-400">A proper advertiser studio for paid YouTube watch campaigns.</p></div>
          <button onClick={() => void refresh()} className="rounded-xl border border-white/10 p-2.5 text-slate-300"><RefreshCw className="size-4" /></button>
        </header>
        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Campaigns" value={videos.length} /><Metric label="Live" value={active} /><Metric label="Views" value={views} /><Metric label="Delivered value" value={`${spend.toFixed(4)}`} /></section>
        <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#0b1a2d]">
          <div className="border-b border-white/8 px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><UploadCloud className="size-5" /></span><div><h2 className="text-base font-black">Create Watch & Earn campaign</h2><p className="text-[11px] text-slate-400">Paste a YouTube URL. TASKORA automatically reads its artwork, title, channel and exact duration.</p></div></div></div>
          <div className="p-5">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">YouTube video URL</label>
            <div className="mt-1 flex gap-2 rounded-2xl border border-white/10 bg-black/20 px-3"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />{metadataBusy ? <Loader2 className="my-auto size-4 animate-spin text-cyan-300" /> : youtubeId(url) ? <Check className="my-auto size-4 text-emerald-300" /> : null}</div>
            {thumb ? <div className="mt-3 flex gap-3 rounded-2xl border border-white/8 bg-black/15 p-2.5"><img src={thumb} alt="" className="aspect-video w-32 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold">{title || "YouTube video"}</p><p className="mt-1 text-[10px] text-slate-500">{channel || "YouTube"} · {duration ? formatDuration(Number(duration)) : "Reading duration…"}</p></div></div> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Campaign title" value={title} onChange={setTitle} /><Field label="Reward per completed watch (USDT)" value={reward} onChange={setReward} numeric /><Field label="Required watch time" value={duration ? formatDuration(Number(duration)) : "Auto from YouTube"} readOnly /><Field label="Max watches / user / day" value={daily} onChange={setDaily} numeric /><Field label="Campaign max views" value={maxViews === "0" ? "Unlimited" : maxViews} onChange={(v) => setMaxViews(v === "Unlimited" ? "0" : v)} numeric /></div>
            <label className="mt-3 block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Campaign description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Tell users exactly what they earn and what they need to do." className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none" /></label>
            <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] leading-5 text-amber-100/75"><b className="text-amber-200">Pricing:</b> users see the exact USDT reward before starting. Only qualified foreground playback counts toward the required watch time.</div>
            <button disabled={busy || metadataBusy} onClick={() => void add()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-black disabled:opacity-50">{busy ? <><Loader2 className="size-4 animate-spin" /> Publishing…</> : <><UploadCloud className="size-4" /> Publish campaign</>}</button>
            {message ? <p className="mt-3 text-center text-xs text-slate-300">{message}</p> : null}
          </div>
        </section>
        <section className="mt-6"><div className="mb-3"><h2 className="text-lg font-black">Your posted videos</h2><p className="text-[11px] text-slate-500">Only your campaigns are removable. Removing one takes it out of the earning feed while preserving accounting history.</p></div><div className="space-y-3">{videos.map((v) => <article key={v.id} className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1a2d]"><div className="flex gap-3 p-3">{v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="h-20 w-32 shrink-0 rounded-xl object-cover" /> : <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-xl bg-white/5"><Film className="size-6 text-slate-500" /></div>}<div className="min-w-0 flex-1"><div className="flex items-start gap-2"><p className="line-clamp-2 flex-1 text-sm font-bold">{v.title}</p><span className={"rounded-full px-2 py-1 text-[9px] font-bold " + (v.status === "active" ? "bg-emerald-400/10 text-emerald-300" : v.status === "paused" ? "bg-amber-400/10 text-amber-300" : "bg-white/5 text-slate-500")}>{v.status}</span></div><p className="mt-1 text-[10px] text-slate-500">YouTube · {v.viewsCount.toLocaleString()} views · {formatDuration(v.durationSeconds)} · {`${v.rewardUsdt.toFixed(4)} / completion`}</p><p className="mt-1 text-[10px] text-slate-500">{v.maxViews ? `Max ${v.maxViews} views` : "Unlimited views"}</p></div></div><div className="flex border-t border-white/6 p-2.5"><a href={v.videoUrl ?? "#"} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-bold text-slate-300"><ExternalLink className="size-3.5" /> YouTube</a><button disabled={!!actionId || v.status === "completed"} onClick={() => void toggle(v)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-l border-white/6 py-2 text-[10px] font-bold text-slate-300 disabled:opacity-40">{v.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{v.status === "active" ? "Pause" : "Resume"}</button><button disabled={!!actionId || v.status === "completed"} onClick={() => void remove(v)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-l border-red-400/10 py-2 text-[10px] font-bold text-red-300 disabled:opacity-40"><Trash2 className="size-3.5" /> Delete</button></div></article>)}</div></section>
      </main>
    </OwnerShell>
  );
}
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-2xl border border-white/8 bg-[#0b1a2d] p-3"><p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-base font-black">{typeof value === "number" ? value.toLocaleString() : value}</p></div>; }
function Field({ label, value, onChange, numeric, readOnly }: { label: string; value: string; onChange?: (v: string) => void; numeric?: boolean; readOnly?: boolean }) { return <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span><input readOnly={readOnly} inputMode={numeric ? "decimal" : undefined} value={value} onChange={(e) => onChange?.(e.target.value)} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm font-semibold outline-none read-only:text-slate-400" /></label>; }
function formatDuration(s: number) { const n = Math.max(0, Math.round(s)); const h = Math.floor(n / 3600); const m = Math.floor((n % 3600) / 60); const sec = n % 60; return h ? h + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0") : m + ":" + String(sec).padStart(2, "0"); }
