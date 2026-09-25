import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import {
  PLATFORM_META,
  PLATFORM_ORDER,
  CATEGORY_LABELS,
  PlatformLogo,
  type Platform,
} from "@/components/PlatformIcon";
import { getDashboard } from "@/lib/taskora.functions";
import { createAdvertiseCampaign, listAdvertiseServices } from "@/lib/advertise.functions";
import { supabase } from "@/integrations/supabase/client";
import { TASKORA_LOGO, COLORS } from "@/lib/brand";
import {
  SERVICES,
  PLATFORM_FEE,
  FEATURE_FEE_USD,
  QTY_UNIT_LABEL,
  type ServiceDef,
} from "@/lib/advertise-services";

export const Route = createFileRoute("/_authenticated/advertise")({
  head: () => ({ meta: [{ title: "Advertise \u2014 TASKORA" }] }),
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
  const [videoMode, setVideoMode] = useState<"upload" | "url">("upload");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [warning, setWarning] = useState("");
  const [featured, setFeatured] = useState(false);
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
    setVideoMode("upload");
    setVideoFile(null);
    setTitle("");
    setInstructions(s.defaultSteps.join("\n"));
    setWarning(s.defaultWarning);
    setLink("");
    setFeatured(false);
    setMsg(null);
  }

  function applyTitleTemplate(t: string) {
    setTitle(t);
  }

  function applyInstrTemplate() {
    if (!service) return;
    setInstructions(service.defaultSteps.join("\n"));
  }

  const qtyNum = Math.max(1, Number(qty) || 1);
  const isWatchService = service?.id === "yt_watch";
  const requiredWatchSeconds = isWatchService ? Math.max(1, watchMinutes * 60 + watchSeconds) : 0;
  const rewardNum = service ? Number(service.taskerUsd) * (isWatchService ? requiredWatchSeconds : 1) : 0;
  const advertiserPerCompletion = service ? Number(service.fromUsd) * (isWatchService ? requiredWatchSeconds : 1) : 0;
  const taskoraPerCompletion = service ? Number(service.taskoraUsd) * (isWatchService ? requiredWatchSeconds : 1) : 0;
  const earnerPayouts = rewardNum * qtyNum;
  const platformFee = taskoraPerCompletion * qtyNum;
  const total = advertiserPerCompletion * qtyNum;
  const insufficient = balance < total;

  async function uploadWatchVideo() {
    if (!videoFile) return null;
    if (!videoFile.type.startsWith("video/")) throw new Error("Please choose a video file.");
    if (videoFile.size > 500 * 1024 * 1024) throw new Error("Video must be 500 MB or smaller.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Your session expired. Please sign in again.");
    const ext = (videoFile.name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
    const path = user.id + "/" + crypto.randomUUID() + "." + ext;
    const { error } = await supabase.storage.from("taskora-videos").upload(path, videoFile, { contentType: videoFile.type, upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from("taskora-videos").getPublicUrl(path).data.publicUrl;
  }

  async function placeOrder() {
    if (!platform || !service) return;
    if (isWatchService && videoMode === "upload" && !videoFile) { setMsg("Upload the video you want to put into Taskora."); return; }
    if (isWatchService && videoMode === "url" && !link.trim()) { setMsg("Enter the video URL."); return; }
    if (!isWatchService && !link.trim()) { setMsg("Target URL is required."); return; }
    if (!isWatchService && !title.trim()) { setMsg("Task title is required."); return; }
    if (qtyNum < service.minQty || qtyNum > service.maxQty) { setMsg(`Quantity must be between ${service.minQty} and ${service.maxQty}.`); return; }
    if (isWatchService && (requiredWatchSeconds < 1 || requiredWatchSeconds > 7200)) { setMsg("Watch time must be between 00:01 and 120:00."); return; }
    setBusy(true); setMsg(null);
    try {
      const finalLink = isWatchService && videoMode === "upload" ? await uploadWatchVideo() : link.trim();
      if (!finalLink) throw new Error("Video could not be uploaded.");
      const result = await createAdvertiseCampaign({ data: {
        serviceId: service.id,
        title: isWatchService ? undefined : title.trim(),
        link: finalLink,
        quantity: qtyNum,
        watchSeconds: isWatchService ? requiredWatchSeconds : undefined,
        videoSource: isWatchService ? (videoMode === "upload" ? "taskora_upload" : "external_url") : undefined,
      }});
      setMsg(`Campaign created · ${result.task.id.slice(0, 8)}… Waiting for activation.`);
      setService(null); setPlatform(null);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Order failed"); }
    finally { setBusy(false); }
  }

  if (platform && service) {
    const meta = PLATFORM_META[platform];
    const unitLabel = QTY_UNIT_LABEL[service.unit] || service.unit;
    const singularUnit = unitLabel.endsWith("s") ? unitLabel.slice(0, -1) : unitLabel;

    return (
      <main
        className="mx-auto min-h-screen w-full max-w-md px-4 pb-32 pt-4 text-white"
        style={{ background: COLORS.bg }}
      >
        <button
          type="button"
          onClick={() => setService(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"
        >
          <ArrowLeft className="size-3.5" /> Back to Services
        </button>

        <div
          className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4 shadow-lg shadow-black/30`}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-black/25 backdrop-blur-sm">
              <PlatformLogo platform={platform} size={36} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-tight">{service.title}</p>
              <p className="mt-0.5 text-[11px] text-white/90">{service.desc}</p>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-300" />
          <p className="text-[11px] leading-snug text-sky-100/90">
            <span className="font-semibold">{meta.label} only.</span> Earners complete this action on{" "}
            {meta.label} \u2014 never cross-platform spam.
          </p>
        </div>

        <section
          className="mb-3 space-y-3 rounded-2xl border p-4"
          style={{ background: COLORS.surface, borderColor: COLORS.border }}
        >
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
              {meta.label} target URL
            </label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={service.linkPlaceholder}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
              {isWatchService ? "Number of completions" : `Quantity (${unitLabel})`}
            </label>
            <input
              value={String(qty)}
              onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
              inputMode="numeric"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/20"
            />
            <p className="mt-1.5 text-[10px] text-white/35">
              Min: {service.minQty} \u00b7 Max: {service.maxQty.toLocaleString()}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {service.qtyChips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setQty(c)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
                    qty === c
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                      : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                  }`}
                >
                  {c.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {service.id === "yt_watch" ? (
            <div className="space-y-3 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
              <div>
                <p className="text-sm font-black text-blue-100">Your video</p>
                <p className="mt-1 text-[10px] text-blue-100/60">Post your own video to Taskora or provide a video URL.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setVideoMode("upload")} className={`rounded-xl border px-3 py-3 text-xs font-bold ${videoMode === "upload" ? "border-blue-400/50 bg-blue-500/20 text-blue-100" : "border-white/10 bg-black/20 text-white/60"}`}>Upload video</button>
                <button type="button" onClick={() => setVideoMode("url")} className={`rounded-xl border px-3 py-3 text-xs font-bold ${videoMode === "url" ? "border-blue-400/50 bg-blue-500/20 text-blue-100" : "border-white/10 bg-black/20 text-white/60"}`}>Video URL</button>
              </div>
              {videoMode === "upload" ? (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-blue-400/30 bg-black/20 p-4">
                  <Upload className="size-5 text-blue-300" />
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{videoFile?.name || "Choose your video"}</p><p className="text-[10px] text-slate-500">MP4/WebM/MOV · max 500 MB</p></div>
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                </label>
              ) : <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… video URL" className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm outline-none focus:border-blue-400/50" />}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-blue-100">Required watch time</label>
                <p className="mb-2 text-[10px] text-blue-100/60">Minutes and seconds are converted to total seconds automatically.</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-[10px] text-slate-500">Minutes</span><input type="number" min={0} max={120} value={watchMinutes} onChange={(e) => setWatchMinutes(Math.max(0, Math.min(120, Number(e.target.value) || 0)))} className="mt-1 w-full bg-transparent text-lg font-black outline-none" /></label>
                  <label className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-[10px] text-slate-500">Seconds</span><input type="number" min={0} max={59} value={watchSeconds} onChange={(e) => setWatchSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} className="mt-1 w-full bg-transparent text-lg font-black outline-none" /></label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">{[[0,30],[1,0],[2,0],[5,0],[10,0],[30,0],[60,0],[120,0]].map(([m,s]) => <button key={m+":"+s} type="button" onClick={() => {setWatchMinutes(m);setWatchSeconds(s);}} className="rounded-lg border border-blue-400/15 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-blue-100">{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</button>)}</div>
                <p className="mt-2 text-center text-lg font-black text-blue-200">{String(Math.floor(requiredWatchSeconds / 60)).padStart(2,"0")}:{String(requiredWatchSeconds % 60).padStart(2,"0")}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-blue-100">Number of completions</label>
                <input value={String(qty)} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} inputMode="numeric" className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm outline-none" />
              </div>
              <div className="rounded-xl border border-blue-400/15 bg-black/15 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/60">Locked pricing</p>
                <div className="mt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-white/50">Advertiser / completion</span><b>${formatUsd(advertiserPerCompletion)}</b></div>
                  <div className="flex justify-between"><span className="text-white/50">User reward / completion</span><b className="text-blue-200">${formatUsd(rewardNum)}</b></div>
                  <div className="flex justify-between"><span className="text-white/50">Taskora fee / completion</span><b>${formatUsd(taskoraPerCompletion)}</b></div>
                  <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-white/50">Total campaign</span><b className="text-lg text-blue-200">${formatUsd(total)}</b></div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-blue-100/60">70% is locked as the worker reward and 30% is Taskora's fee. The user reward does not change after publication.</p>
              </div>
              <p className="rounded-xl border border-blue-400/15 bg-blue-500/5 p-2.5 text-[10px] text-blue-100/70">Verification: automatic watch-time verification. No screenshot for Watch.</p>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
              Notes <span className="font-normal text-white/30">(optional)</span>
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions\u2026"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50"
            />
          </div>
        </section>

        <section
          className="mb-3 space-y-4 rounded-2xl border p-4"
          style={{ background: COLORS.surface, borderColor: COLORS.border }}
        >
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-sky-500/15">
              <Sparkles className="size-3.5 text-sky-300" />
            </div>
            <p className="text-[12px] font-bold tracking-wide text-sky-200">Task details</p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-white/55">
              Task title <span className="text-red-400">*</span>
            </label>
            <p className="mb-1.5 text-[10px] text-white/35">Suggested titles</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {service.suggestedTitles.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyTitleTemplate(t)}
                  className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition ${
                    title === t
                      ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                      : "border-white/10 bg-white/[0.04] text-white/65"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g. ${service.suggestedTitles[0]}`}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-semibold text-white/55">
                Instructions <span className="font-normal text-white/30">(optional)</span>
              </label>
              <button type="button" onClick={applyInstrTemplate} className="text-[10px] font-bold text-emerald-400">
                \u2726 Use a template
              </button>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder={"1. Visit the link\n2. Complete the action\n3. Take a screenshot\n4. Submit proof"}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 font-mono text-[12px] leading-relaxed outline-none transition focus:border-sky-400/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
              Warning text <span className="font-normal text-white/30">(optional)</span>
            </label>
            <input
              value={warning}
              onChange={(e) => setWarning(e.target.value)}
              placeholder="e.g. Do not unfollow after submitting"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold text-white/55">Verification</p>
            <p className="mt-1 text-[11px] leading-snug text-white/45">
              {platform === "telegram" || platform === "discord" ? "Automatic verification with screenshot fallback." : "Screenshot verification is required and reviewed before reward release."}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold text-white/55">Verification</p>
            <p className="mt-1 text-[11px] leading-snug text-white/45">
              {service.id === "yt_watch" || platform === "telegram" || platform === "discord"
                ? "Automatically verified by Taskora. No screenshot is required."
                : "Screenshot verification is required and reviewed before reward release."}
            </p>
          </div>
        </section>

        <label
          className={`mb-3 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
            featured ? "border-amber-400/40 bg-amber-400/10" : "border-amber-400/20 bg-amber-400/[0.04]"
          }`}
        >
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="mt-0.5 size-4 accent-amber-400"
          />
          <div>
            <p className="text-sm font-semibold text-amber-100">Feature this task for more visibility</p>
            <p className="mt-1 text-[11px] leading-snug text-white/45">
              Appears in the Featured section \u2014 more attention, faster completion. +$
              {FEATURE_FEE_USD.toFixed(2)} feature fee.
            </p>
          </div>
        </label>

        <section
          className="mb-3 space-y-2.5 rounded-2xl border p-4"
          style={{ background: COLORS.surface, borderColor: COLORS.border }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Order summary</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">{service.title}</span>
              <span className="font-medium">
                {qtyNum.toLocaleString()} {unitLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Reward per person</span>
              <span>${rewardNum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Earner payouts</span>
              <span>{formatUsd(earnerPayouts)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Platform fee ({Math.round(PLATFORM_FEE * 100)}%)</span>
              <span>{formatUsd(platformFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Estimated delivery</span>
              <span>{service.delivery}</span>
            </div>
            {featured ? (
              <div className="flex justify-between">
                <span className="text-white/50">Feature fee</span>
                <span>{formatUsd(featureFee)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-white/10 pt-2.5 text-base font-bold">
              <span>Total</span>
              <span className="text-emerald-300">{formatUsd(total)}</span>
            </div>
          </div>

          {insufficient ? (
            <p className="flex items-center gap-1.5 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
              <AlertTriangle className="size-3.5 shrink-0" />
              Wallet: ${balance.toFixed(2)} (insufficient balance)
            </p>
          ) : (
            <p className="text-[10px] text-white/35">Wallet balance: ${balance.toFixed(2)} USDT</p>
          )}

          <button
            type="button"
            disabled={busy || insufficient}
            onClick={() => void placeOrder()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 py-3.5 text-sm font-bold text-[#0a0c12] shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            <Rocket className="size-4" />
            {busy ? "Placing order\u2026" : `Place Order \u00b7 $${total.toFixed(2)}`}
          </button>
          {msg ? <p className="text-center text-xs text-amber-200/90">{msg}</p> : null}
        </section>
      </main>
    );
  }

  if (platform) {
    const meta = PLATFORM_META[platform];
    const list = SERVICES[platform] ?? [];
    return (
      <main
        className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5 text-white"
        style={{ background: COLORS.bg }}
      >
        <button
          type="button"
          onClick={() => setPlatform(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"
        >
          <ArrowLeft className="size-3.5" /> All Platforms
        </button>

        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4 shadow-lg shadow-black/25`}>
          <div className="flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-xl bg-black/25 backdrop-blur-sm">
              <PlatformLogo platform={platform} size={40} />
            </div>
            <div>
              <p className="text-base font-bold">{meta.label} Services</p>
              <p className="text-[11px] text-white/90">{meta.blurb}</p>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-2">
          <ShieldCheck className="size-3.5 shrink-0 text-sky-300" />
          <p className="text-[11px] text-sky-100/85">
            Every order is <span className="font-semibold">{meta.label}-only</span> \u2014 full task details, real proof, no cross-platform spam.
          </p>
        </div>

        <div className="space-y-2.5">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openService(s)}
              className="flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]"
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                <PlatformLogo platform={platform} size={28} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-0.5 text-[11px] text-white/45">{s.desc}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-bold text-emerald-300">{s.id === "yt_watch" ? `${formatUsd(s.fromUsd)} / second` : `${formatUsd(s.fromUsd)} / ${s.unit.replace(/s$/, "")}`}</span>
                  <span className="text-white/25">\u00b7</span>
                  <span className="text-white/45">
                    {s.minQty} \u2013 {s.maxQty.toLocaleString()} {s.unit}
                  </span>
                  <span className="text-white/25">\u00b7</span>
                  <span className="inline-flex items-center gap-1 text-white/45">
                    <Clock className="size-3" /> {s.delivery}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5 text-white"
      style={{ background: COLORS.bg }}
    >
      <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-5 shadow-xl shadow-blue-900/40">
        <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 left-10 size-24 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <img src={TASKORA_LOGO} alt="TASKORA" className="size-11 rounded-xl object-cover shadow-md" />
          <p className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <CheckCircle2 className="size-3" /> 100% real engagement
          </p>
        </div>
        <h1 className="relative mt-3 text-2xl font-extrabold tracking-tight">Grow with TASKORA</h1>
        <p className="relative mt-1.5 text-sm leading-relaxed text-white/90">
          Real engagement from verified members. Every task is platform-matched \u2014 if you order TikTok followers, earners complete it on TikTok only.
        </p>
        <p className="relative mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
          <Sparkles className="size-3.5" /> No cross-platform spam \u00b7 Full control over title, steps & proof
        </p>
      </div>

      <h2 className="text-lg font-bold">Choose a platform</h2>
      <p className="mt-0.5 text-xs text-white/45">Pick where you want real growth</p>

      {[...grouped.entries()].map(([cat, platforms]) => (
        <section key={cat} className="mt-5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
            </p>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">
              {platforms.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {platforms.map((p) => {
              const m = PLATFORM_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPlatform(p);
                    setMsg(null);
                  }}
                  className="flex flex-col items-start rounded-2xl border p-3.5 text-left transition active:scale-[0.98]"
                  style={{ background: COLORS.surface, borderColor: COLORS.border }}
                >
                  <PlatformLogo platform={p} size={48} />
                  <p className="mt-3 text-sm font-bold">{m.label}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/40">{m.blurb}</p>
                  <span
                    className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ color: m.color, backgroundColor: `${m.color}18` }}
                  >
                    {m.services} services
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {msg ? (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          {msg}
        </p>
      ) : null}
    </main>
  );
}
