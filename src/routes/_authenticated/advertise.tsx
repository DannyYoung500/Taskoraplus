import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Clock, CheckCircle2, Sparkles, ShieldCheck, Wallet, Zap } from "lucide-react";
import { PLATFORM_META, PLATFORM_ORDER, CATEGORY_LABELS, PlatformLogo, type Platform } from "@/components/PlatformIcon";
import { getDashboard } from "@/lib/taskora.functions";
import { createAdvertiseCampaign, listAdvertiseServices } from "@/lib/advertise.functions";
import { SERVICES, type ServiceDef } from "@/lib/advertise-services";
import { extractYoutubeId, youtubeWatchUrl } from "@/lib/youtube-url";

export const Route = createFileRoute("/_authenticated/advertise")({
  head: () => ({ meta: [{ title: "Advertise — TASKORA" }] }),
  loader: async () => {
    const [dashResult, catalogResult] = await Promise.allSettled([getDashboard(), listAdvertiseServices()]);
    return {
      balance: dashResult.status === "fulfilled" ? Number(dashResult.value?.balance ?? 0) : 0,
      catalog: catalogResult.status === "fulfilled" ? catalogResult.value : [],
    };
  },
  component: AdvertisePage,
});

function AdvertisePage() {
  const { balance, catalog } = Route.useLoaderData();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [service, setService] = useState<ServiceDef | null>(null);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [qty, setQty] = useState(100);
  const [watchMinutes, setWatchMinutes] = useState(1);
  const [watchSeconds, setWatchSeconds] = useState(0);
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

  function priced(raw: ServiceDef): ServiceDef {
    const row = (catalog as Array<Record<string, unknown>>).find((x) => String(x.service_id) === raw.id);
    if (!row) return raw;
    return {
      ...raw,
      fromUsd: Number(row.customer_unit_price ?? raw.fromUsd),
      taskerUsd: Number(row.tasker_unit_reward ?? raw.taskerUsd),
      taskoraUsd: Number(row.taskora_unit_margin ?? raw.taskoraUsd),
      minQty: Number(row.min_quantity ?? raw.minQty),
      maxQty: Number(row.max_quantity ?? raw.maxQty),
    };
  }

  function openService(raw: ServiceDef) {
    const s = priced(raw);
    setService(s);
    setQty(s.minQty);
    setWatchMinutes(1);
    setWatchSeconds(0);
    setTitle("");
    setLink("");
    setMsg(null);
  }

  const qtyNum = Math.max(1, Math.floor(Number(qty) || 1));
  const isWatch = service?.id === "yt_watch";
  const watchTotalSeconds = isWatch ? Math.max(1, watchMinutes * 60 + watchSeconds) : 0;
  const unitCustomer = service ? Number(service.fromUsd) * (isWatch ? watchTotalSeconds : 1) : 0;
  const total = unitCustomer * qtyNum;
  const insufficient = balance < total;
  const ytId = isWatch ? extractYoutubeId(link) : null;

  async function publish() {
    if (!platform || !service) return;
    if (!link.trim()) {
      setMsg(isWatch ? "Paste a YouTube video URL." : "Target URL is required.");
      return;
    }
    if (isWatch && !ytId) {
      setMsg("Paste a valid YouTube URL (youtube.com or youtu.be).");
      return;
    }
    if (qtyNum < service.minQty || qtyNum > service.maxQty) {
      setMsg(`Quantity must be between ${service.minQty.toLocaleString()} and ${service.maxQty.toLocaleString()}.`);
      return;
    }
    if (isWatch && (watchTotalSeconds < 1 || watchTotalSeconds > 28800)) {
      setMsg("Watch time must be between 00:01 and 480:00.");
      return;
    }
    if (insufficient) {
      setMsg(`Insufficient balance. You need $${total.toFixed(2)} and have $${balance.toFixed(2)}.`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const result = await createAdvertiseCampaign({
        data: {
          serviceId: service.id,
          title: isWatch ? undefined : (title.trim() || service.title),
          link: ytId ? youtubeWatchUrl(ytId) : link.trim(),
          quantity: qtyNum,
          watchSeconds: isWatch ? watchTotalSeconds : undefined,
          videoSource: isWatch ? "external_url" : undefined,
        },
      });
      setMsg(`Campaign created · ${result.task.id.slice(0, 8)}… Waiting for activation.`);
      setService(null);
      setPlatform(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create campaign.");
    } finally {
      setBusy(false);
    }
  }

  if (platform && service) {
    const meta = PLATFORM_META[platform];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <button type="button" onClick={() => setService(null)} className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50">
          <ArrowLeft className="size-3.5" /> Back to {meta.label}
        </button>
        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={48} />
            <div><p className="text-sm font-bold">{service.title}</p><p className="text-[11px] text-white/80">{service.desc}</p></div>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12141c] p-4">
          <div className="flex items-center justify-between text-xs text-white/45">
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {service.delivery} delivery</span>
            <span>{service.minQty.toLocaleString()} – {service.maxQty.toLocaleString()} {service.unit}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-sky-400/15 bg-sky-400/5 px-3 py-2.5">
            <span className="text-xs text-white/50">Price</span>
            <span className="text-sm font-extrabold text-sky-300">${service.fromUsd.toFixed(6).replace(/0+$/,"").replace(/\.$/,"")} / {service.unit.replace(/s$/,"")}</span>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign title (optional)" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40" />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={service.linkPlaceholder} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40" />
          {isWatch ? (
            <div className="grid grid-cols-2 gap-2">
              <input value={watchMinutes} onChange={(e) => setWatchMinutes(Math.max(0, Number(e.target.value) || 0))} type="number" min={0} max={480} placeholder="Minutes" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none" />
              <input value={watchSeconds} onChange={(e) => setWatchSeconds(Math.min(59, Math.max(0, Number(e.target.value) || 0)))} type="number" min={0} max={59} placeholder="Seconds" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none" />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Quantity</label>
              <input value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} type="number" min={service.minQty} max={service.maxQty} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none" />
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2.5 text-xs">
            <span className="text-white/45 inline-flex items-center gap-1"><Wallet className="size-3.5" /> Wallet balance</span>
            <span className={insufficient ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>${balance.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 pt-3">
            <span className="text-sm font-semibold">Campaign total</span>
            <span className="text-lg font-extrabold text-sky-300">${total.toFixed(6).replace(/0+$/,"").replace(/\.$/,"")}</span>
          </div>
          <button type="button" disabled={busy || insufficient} onClick={() => void publish()} className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 py-3.5 text-sm font-bold text-[#0a0c12] disabled:opacity-50">
            {busy ? "Creating…" : insufficient ? "Insufficient balance" : "Create campaign"}
          </button>
          {msg ? <p className="text-center text-xs text-amber-200/90">{msg}</p> : null}
        </div>
      </main>
    );
  }

  if (platform) {
    const meta = PLATFORM_META[platform];
    const list = SERVICES[platform] ?? [];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <button type="button" onClick={() => setPlatform(null)} className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"><ArrowLeft className="size-3.5" /> All Platforms</button>
        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3"><PlatformLogo platform={platform} size={52} /><div><p className="text-base font-bold">{meta.label} Services</p><p className="text-[11px] text-white/85">{meta.blurb}</p></div></div>
        </div>
        <p className="mb-3 text-xs text-white/45">Select a service to grow your {meta.label} presence</p>
        <div className="space-y-2.5">
          {list.map((raw) => { const s = priced(raw); return (
            <button key={s.id} type="button" onClick={() => openService(s)} className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.99]">
              <PlatformLogo platform={platform} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.title}</p><p className="mt-0.5 text-[11px] text-white/45">{s.desc}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-bold text-sky-300">From ${s.fromUsd.toFixed(6).replace(/0+$/,"").replace(/\.$/,"")}</span><span className="text-white/35">·</span><span className="text-white/45">{s.minQty.toLocaleString()} – {s.maxQty.toLocaleString()} {s.unit}</span><span className="text-white/35">·</span><span className="inline-flex items-center gap-1 text-white/45"><Clock className="size-3" /> {s.delivery}</span>
                </div>
              </div>
            </button>
          ); })}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-5 shadow-lg">
        <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 left-10 size-24 rounded-full bg-white/10" />
        <p className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white"><CheckCircle2 className="size-3" /> 100% real engagement</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Organic Boost</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-white/90">Real engagement from active TASKORA members. Genuine followers, likes and comments from real people.</p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/80"><Sparkles className="size-3.5" /> Powered by verified taskers</p>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-lg font-bold">Choose a platform</h2><p className="mt-0.5 text-xs text-white/45">Pick the service you want to promote</p></div>
        <div className="rounded-xl border border-sky-400/15 bg-sky-400/5 px-2.5 py-2 text-right"><p className="text-[9px] uppercase tracking-wider text-white/35">Wallet</p><p className="text-sm font-extrabold text-sky-300">${balance.toFixed(2)}</p></div>
      </div>
      {[...grouped.entries()].map(([cat, platforms]) => (
        <section key={cat} className="mt-5">
          <div className="mb-2.5 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</p><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">{platforms.length}</span></div>
          <div className="grid grid-cols-2 gap-2.5">
            {platforms.map((p) => { const m = PLATFORM_META[p]; return (
              <button key={p} type="button" onClick={() => { setPlatform(p); setMsg(null); }} className="flex flex-col items-start rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.98]">
                <PlatformLogo platform={p} size={48} /><p className="mt-3 text-sm font-bold">{m.label}</p><p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/40">{m.blurb}</p>
                <span className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: m.color, backgroundColor: `${m.color}18` }}>{m.services} services</span>
              </button>
            ); })}
          </div>
        </section>
      ))}
      {msg ? <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">{msg}</p> : null}
      <div className="mt-6 flex items-center justify-center gap-3 text-[10px] text-white/35"><ShieldCheck className="size-3.5" /> Verified pricing <span>•</span><Zap className="size-3.5" /> Secure campaign creation</div>
    </main>
  );
}
