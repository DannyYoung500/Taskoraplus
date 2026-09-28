import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  Zap,
  PlayCircle,
  Camera,
  Type,
  Link2,
  AlertTriangle,
  Sparkles,
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
import { SERVICES, FEATURE_FEE_USD, type ServiceDef } from "@/lib/advertise-services";
import { extractYoutubeId, youtubeWatchUrl } from "@/lib/youtube-url";

export const Route = createFileRoute("/_authenticated/advertise")({
  head: () => ({ meta: [{ title: "Advertise — TASKORA" }] }),
  loader: async () => {
    const [dashResult, catalogResult] = await Promise.allSettled([
      getDashboard(),
      listAdvertiseServices(),
    ]);
    return {
      balance: dashResult.status === "fulfilled" ? Number(dashResult.value?.balance ?? 0) : 0,
      catalog: catalogResult.status === "fulfilled" ? catalogResult.value : [],
    };
  },
  component: AdvertisePage,
});

type Mode = "quick" | "custom";

function formatUsd(n: number) {
  if (Math.abs(n) < 0.01 && n !== 0) return `$${n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${n.toFixed(2)}`;
}

function AdvertisePage() {
  const { balance, catalog } = Route.useLoaderData();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [service, setService] = useState<ServiceDef | null>(null);
  const [mode, setMode] = useState<Mode>("quick");

  const [link, setLink] = useState("");
  const [qty, setQty] = useState(50);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [warningText, setWarningText] = useState("");
  const [proofRequirements, setProofRequirements] = useState<string[]>(["screenshot"]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [screenshotsRequired, setScreenshotsRequired] = useState(1);
  const [featured, setFeatured] = useState(false);
  const [verificationMode, setVerificationMode] = useState<"automatic" | "screenshot">("automatic");

  const [watchMinutes, setWatchMinutes] = useState(1);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);

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
    const row = (catalog as Array<Record<string, unknown>>).find(
      (x) => String(x.service_id) === raw.id,
    );
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
    setMode("quick");
    setQty(s.minQty);
    setLink("");
    setNotes("");
    setTitle(s.suggestedTitles[0] ?? s.title);
    setDescription(
      `Complete this task: ${s.title}. Follow the steps carefully and submit clear proof.`,
    );
    setInstructions(s.defaultSteps.join("\n"));
    setWarningText(s.defaultWarning ?? "");
    setProofRequirements(["screenshot"]);
    setDifficulty("easy");
    setScreenshotsRequired(1);
    setFeatured(false);
    setVerificationMode("automatic");
    setWatchMinutes(1);
    setWatchSeconds(0);
    setVideoDuration(null);
    setMsg(null);
  }

  const qtyNum = Math.max(1, Math.floor(Number(qty) || 1));
  const isWatch = service?.id === "yt_watch";
  const watchTotalSeconds = isWatch
    ? Math.max(1, Math.floor(watchMinutes) * 60 + Math.floor(watchSeconds))
    : 0;
  const unitCustomer = service
    ? Number(service.fromUsd) * (isWatch ? watchTotalSeconds : 1)
    : 0;
  const unitTasker = service
    ? Number(service.taskerUsd) * (isWatch ? watchTotalSeconds : 1)
    : 0;
  const unitMargin = service
    ? Number(service.taskoraUsd) * (isWatch ? watchTotalSeconds : 1)
    : 0;
  const earnerPayouts = unitTasker * qtyNum;
  const platformFee = unitMargin * qtyNum;
  const baseTotal = unitCustomer * qtyNum;
  const featureFee = featured ? FEATURE_FEE_USD : 0;
  const total = baseTotal + featureFee;
  const insufficient = balance < total;
  const ytId = isWatch ? extractYoutubeId(link) : null;
  const detectedMaxSeconds = videoDuration ? Math.min(videoDuration, 10800) : 10800;

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
                setWatchSeconds((s) =>
                  Math.min(s, seconds < 60 ? Math.max(0, seconds - 1) : 59),
                );
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
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        loadPlayer();
      };
      const wait = setInterval(() => {
        if (w.YT?.Player) {
          clearInterval(wait);
          loadPlayer();
        }
      }, 250);
      setTimeout(() => clearInterval(wait), 10000);
    }
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [ytId]);

  function setWatchDurationParts(minutes: number, seconds: number) {
    const totalSec = Math.max(
      1,
      Math.min(detectedMaxSeconds, Math.floor(minutes) * 60 + Math.floor(seconds)),
    );
    setWatchMinutes(Math.floor(totalSec / 60));
    setWatchSeconds(totalSec % 60);
  }

  function applyDescTemplate() {
    if (!service || !platform) return;
    const meta = PLATFORM_META[platform];
    setDescription(
      `Complete this ${meta.label} task: ${service.title}. Follow the steps carefully and submit clear proof.`,
    );
  }

  function applyInstrTemplate() {
    if (!service) return;
    setInstructions(service.defaultSteps.join("\n"));
  }

  function applyWarningTemplate() {
    if (!service) return;
    setWarningText(service.defaultWarning || "Real engagement only. Do not reverse the action after submitting proof.");
  }

  function toggleProof(p: string) {
    setProofRequirements((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== p);
      }
      return [...prev, p];
    });
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
      setMsg(
        `Quantity must be between ${service.minQty.toLocaleString()} and ${service.maxQty.toLocaleString()}.`,
      );
      return;
    }
    if (isWatch && (watchTotalSeconds < 1 || watchTotalSeconds > detectedMaxSeconds)) {
      setMsg("Watch time cannot be longer than the detected YouTube video duration.");
      return;
    }
    if (mode === "custom" && !title.trim()) {
      setMsg("Task title is required for Custom Task.");
      return;
    }
    if (insufficient) {
      setMsg(
        `Insufficient balance. You need ${formatUsd(total)} and have ${formatUsd(balance)}.`,
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const finalTitle =
        mode === "quick"
          ? service.suggestedTitles[0] || service.title
          : title.trim() || service.title;
      const finalDesc =
        mode === "quick"
          ? `Complete this task: ${service.title}. Follow the steps carefully and submit clear proof.`
          : description;
      const finalInstr =
        mode === "quick" ? service.defaultSteps.join("\n") : instructions;
      const finalWarning =
        mode === "quick" ? service.defaultWarning || "" : warningText;
      const finalProof =
        mode === "quick"
          ? ["screenshot"]
          : proofRequirements.length
            ? proofRequirements
            : ["screenshot"];
      const finalDifficulty = mode === "quick" ? "easy" : difficulty;
      const finalShots = mode === "quick" ? 1 : screenshotsRequired;

      const result = await createAdvertiseCampaign({
        data: {
          serviceId: service.id,
          title: isWatch ? undefined : finalTitle,
          link: ytId ? youtubeWatchUrl(ytId) : link.trim(),
          quantity: qtyNum,
          watchSeconds: isWatch ? watchTotalSeconds : undefined,
          videoDurationSeconds: isWatch ? videoDuration ?? undefined : undefined,
          videoSource: isWatch ? "external_url" : undefined,
          description: finalDesc,
          instructions: finalInstr,
          warningText: finalWarning,
          proofRequirements: finalProof,
          difficulty: finalDifficulty,
          screenshotsRequired: finalShots,
          featured,
          verificationMode:
            platform === "telegram" || platform === "discord"
              ? mode === "quick"
                ? "automatic"
                : verificationMode
              : undefined,
        },
      });
      setMsg(`Order placed · ${result.task.id.slice(0, 8)}… Waiting for activation.`);
      setService(null);
      setPlatform(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create campaign.");
    } finally {
      setBusy(false);
    }
  }

  /* ───────── Service form (EarnIT-style) ───────── */
  if (platform && service) {
    const meta = PLATFORM_META[platform];
    const isTgOrDiscord = platform === "telegram" || platform === "discord";

    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#0a0c10] px-4 pb-28 pt-4 text-white">
        <button
          type="button"
          onClick={() => {
            setService(null);
            setMsg(null);
          }}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"
        >
          <ArrowLeft className="size-3.5" /> Back to Services
        </button>

        {/* Service header */}
        <div
          className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-black/25">
              <PlatformLogo platform={platform} size={28} />
            </div>
            <div>
              <p className="text-base font-bold">{service.title}</p>
              <p className="text-[11px] text-white/85">{service.desc}</p>
            </div>
          </div>
        </div>

        {/* Quick Boost / Custom Task toggle */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("quick")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
              mode === "quick"
                ? "bg-sky-500 text-white"
                : "border border-white/10 bg-white/[0.04] text-white/45"
            }`}
          >
            <Zap className="size-3.5" /> Quick Boost
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
              mode === "custom"
                ? "bg-violet-500 text-white"
                : "border border-white/10 bg-white/[0.04] text-white/45"
            }`}
          >
            <Sparkles className="size-3.5" /> Custom Task
          </button>
        </div>

        {mode === "quick" ? (
          <p className="mb-4 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-sky-100/90">
            <Zap className="mr-1 inline size-3.5 text-sky-300" />
            Quick Boost auto-generates the task title, description, instructions, and proof
            requirements. Just provide your link and quantity.
          </p>
        ) : (
          <p className="mb-4 rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-violet-100/90">
            <Sparkles className="mr-1 inline size-3.5 text-violet-300" />
            Custom Task lets you write your own title, description, instructions, and proof
            rules. Pricing stays catalog-locked (tasker reward + TASKORA margin).
          </p>
        )}

        <div className="space-y-3">
          {/* Target URL */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
              {isWatch ? "YouTube Video URL" : `${meta.label} ${service.taskType === "follow" || service.taskType === "subscribe" || service.taskType === "join" ? "Profile / Channel URL" : "Target URL"}`}
            </label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={service.linkPlaceholder}
              inputMode="url"
              className="w-full rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50"
            />
          </div>

          {/* YouTube preview */}
          {isWatch && ytId ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  <PlayCircle className="size-3.5 text-red-400" /> YouTube preview
                </span>
                <span className="text-[10px] text-emerald-300">Valid video URL</span>
              </div>
              <div className="aspect-video w-full bg-black">
                <div ref={youtubeHostRef} className="h-full w-full" />
              </div>
              <div className="flex items-center justify-between border-t border-white/8 px-3 py-2 text-[10px]">
                <span className="text-white/40">Detected duration</span>
                <span className="font-bold text-emerald-300">
                  {videoDuration
                    ? `${String(Math.floor(videoDuration / 60)).padStart(2, "0")}:${String(videoDuration % 60).padStart(2, "0")}`
                    : "Reading…"}
                </span>
              </div>
            </div>
          ) : null}

          {/* Watch time (watch service only) */}
          {isWatch ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
                Required watch time
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-white/40">Minutes</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.floor(detectedMaxSeconds / 60)}
                    value={watchMinutes}
                    onChange={(e) =>
                      setWatchDurationParts(Number(e.target.value), watchSeconds)
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#141820] px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-white/40">Seconds</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={watchSeconds}
                    onChange={(e) =>
                      setWatchDurationParts(watchMinutes, Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#141820] px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
              Quantity ({service.unit})
            </label>
            <input
              type="number"
              min={service.minQty}
              max={service.maxQty}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50"
            />
            <p className="mt-1 text-[10px] text-white/35">
              Min: {service.minQty.toLocaleString()} | Max: {service.maxQty.toLocaleString()}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {service.qtyChips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setQty(c)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                    qty === c
                      ? "bg-emerald-500 text-white"
                      : "border border-white/10 bg-white/[0.04] text-white/50"
                  }`}
                >
                  {c.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
              Notes <span className="font-normal text-white/30">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special instructions…"
              className="w-full resize-none rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 text-sm outline-none transition focus:border-sky-400/50"
            />
          </div>

          {/* Custom Task Details */}
          {mode === "custom" ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12151c] p-4">
              <p className="text-[11px] font-bold text-white/70">
                <span className="mr-1">✎</span> Task Details
              </p>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
                  Task Title <span className="text-red-400">*</span>
                </label>
                <p className="mb-1.5 text-[10px] text-white/35">Suggested titles</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {service.suggestedTitles.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTitle(t)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g. ${service.suggestedTitles[0] || service.title}`}
                  className="w-full rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 text-sm outline-none focus:border-sky-400/50"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white/55">
                    Description{" "}
                    <span className="font-normal text-white/30">(optional, auto-generated if blank)</span>
                  </label>
                  <button
                    type="button"
                    onClick={applyDescTemplate}
                    className="text-[10px] font-bold text-emerald-400"
                  >
                    ✦ Use a template
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Describe what earners need to do…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 text-sm outline-none focus:border-sky-400/50"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white/55">
                    Instructions{" "}
                    <span className="font-normal text-white/30">(optional, auto-generated if blank)</span>
                  </label>
                  <button
                    type="button"
                    onClick={applyInstrTemplate}
                    className="text-[10px] font-bold text-emerald-400"
                  >
                    ✦ Use a template
                  </button>
                </div>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={4}
                  placeholder={"1. Visit the link\n2. Complete the action\n3. Take a screenshot\n4. Submit proof"}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 font-mono text-[12px] leading-relaxed outline-none focus:border-sky-400/50"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white/55">
                    Warning Text{" "}
                    <span className="font-normal text-white/30">(optional, auto-generated if blank)</span>
                  </label>
                  <button
                    type="button"
                    onClick={applyWarningTemplate}
                    className="text-[10px] font-bold text-emerald-400"
                  >
                    ✦ Use a template
                  </button>
                </div>
                <p className="mb-1.5 text-[10px] text-white/35">Common warnings</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setWarningText(
                        "Real engagement only. Reversed actions may lead to rejection.",
                      )
                    }
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60"
                  >
                    Real engagement only. Reversed actions re…
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setWarningText("Do not unfollow after submitting proof.")
                    }
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60"
                  >
                    Do not unfollow after submitting
                  </button>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-3 size-3.5 shrink-0 text-amber-300" />
                  <input
                    value={warningText}
                    onChange={(e) => setWarningText(e.target.value)}
                    placeholder="e.g. Do not unfollow after submitting proof"
                    className="w-full rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 text-sm outline-none focus:border-sky-400/50"
                  />
                </div>
              </div>

              {/* TG/Discord verification choice in custom */}
              {isTgOrDiscord && !isWatch ? (
                <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.05] p-3">
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-sky-200/70">
                    Verification method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationMode("automatic");
                        setProofRequirements([]);
                        setScreenshotsRequired(0);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                        verificationMode === "automatic"
                          ? "border-sky-300/60 bg-sky-300/15 text-sky-100"
                          : "border-white/10 bg-black/20 text-white/45"
                      }`}
                    >
                      Automatic
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationMode("screenshot");
                        setProofRequirements(["screenshot"]);
                        setScreenshotsRequired(1);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                        verificationMode === "screenshot"
                          ? "border-sky-300/60 bg-sky-300/15 text-sky-100"
                          : "border-white/10 bg-black/20 text-white/45"
                      }`}
                    >
                      Screenshot
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-white/40">
                    {verificationMode === "automatic"
                      ? "Membership is checked automatically. If it cannot run, the task stays unverified — no soft fallback to screenshot."
                      : "Users submit screenshots; owner reviews. Automatic is not used for this campaign."}
                  </p>
                </div>
              ) : null}

              {!isWatch && !(isTgOrDiscord && verificationMode === "automatic") ? (
                <>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold text-white/55">
                      Proof Requirements
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["screenshot", "Screenshot", Camera],
                          ["text", "Text/Comment", Type],
                          ["link", "Link/URL", Link2],
                        ] as const
                      ).map(([value, label, Icon]) => {
                        const checked = proofRequirements.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleProof(value)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${
                              checked
                                ? "border-emerald-400/50 bg-emerald-500 text-white"
                                : "border-white/10 bg-white/[0.04] text-white/45"
                            }`}
                          >
                            <Icon className="size-3.5" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-semibold text-white/55">
                      Difficulty
                    </label>
                    <div className="flex gap-2">
                      {(["easy", "medium", "hard"] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold capitalize ${
                            difficulty === level
                              ? level === "hard"
                                ? "border-red-400/60 bg-red-500/15 text-red-200"
                                : "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                              : "border-white/10 bg-white/[0.04] text-white/40"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-white/55">
                      Screenshots required
                    </label>
                    <select
                      value={screenshotsRequired}
                      onChange={(e) => setScreenshotsRequired(Number(e.target.value))}
                      disabled={!proofRequirements.includes("screenshot")}
                      className="w-full rounded-xl border border-white/10 bg-[#141820] px-3.5 py-3 text-sm outline-none"
                    >
                      <option value={0}>0 screenshots</option>
                      <option value={1}>1 screenshot</option>
                      <option value={2}>2 screenshots</option>
                      <option value={3}>3 screenshots</option>
                    </select>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
                      How many screenshots each performer must upload as proof. Use 2 or 3 for
                      tasks needing multiple verification steps (e.g. follow + comment + share).
                    </p>
                  </div>
                </>
              ) : null}

              {isWatch ? (
                <p className="rounded-xl border border-sky-400/15 bg-sky-400/5 px-3 py-2.5 text-[11px] text-sky-100/80">
                  <ShieldCheck className="mr-1 inline size-3.5" />
                  Automatic watch verification — no screenshot needed.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Feature checkbox */}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-3.5">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="mt-0.5 size-4 rounded border-white/20"
            />
            <div>
              <p className="text-[13px] font-semibold text-white">
                Feature this task for more visibility
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                Your task will appear in the "Featured" section on the tasks page,
                getting more attention from earners and faster completion.
              </p>
            </div>
          </label>

          {/* Order Summary */}
          <div className="rounded-2xl border border-white/10 bg-[#12151c] p-4">
            <p className="mb-3 text-[13px] font-bold">Order Summary</p>
            <div className="space-y-2 text-[12px] text-white/55">
              <div className="flex justify-between">
                <span>{service.title}</span>
                <span className="text-white">
                  {qtyNum.toLocaleString()} {service.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mode</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    mode === "quick"
                      ? "bg-sky-500/20 text-sky-300"
                      : "bg-violet-500/20 text-violet-300"
                  }`}
                >
                  {mode === "quick" ? "Quick" : "Custom"}
                </span>
              </div>
              {isWatch ? (
                <div className="flex justify-between">
                  <span>Watch time</span>
                  <span className="text-white">{watchTotalSeconds}s</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span>Price per {service.unit.replace(/s$/, "")}</span>
                <span className="text-white">{formatUsd(unitCustomer)}</span>
              </div>
              {mode === "custom" ? (
                <>
                  <div className="flex justify-between">
                    <span>Earner payouts</span>
                    <span className="text-white">{formatUsd(earnerPayouts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TASKORA margin</span>
                    <span className="text-white">{formatUsd(platformFee)}</span>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between">
                <span>Estimated delivery</span>
                <span className="text-white">{service.delivery.replace("~", "")}</span>
              </div>
              {featured ? (
                <div className="flex justify-between">
                  <span>Feature fee</span>
                  <span className="text-white">{formatUsd(featureFee)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-white/10 pt-2 text-[15px] font-black">
                <span className="text-white">Total</span>
                <span className="text-emerald-400">{formatUsd(total)}</span>
              </div>
            </div>

            {insufficient ? (
              <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-300">
                ⚠ Wallet: {formatUsd(balance)} (insufficient balance)
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-white/40">
                Balance: {formatUsd(balance)}
              </p>
            )}
          </div>

          {msg ? (
            <p
              className={`text-xs ${
                msg.includes("placed") || msg.includes("created")
                  ? "text-emerald-300"
                  : "text-amber-300"
              }`}
            >
              {msg}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy || insufficient}
            onClick={() => void publish()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-white disabled:opacity-40"
          >
            🚀{" "}
            {busy
              ? "Placing order…"
              : insufficient
                ? `Place Order — ${formatUsd(total)}`
                : mode === "custom"
                  ? `Create Task — ${formatUsd(total)}`
                  : `Place Order — ${formatUsd(total)}`}
          </button>
        </div>
      </main>
    );
  }

  /* ───────── Platform services list ───────── */
  if (platform) {
    const meta = PLATFORM_META[platform];
    const list = SERVICES[platform] ?? [];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#0a0c10] px-4 pb-28 pt-4 text-white">
        <button
          type="button"
          onClick={() => setPlatform(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"
        >
          <ArrowLeft className="size-3.5" /> All Platforms
        </button>
        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={52} />
            <div>
              <p className="text-base font-bold">{meta.label} Services</p>
              <p className="text-[11px] text-white/85">{meta.blurb}</p>
            </div>
          </div>
        </div>
        <p className="mb-3 text-xs text-white/45">
          Select a service to grow your {meta.label} presence
        </p>
        <div className="space-y-2.5">
          {list.map((raw) => {
            const s = priced(raw);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => openService(s)}
                className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-[#12151c] p-3.5 text-left transition active:scale-[0.99]"
              >
                <PlatformLogo platform={platform} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">{s.desc}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-bold text-sky-300">
                      From {formatUsd(s.fromUsd)}
                    </span>
                    <span className="text-white/35">·</span>
                    <span className="text-white/45">
                      {s.minQty.toLocaleString()} – {s.maxQty.toLocaleString()} {s.unit}
                    </span>
                    <span className="text-white/35">·</span>
                    <span className="inline-flex items-center gap-1 text-white/45">
                      <Clock className="size-3" /> {s.delivery}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  /* ───────── Platform picker ───────── */
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#0a0c10] px-4 pb-28 pt-5 text-white">
      <div className="mb-5">
        <h1 className="text-xl font-black tracking-tight">Advertise</h1>
        <p className="mt-1 text-[12px] text-white/45">
          Create a task · Quick Boost or Custom · catalog pricing
        </p>
      </div>
      <section className="mb-5 rounded-2xl border border-white/10 bg-[#12151c] p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10">
            <Zap className="size-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold">How it works</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-white/50">
              Pick a platform and service, choose <strong className="text-white/70">Quick Boost</strong>{" "}
              (auto-filled) or <strong className="text-white/70">Custom Task</strong> (your own
              title, steps & proof), set quantity, and place the order from your wallet.
            </p>
          </div>
        </div>
      </section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">Choose platform</p>
        <span className="text-[10px] text-white/40">Balance {formatUsd(balance)}</span>
      </div>
      {[...grouped.entries()].map(([cat, platforms]) => (
        <section key={cat} className="mb-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
            {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
          </p>
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
                  className="flex flex-col items-start rounded-2xl border border-white/8 bg-[#12151c] p-3.5 text-left transition active:scale-[0.98]"
                >
                  <PlatformLogo platform={p} size={48} />
                  <p className="mt-3 text-sm font-bold">{m.label}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/40">
                    {m.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
