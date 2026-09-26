import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Clock, CheckCircle2, Sparkles, AlertTriangle, Rocket, ShieldCheck } from "lucide-react";
import { PLATFORM_META, PLATFORM_ORDER, CATEGORY_LABELS, PlatformLogo, type Platform } from "@/components/PlatformIcon";
import { getDashboard } from "@/lib/taskora.functions";
import { createAdvertiseCampaign, listAdvertiseServices } from "@/lib/advertise.functions";
import { TASKORA_LOGO, COLORS } from "@/lib/brand";
import { SERVICES, QTY_UNIT_LABEL, type ServiceDef } from "@/lib/advertise-services";
import { extractYoutubeId, youtubeEmbedSrc, youtubeWatchUrl } from "@/lib/youtube-url";

export const Route = createFileRoute("/_authenticated/advertise")({
  head: () => ({ meta: [{ title: "Advertise — TASKORA" }] }),
  loader: async () => {
    const [dashResult, servicesResult] = await Promise.allSettled([getDashboard(), listAdvertiseServices()]);
    return {
      balance: dashResult.status === "fulfilled" ? Number(dashResult.value?.balance ?? 0) : 0,
      catalog: servicesResult.status === "fulfilled" ? servicesResult.value : [],
    };
  },
  component: AdvertisePage,
});

function AdvertisePage() {
  const { balance, catalog } = Route.useLoaderData();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [service, setService] = useState<ServiceDef | null>(null);
  const [link, setLink] = useState("");
  const [qty, setQty] = useState(50);
  const [watchMinutes, setWatchMinutes] = useState(1);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Platform[]>();
    for (const p of PLATFORM_ORDER) {
      const cat = PLATFORM_META[p].category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, []);

  function getCatalogPrice(s: ServiceDef) {
    const row = (catalog as Array<Record<string, unknown>>).find((x) => String(x.service_id) === s.id);
    if (!row) return s;
    return {
      ...s,
      fromUsd: Number(row.customer_unit_price ?? s.fromUsd),
      taskerUsd: Number(row.tasker_unit_reward ?? s.taskerUsd),
      taskoraUsd: Number(row.taskora_unit_margin ?? s.taskoraUsd),
      minQty: Number(row.min_quantity ?? s.minQty),
      maxQty: Number(row.max_quantity ?? s.maxQty),
    };
  }

  function formatUsd(value: number) {
    if (Math.abs(value) < 0.01 && value !== 0) return `${value.toFixed(6)}`;
    return `${value.toFixed(2)}`;
  }

  function openService(raw: ServiceDef) {
    const s = getCatalogPrice(raw);
    setService(s);
    setQty(s.minQty);
    setWatchMinutes(1);
    setWatchSeconds(0);
    setTitle("");
    setLink("");
    setMsg(null);
  }

  const qtyNum = Math.max(1, Number(qty) || 1);
  const isWatchService = service?.id === "yt_watch";
  const requiredWatchSeconds = isWatchService ? Math.max(1, watchMinutes * 60 + watchSeconds) : 0;
  const rewardNum = service ? Number(service.taskerUsd) * (isWatchService ? requiredWatchSeconds : 1) : 0;
  const advertiserPerCompletion = service ? Number(service.fromUsd) * (isWatchService ? requiredWatchSeconds : 1) : 0;
  const taskoraPerCompletion = service ? Number(service.taskoraUsd) * (isWatchService ? requiredWatchSeconds : 1) : 0;
  const total = advertiserPerCompletion * qtyNum;
  const insufficient = balance < total;
  const ytId = isWatchService ? extractYoutubeId(link) : null;

  async function placeOrder() {
    if (!platform || !service) return;
    if (!link.trim()) {
      setMsg(isWatchService ? "Paste a YouTube video URL." : "Target URL is required.");
      return;
    }
    if (isWatchService && !ytId) {
      setMsg("Paste a valid YouTube URL (youtube.com or youtu.be). Link only — no upload.");
      return;
    }
    if (!isWatchService && !title.trim()) {
      setMsg("Task title is required.");
      return;
    }
    if (qtyNum < service.minQty || qtyNum > service.maxQty) {
      setMsg(`Quantity must be between ${service.minQty} and ${service.maxQty}.`);
      return;
    }
    if (isWatchService && (requiredWatchSeconds < 1 || requiredWatchSeconds > 28800)) {
      setMsg("Watch time must be between 00:01 and 480:00 (8 hours).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const finalLink = ytId ? youtubeWatchUrl(ytId) : link.trim();
      const result = await createAdvertiseCampaign({
        data: {
          serviceId: service.id,
          title: isWatchService ? undefined : title.trim(),
          link: finalLink,
          quantity: qtyNum,
          watchSeconds: isWatchService ? requiredWatchSeconds : undefined,
          videoSource: isWatchService ? "external_url" : undefined,
        },
      });
      setMsg(`Campaign created · ${result.task.id.slice(0, 8)}… Waiting for activation.`);
      setService(null);
      setPlatform(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  if (platform && service) {
    const meta = PLATFORM_META[platform];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-32 pt-4 text-white" style={{ background: COLORS.bg }}>
        <button type="button" onClick={() => setService(null)} className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50">
          <ArrowLeft className="size-3.5" /> Back to Services
        </button>
        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={36} />
            <div>
              <p className="text-base font-bold">{service.title}</p>
              <p className="text-[11px] text-white/90">{service.desc}</p>
            </div>
          </div>
        </div>

        {isWatchService ? (
          <div className="mb-3 space-y-3 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
            <p className="text-sm font-black text-blue-100">Your YouTube video</p>
            <p className="text-[10px] text-blue-100/60">Paste a YouTube link only — no upload.</p>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm outline-none" />
            <div className="overflow-hidden rounded-xl border border-blue-400/20 bg-black/40">
              <p className="border-b border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-blue-200/70">Live preview</p>
              {ytId ? (
                <div className="relative aspect-video w-full bg-black">
                  <iframe title="YouTube preview" src={youtubeEmbedSrc(ytId)} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              ) : (
                <p className="px-3 py-8 text-center text-[12px] text-white/35">Paste youtube.com or youtu.be to preview</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-xl border border-white/10 bg-black/20 p-3">
                <span className="text-[10px] text-slate-500">Minutes (max 480)</span>
                <input type="number" min={0} max={480} value={watchMinutes} onChange={(e) => setWatchMinutes(Math.max(0, Math.min(480, Number(e.target.value) || 0)))} className="mt-1 w-full bg-transparent text-lg font-black outline-none" />
              </label>
              <label className="rounded-xl border border-white/10 bg-black/20 p-3">
                <span className="text-[10px] text-slate-500">Seconds</span>
                <input type="number" min={0} max={59} value={watchSeconds} onChange={(e) => setWatchSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} className="mt-1 w-full bg-transparent text-lg font-black outline-none" />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[[0,30],[1,0],[2,0],[5,0],[10,0],[15,0],[30,0],[60,0],[120,0],[180,0],[240,0],[360,0],[480,0]].map(([m,s]) => (
                <button key={`${m}:${s}`} type="button" onClick={() => { setWatchMinutes(m); setWatchSeconds(s); }} className="rounded-lg border border-blue-400/15 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-blue-100">
                  {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
                </button>
              ))}
            </div>
            <p className="text-center text-lg font-black text-blue-200">{String(Math.floor(requiredWatchSeconds / 60)).padStart(2,"0")}:{String(requiredWatchSeconds % 60).padStart(2,"0")}</p>
            <input value={String(qty)} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} inputMode="numeric" placeholder="Completions" className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm outline-none" />
            <div className="rounded-xl border border-blue-400/15 bg-black/15 p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-white/50">Advertiser / completion</span><b>${formatUsd(advertiserPerCompletion)}</b></div>
              <div className="flex justify-between"><span className="text-white/50">Worker (70%)</span><b className="text-blue-200">${formatUsd(rewardNum)}</b></div>
              <div className="flex justify-between"><span className="text-white/50">Taskora (30%)</span><b>${formatUsd(taskoraPerCompletion)}</b></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span>Total × {qtyNum}</span><b className="text-lg text-blue-200">${formatUsd(total)}</b></div>
            </div>
          </div>
        ) : (
          <section className="mb-3 space-y-3 rounded-2xl border p-4" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={service.linkPlaceholder} className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none" />
            <input value={String(qty)} onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))} inputMode="numeric" className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none" />
            <div className="flex flex-wrap gap-1.5">
              {service.qtyChips.map((c) => (
                <button key={c} type="button" onClick={() => setQty(c)} className={`rounded-lg px-3 py-2 text-xs font-bold ${qty === c ? "bg-emerald-500 text-white" : "border border-white/10 text-white/60"}`}>{c.toLocaleString()}</button>
              ))}
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-white/50">Worker reward</span><span>${formatUsd(rewardNum)}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span className="text-blue-200">${formatUsd(total)}</span></div>
            </div>
          </section>
        )}

        {insufficient ? <p className="mb-2 text-xs text-red-300">Wallet ${balance.toFixed(2)} insufficient</p> : null}
        <button type="button" disabled={busy || insufficient} onClick={() => void placeOrder()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3.5 text-sm font-bold text-white disabled:opacity-40">
          <Rocket className="size-4" />{busy ? "Placing…" : `Place Order · $${total.toFixed(2)}`}
        </button>
        {msg ? <p className="mt-2 text-center text-xs text-amber-200/90">{msg}</p> : null}
      </main>
    );
  }

  if (platform) {
    const meta = PLATFORM_META[platform];
    const list = SERVICES[platform] ?? [];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5 text-white" style={{ background: COLORS.bg }}>
        <button type="button" onClick={() => setPlatform(null)} className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"><ArrowLeft className="size-3.5" /> All Platforms</button>
        <div className={`mb-4 rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={40} />
            <div><p className="font-bold">{meta.label} Services</p><p className="text-[11px] text-white/90">{meta.blurb}</p></div>
          </div>
        </div>
        <div className="space-y-2.5">
          {list.map((s) => (
            <button key={s.id} type="button" onClick={() => openService(s)} className="flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
              <PlatformLogo platform={platform} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-[11px] text-white/45">{s.desc}</p>
                <p className="mt-1 text-[11px] font-bold text-emerald-300">{s.id === "yt_watch" ? `${formatUsd(s.fromUsd)} / second` : `${formatUsd(s.fromUsd)} / unit`}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5 text-white" style={{ background: COLORS.bg }}>
      <div className="mb-5 rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-5">
        <img src={TASKORA_LOGO} alt="TASKORA" className="size-11 rounded-xl object-cover" />
        <h1 className="mt-3 text-2xl font-extrabold">Grow with TASKORA</h1>
        <p className="mt-1.5 text-sm text-white/90">Real engagement. Platform-matched tasks only.</p>
      </div>
      <h2 className="text-lg font-bold">Choose a platform</h2>
      {[...grouped.entries()].map(([cat, platforms]) => (
        <section key={cat} className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {platforms.map((p) => {
              const m = PLATFORM_META[p];
              return (
                <button key={p} type="button" onClick={() => setPlatform(p)} className="rounded-2xl border p-3.5 text-left" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
                  <PlatformLogo platform={p} size={48} />
                  <p className="mt-3 text-sm font-bold">{m.label}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {msg ? <p className="mt-4 text-xs text-amber-200">{msg}</p> : null}
    </main>
  );
}
