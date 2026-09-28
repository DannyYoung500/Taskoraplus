import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, CheckCircle2, Sparkles, ShieldCheck, Wallet, Zap, PlayCircle, MapPin, Camera, Type, Link2, AlertTriangle } from "lucide-react";
import { PLATFORM_META, PLATFORM_ORDER, CATEGORY_LABELS, PlatformLogo, type Platform } from "@/components/PlatformIcon";
import { getDashboard } from "@/lib/taskora.functions";
import { createAdvertiseCampaign, listAdvertiseServices } from "@/lib/advertise.functions";
import { SERVICES, type ServiceDef } from "@/lib/advertise-services";
import { extractYoutubeId, youtubeWatchUrl } from "@/lib/youtube-url";
import { COUNTRIES, countryNameFromCode } from "@/lib/task-country";

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
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [targetCountryCode, setTargetCountryCode] = useState("");
  const [allowOtherCountriesIfUnavailable, setAllowOtherCountriesIfUnavailable] = useState(true);
  const youtubePlayerRef = useRef<any>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [warningText, setWarningText] = useState("");
  const [proofRequirements, setProofRequirements] = useState<string[]>(["screenshot"]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [screenshotsRequired, setScreenshotsRequired] = useState(1);
  const [featured, setFeatured] = useState(false);
  const [verificationMode, setVerificationMode] = useState<"automatic" | "screenshot">("automatic");
  /** Earnit-style wizard: 1 Platform · 2 Service · 3 Details · 4 Verification · 5 Quantity */
  const [step, setStep] = useState(1);

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
    setStep(3);
    setQty(s.minQty);
    setWatchMinutes(1);
    setWatchSeconds(0);
    setVideoDuration(null);
    setTargetCountryCode("");
    setAllowOtherCountriesIfUnavailable(true);
    setTitle(s.suggestedTitles[0] ?? s.title);
    setLink("");
    setDescription(`Complete this task: ${s.title}. Follow the steps carefully and submit clear proof.`);
    setInstructions(s.defaultSteps.join("\n"));
    setWarningText(s.defaultWarning ?? "");
    setProofRequirements(["screenshot"]);
    setDifficulty("easy");
    setScreenshotsRequired(1);
    setFeatured(false);
    setVerificationMode("automatic");
    setMsg(null);
  }

  const qtyNum = Math.max(1, Math.floor(Number(qty) || 1));
  const isWatch = service?.id === "yt_watch";
  const watchTotalSeconds = isWatch ? Math.max(1, Math.floor(watchMinutes) * 60 + Math.floor(watchSeconds)) : 0;
  const unitCustomer = service ? Number(service.fromUsd) * (isWatch ? watchTotalSeconds : 1) : 0;
  const total = unitCustomer * qtyNum;
  const insufficient = balance < total;
  const ytId = isWatch ? extractYoutubeId(link) : null;

  useEffect(() => {
    setVideoDuration(null);
    if (!ytId) return;
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const loadPlayer = () => {
      if (cancelled || !youtubeHostRef.current || !(window as any).YT?.Player) return;
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = new (window as any).YT.Player(youtubeHostRef.current, {
        videoId: ytId,
        playerVars: { playsinline: 1, rel: 0, enablejsapi: 1 },
        events: {
          onReady: (event: any) => {
            const readDuration = () => {
              const seconds = Math.floor(Number(event.target.getDuration?.() || 0));
              if (seconds > 0 && !cancelled) {
                setVideoDuration(seconds);
                setWatchMinutes((m) => Math.min(m, Math.floor(seconds / 60)));
                setWatchSeconds((s) => Math.min(s, seconds < 60 ? Math.max(0, seconds - 1) : 59));
                if (poll) clearInterval(poll);
              }
            };
            readDuration();
            poll = setInterval(readDuration, 500);
          },
        },
      });
    };
    const w = window as any;
    if (w.YT?.Player) {
      loadPlayer();
    } else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { previous?.(); loadPlayer(); };
      const wait = setInterval(() => { if (w.YT?.Player) { clearInterval(wait); loadPlayer(); } }, 250);
      setTimeout(() => clearInterval(wait), 10000);
    }
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [ytId]);

  const detectedMaxSeconds = videoDuration ? Math.min(videoDuration, 10800) : 10800;
  function setWatchDurationParts(minutes: number, seconds: number) {
    const totalSec = Math.max(1, Math.min(detectedMaxSeconds, Math.floor(minutes) * 60 + Math.floor(seconds)));
    setWatchMinutes(Math.floor(totalSec / 60));
    setWatchSeconds(totalSec % 60);
  }

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
    if (isWatch && (watchTotalSeconds < 1 || watchTotalSeconds > detectedMaxSeconds)) {
      setMsg("Watch time cannot be longer than the detected YouTube video duration.");
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
          videoDurationSeconds: isWatch ? videoDuration ?? undefined : undefined,
          videoSource: isWatch ? "external_url" : undefined,
          targetCountryCode: targetCountryCode || undefined,
          targetCountryName: targetCountryCode ? countryNameFromCode(targetCountryCode) : undefined,
          allowOtherCountriesIfUnavailable: targetCountryCode ? allowOtherCountriesIfUnavailable : true,
          description,
          instructions,
          warningText,
          proofRequirements,
          difficulty,
          screenshotsRequired,
          featured,
          verificationMode: (platform === "telegram" || platform === "discord") ? verificationMode : undefined,
        },
      });
      setMsg(`Campaign created · ${result.task.id.slice(0, 8)}… Waiting for activation.`);
      setService(null);
      setPlatform(null);
      setStep(1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create campaign.");
    } finally {
      setBusy(false);
    }
  }

  const stepLabels = ["Platform", "Service", "Details", "Verify", "Quantity"] as const;

  function StepBar({ current }: { current: number }) {
    return (
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = n === current;
            const done = n < current;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`flex size-7 items-center justify-center rounded-full text-[11px] font-black ${
                    done ? "bg-emerald-400 text-slate-950" : active ? "bg-sky-400 text-slate-950" : "bg-white/10 text-white/40"
                  }`}
                >
                  {done ? "✓" : n}
                </div>
                <span className={`text-[9px] font-bold ${active ? "text-sky-200" : done ? "text-emerald-300/80" : "text-white/30"}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all" style={{ width: `${((current - 1) / (stepLabels.length - 1)) * 100}%` }} />
        </div>
      </div>
    );
  }

  function goBack() {
    if (step === 5) setStep(4);
    else if (step === 4) setStep(3);
    else if (step === 3) { setService(null); setStep(2); }
    else if (step === 2) { setPlatform(null); setService(null); setStep(1); }
  }

  if (platform && service && step >= 3) {
    const meta = PLATFORM_META[platform];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <button type="button" onClick={goBack} className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50">
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <StepBar current={step} />
        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={48} />
            <div>
              <p className="text-sm font-bold">{service.title}</p>
              <p className="text-[11px] text-white/80">{service.desc}</p>
            </div>
          </div>
        </div>

        {step === 3 ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12141c] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">Step 3 · Campaign details</p>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Task title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={service.suggestedTitles[0] || service.title} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {service.suggestedTitles.map((t) => (
                  <button key={t} type="button" onClick={() => setTitle(t)} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] text-white/60">{t}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Description</label>
                <button type="button" onClick={() => setDescription(`Complete this ${meta.label} task: ${service.title}. Follow the steps carefully and submit clear proof.`)} className="text-[10px] font-bold text-emerald-400">✦ Template</button>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Describe what earners need to do…" className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Step-by-step instructions</label>
                <button type="button" onClick={() => setInstructions(service.defaultSteps.join("\n"))} className="text-[10px] font-bold text-emerald-400">✦ Default steps</button>
              </div>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5} placeholder={"1. Open the link\n2. Complete the action\n3. Take a screenshot\n4. Submit proof"} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-[12px] leading-relaxed outline-none focus:border-sky-400/40" />
              <p className="mt-1 text-[10px] text-white/35">One step per line — shown to earners like Earnit task cards.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Warning text</label>
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-2.5 size-3.5 shrink-0 text-amber-300" />
                <input value={warningText} onChange={(e) => setWarningText(e.target.value)} placeholder="Optional warning or important rule" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">{isWatch ? "YouTube video URL" : "Target URL"}</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={service.linkPlaceholder} inputMode="url" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40" />
            </div>
            {isWatch && ytId ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50"><PlayCircle className="size-3.5 text-red-400" /> YouTube preview</span>
                  <span className="text-[10px] text-emerald-300">Valid video URL</span>
                </div>
                <div className="aspect-video w-full bg-black"><div ref={youtubeHostRef} className="h-full w-full" /></div>
                <div className="flex items-center justify-between border-t border-white/8 px-3 py-2 text-[10px]">
                  <span className="text-white/40">Detected duration</span>
                  <span className="font-bold text-emerald-300">{videoDuration ? `${String(Math.floor(videoDuration / 60)).padStart(2, "0")}:${String(videoDuration % 60).padStart(2, "0")}` : "Reading…"}</span>
                </div>
              </div>
            ) : null}
            {msg ? <p className="text-xs text-amber-300">{msg}</p> : null}
            <button type="button" onClick={() => { if (!link.trim()) { setMsg(isWatch ? "Paste a YouTube video URL." : "Target URL is required."); return; } if (isWatch && !ytId) { setMsg("Paste a valid YouTube URL (youtube.com or youtu.be)."); return; } setMsg(null); setStep(4); }} className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3.5 text-sm font-black text-slate-950">Continue to verification →</button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12141c] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">Step 4 · Verification</p>
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" /><span className="text-xs font-semibold text-emerald-200">How earners prove this task</span></div>
              <p className="mt-1 text-[10px] leading-relaxed text-white/45">{isWatch ? "Watch time is verified automatically. Reward stays locked until qualifying playback is confirmed." : platform === "telegram" || platform === "discord" ? "Choose one method. Automatic and Screenshot are separate — Screenshot is never used as a soft fallback." : "Choose the proof your task requires. Screenshot submissions go to owner review."}</p>
            </div>
            {(platform === "telegram" || platform === "discord") && !isWatch ? (
              <div className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.05] p-3">
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-sky-200/70">Verification method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setVerificationMode("automatic"); setProofRequirements([]); setScreenshotsRequired(0); }} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${verificationMode === "automatic" ? "border-sky-300/60 bg-sky-300/15 text-sky-100" : "border-white/10 bg-black/20 text-white/45"}`}>Automatic</button>
                  <button type="button" onClick={() => { setVerificationMode("screenshot"); setProofRequirements(["screenshot"]); setScreenshotsRequired(1); }} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${verificationMode === "screenshot" ? "border-sky-300/60 bg-sky-300/15 text-sky-100" : "border-white/10 bg-black/20 text-white/45"}`}>Screenshot</button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-white/40">{verificationMode === "automatic" ? "Uses Telegram/Discord membership check. If it cannot run, the task stays unverified — it does not switch to screenshot." : "Users submit screenshot evidence; owner reviews. Automatic verification is not used for this campaign."}</p>
              </div>
            ) : null}
            {!isWatch && !(platform === "telegram" || platform === "discord") ? (
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Proof requirements</label>
                <div className="flex flex-wrap gap-2">
                  {([["screenshot", "Screenshot", Camera], ["text", "Text / Comment", Type], ["link", "Link / URL", Link2]] as const).map(([value, label, Icon]) => {
                    const checked = proofRequirements.includes(value);
                    return (
                      <button key={value} type="button" onClick={() => setProofRequirements((cur) => checked ? cur.filter((x) => x !== value) : [...cur, value])} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold ${checked ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/45"}`}>
                        <Icon className="size-3.5" />{label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {!isWatch ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Difficulty</label>
                  <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
                    {(["easy", "medium", "hard"] as const).map((level) => (
                      <button key={level} type="button" onClick={() => setDifficulty(level)} className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold capitalize ${difficulty === level ? "bg-emerald-400/20 text-emerald-200" : "text-white/35"}`}>{level}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Screenshots required</label>
                  <select value={screenshotsRequired} onChange={(e) => setScreenshotsRequired(Number(e.target.value))} disabled={!proofRequirements.includes("screenshot") && verificationMode !== "screenshot"} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none">
                    <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                  </select>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-sky-400/15 bg-sky-400/5 px-3 py-2.5 text-[11px] text-sky-100/80">Automatic watch verification — no screenshot needed.</p>
            )}
            <button type="button" onClick={() => setStep(5)} className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3.5 text-sm font-black text-slate-950">Continue to quantity →</button>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12141c] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">Step 5 · Quantity & pay</p>
            <div className="flex items-center justify-between text-xs text-white/45">
              <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {service.delivery} delivery</span>
              <span>{service.minQty.toLocaleString()} – {service.maxQty.toLocaleString()} {service.unit}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-sky-400/15 bg-sky-400/5 px-3 py-2.5">
              <span className="text-xs text-white/50">Unit price</span>
              <span className="text-sm font-extrabold text-sky-300">${service.fromUsd.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} / {service.unit.replace(/s$/, "")}</span>
            </div>
            {isWatch ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Required watch time</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-white/40">Minutes</span>
                    <input type="number" min={0} max={Math.floor(detectedMaxSeconds / 60)} value={watchMinutes} onChange={(e) => setWatchDurationParts(Number(e.target.value), watchSeconds)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40">Seconds</span>
                    <input type="number" min={0} max={59} value={watchSeconds} onChange={(e) => setWatchDurationParts(watchMinutes, Number(e.target.value))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none" />
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-white/35">Max detected: {videoDuration ? `${Math.floor(videoDuration / 60)}m ${videoDuration % 60}s` : "—"} · Pricing is per second × quantity</p>
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Quantity</label>
              <input type="number" min={service.minQty} max={service.maxQty} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {service.qtyChips.map((c) => (
                  <button key={c} type="button" onClick={() => setQty(c)} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${qty === c ? "border-sky-300/50 bg-sky-300/15 text-sky-100" : "border-white/10 text-white/50"}`}>{c.toLocaleString()}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40"><MapPin className="mr-1 inline size-3" /> Target country (optional)</label>
              <select value={targetCountryCode} onChange={(e) => setTargetCountryCode(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none">
                <option value="">Worldwide</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              {targetCountryCode ? (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                  <input type="checkbox" checked={allowOtherCountriesIfUnavailable} onChange={(e) => setAllowOtherCountriesIfUnavailable(e.target.checked)} />
                  Allow other countries if target is unavailable
                </label>
              ) : null}
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] text-white/60">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              Feature this campaign (+$5)
            </label>
            <div className="space-y-1.5 rounded-2xl border border-white/8 bg-black/25 p-3 text-[11px] text-white/55">
              <div className="flex justify-between"><span>Quantity</span><span className="text-white">{qtyNum.toLocaleString()} {service.unit}</span></div>
              {isWatch ? <div className="flex justify-between"><span>Watch time</span><span className="text-white">{watchTotalSeconds}s</span></div> : null}
              <div className="flex justify-between"><span>Verification</span><span className="text-white">{isWatch ? "Automatic watch" : (platform === "telegram" || platform === "discord" ? verificationMode : "Proof review")}</span></div>
              <div className="flex justify-between border-t border-white/8 pt-2 text-sm font-black text-white"><span>Total</span><span className={insufficient ? "text-amber-300" : "text-emerald-300"}>${total.toFixed(2)}</span></div>
              <div className="flex justify-between text-[10px]"><span>Your balance</span><span>${balance.toFixed(2)}</span></div>
            </div>
            {msg ? <p className="text-xs text-amber-300">{msg}</p> : null}
            <button type="button" disabled={busy || insufficient} onClick={() => void publish()} className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-400 py-3.5 text-sm font-black text-slate-950 disabled:opacity-40">
              {busy ? "Publishing…" : insufficient ? "Insufficient balance" : "Publish campaign"}
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  if (platform && step >= 2) {
    const meta = PLATFORM_META[platform];
    const list = SERVICES[platform] ?? [];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <button type="button" onClick={goBack} className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50">
          <ArrowLeft className="size-3.5" /> All Platforms
        </button>
        <StepBar current={2} />
        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={52} />
            <div>
              <p className="text-base font-bold">{meta.label} Services</p>
              <p className="text-[11px] text-white/85">{meta.blurb}</p>
            </div>
          </div>
        </div>
        <p className="mb-3 text-xs text-white/45">Step 2 · Select a service to grow your {meta.label} presence</p>
        <div className="space-y-2.5">
          {list.map((raw) => {
            const s = priced(raw);
            return (
              <button key={s.id} type="button" onClick={() => openService(s)} className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.99]">
                <PlatformLogo platform={platform} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">{s.desc}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-bold text-sky-300">From ${s.fromUsd.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}</span>
                    <span className="text-white/35">·</span>
                    <span className="text-white/45">{s.minQty.toLocaleString()} – {s.maxQty.toLocaleString()} {s.unit}</span>
                    <span className="text-white/35">·</span>
                    <span className="inline-flex items-center gap-1 text-white/45"><Clock className="size-3" /> {s.delivery}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4">
        <h1 className="text-xl font-black tracking-tight">Advertise</h1>
        <p className="text-[11px] text-white/45">Earnit-style · 5 steps · catalog-locked pricing</p>
      </div>
      <StepBar current={1} />
      <section className="mb-5 rounded-3xl border border-white/10 bg-[#10141d] p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10">
            <Zap className="size-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-base font-bold">Create a campaign in 5 steps</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              1 Platform → 2 Service → 3 Details (title, steps, link) → 4 Verification → 5 Quantity & pay.
              Default steps are prefilled for each service. Telegram/Discord: pick Automatic or Screenshot — no soft fallback.
            </p>
          </div>
        </div>
      </section>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold">Step 1 · Choose platform</p>
        <span className="text-[10px] text-white/40">Balance ${balance.toFixed(2)}</span>
      </div>
      {[...grouped.entries()].map(([cat, platforms]) => (
        <section key={cat} className="mb-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {platforms.map((p) => {
              const m = PLATFORM_META[p];
              return (
                <button key={p} type="button" onClick={() => { setPlatform(p); setStep(2); setMsg(null); }} className="flex flex-col items-start rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.98]">
                  <PlatformLogo platform={p} size={48} />
                  <p className="mt-3 text-sm font-bold">{m.label}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/40">{m.blurb}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
