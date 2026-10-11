import { createFileRoute, notFound, redirect, useRouter } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Camera, CheckCircle2, Copy, ExternalLink, ListChecks, AlertTriangle, ShieldCheck, X,
} from "lucide-react";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { getTask } from "@/lib/taskora.functions";
import { submitTaskGuarded } from "@/lib/taskora-mutations.functions";
import { AppLink } from "@/components/AppLink";
import { formatUsd } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  head: () => ({ meta: [{ title: "Task — TASKORA" }] }),
  loader: async ({ params }) => {
    const task = await getTask({ data: { taskId: params.taskId } }).catch(() => null);
    if (!task) throw notFound();
    const type = String((task as { task_type?: string }).task_type || "").toLowerCase();
    const platform = String((task as { platform?: string }).platform || "").toLowerCase();
    const isVideoWatch =
      type.includes("video_watch") || type.includes("watch") || type === "view" ||
      (platform === "youtube" && type.includes("video"));
    if (isVideoWatch) throw redirect({ to: "/watch-earn", search: { taskId: params.taskId } as never });
    return { task };
  },
  component: TaskDetail,
});

function TaskDetail() {
  const { task } = Route.useLoaderData();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [proofUsername, setProofUsername] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const platform = String(task.platform || "other").toLowerCase() as Platform;
  const proofMode = String((task as { proof?: string }).proof ?? "screenshot").toLowerCase();
  const taskType = String((task as { task_type?: string }).task_type || "").toLowerCase();
  const isAuto =
    proofMode === "auto" || proofMode === "automatic" ||
    (platform === "telegram" && ["join", "subscribe", "bot_start", "start"].some((k) => taskType.includes(k)));
  const isTgJoin = platform === "telegram" && (isAuto || ["join", "subscribe", "bot_start"].some((k) => taskType.includes(k)));
  const steps: string[] = Array.isArray((task as { steps?: string[] }).steps)
    ? (task as { steps: string[] }).steps
    : String((task as { instructions?: string }).instructions || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
  const reward = Number(task.reward ?? 0);
  const link = String(task.link ?? "").trim();
  const screenshotsRequired = Math.max(1, Math.min(3, Number((task as { screenshots_required?: number }).screenshots_required ?? 1)));
  const needsUsername = !isAuto && ["x", "instagram", "tiktok", "youtube", "facebook", "threads"].includes(platform);
  const taskIdStr = String((task as { id?: string }).id ?? "");
  const defaultSteps = useMemo(() => {
    if (steps.length) return steps;
    if (isAuto && platform === "telegram") {
      return ["Open the channel / group / bot link", "Join or tap Start", "Return here and tap Verify membership", "Stay joined — we re-check later"];
    }
    return ["Open the link", "Complete the action", "Take a clear screenshot", "Submit proof"];
  }, [steps, isAuto, platform]);

  function openLink() {
    if (!link) return;
    try {
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void; openLink?: (u: string) => void } } }).Telegram?.WebApp;
      if (/t\.me\//i.test(link) && tg?.openTelegramLink) { tg.openTelegramLink(link); return; }
      if (tg?.openLink) { tg.openLink(link); return; }
    } catch { /* soft */ }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function onAutoVerify() {
    setBusy(true); setError(null); setAutoStatus("Checking membership…");
    try {
      await submitTaskGuarded({ data: { taskId: taskIdStr, proofText: "auto:telegram_membership" } });
      setSubmitted(true); setAutoStatus("Verified · membership confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed"); setAutoStatus(null);
    } finally { setBusy(false); }
  }

  async function onSubmitProof() {
    setBusy(true); setError(null);
    try {
      if (needsUsername && !proofUsername.trim()) throw new Error(`Enter your ${platformLabel(platform)} username.`);
      const filled = shots.filter(Boolean);
      if (filled.length < screenshotsRequired) throw new Error(`Add ${screenshotsRequired} screenshot(s).`);
      const proofText = [proofUsername.trim() ? `@${proofUsername.trim().replace(/^@/, "")}` : "", proofNote.trim()].filter(Boolean).join(" · ") || "screenshot_proof";
      await submitTaskGuarded({ data: { taskId: taskIdStr, proofText, proofUrl: filled[0] } });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit proof");
    } finally { setBusy(false); }
  }

  function onPickShot(index: number, file: File | null) {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) { setError("Use JPEG, PNG, or WebP only."); return; }
    const reader = new FileReader();
    reader.onload = () => setShots((prev) => { const n = [...prev]; n[index] = String(reader.result || ""); return n; });
    reader.readAsDataURL(file);
  }

  const quitCls = "mt-2 flex w-full items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 py-3 text-[13px] font-medium text-red-400 disabled:opacity-50";

  if (submitted) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-6 text-neutral-100">
        <div className="rounded-2xl bg-[#121212] p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
          <p className="mt-3 text-[17px] font-medium">{isAuto ? "Verified" : "Proof submitted"}</p>
          <p className="mt-2 text-[13px] text-neutral-500">{isAuto ? "Membership confirmed. Reward credits shortly." : "In review — reward after verification."}</p>
        </div>
        <AppLink to="/tasks" className="mt-4 flex w-full items-center justify-center rounded-2xl bg-orange-500 py-3.5 text-[14px] font-medium text-[#0a0a0a]">Back to tasks</AppLink>
      </main>
    );
  }

  const shotsFilled = shots.filter(Boolean).length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <div className="mb-3 flex items-center justify-between">
        <AppLink to="/tasks" className="inline-flex items-center gap-1.5 text-[13px] text-neutral-500"><ArrowLeft className="size-4" /> Back</AppLink>
        <button type="button" onClick={() => void router.navigate({ to: "/tasks" })} className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-[11px] font-medium text-red-400"><X className="size-3.5" /> Quit task</button>
      </div>

      <section className="rounded-2xl bg-[#121212] p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#1a1a1a]"><PlatformLogo platform={platform} size={28} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2">
              <p className="text-[16px] font-medium text-neutral-50">{task.title}</p>
              <span className="text-[16px] font-semibold text-emerald-400">{formatUsd(reward)}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-neutral-500">{platformLabel(platform)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {isAuto ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-400"><ShieldCheck className="size-3" /> Auto verify</span>
              ) : (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-sky-400">Screenshot</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-[#121212] p-4">
        <div className="mb-3 flex items-center gap-2"><ListChecks className="size-4 text-orange-400" /><p className="text-[14px] font-medium">Instructions</p></div>
        <ol className="space-y-2">{defaultSteps.map((s, i) => (<li key={i} className="flex gap-2 text-[13px] text-neutral-400"><span className="text-neutral-500">{i + 1}.</span><span>{s}</span></li>))}</ol>
      </section>

      <div className="mt-3 space-y-2">
        <button type="button" onClick={openLink} disabled={!link} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[14px] font-medium text-[#0a0a0a] disabled:opacity-40">
          <ExternalLink className="size-4" /> {isTgJoin ? "Open Telegram link" : "Open Task Link"}
        </button>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); } catch {} }} disabled={!link} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1a1a1a] py-3.5 text-[14px] font-medium text-neutral-200 disabled:opacity-40">
          <Copy className="size-4" /> {copiedLink ? "Link copied" : "Copy Link"}
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 text-amber-400" /><p className="text-[12px] text-amber-200/80">{isAuto ? "Stay joined after verification. Leaving early can reverse your reward." : "Submit clear original proof. Fake accounts will be rejected."}</p></div>
      </div>

      {isAuto ? (
        <section className="mt-3 rounded-2xl bg-[#121212] p-4">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-400" /><p className="text-[14px] font-medium">Automatic verification</p></div>
          <p className="mb-4 text-[13px] text-neutral-500">No screenshot needed. We check your Telegram membership after you join.</p>
          <button type="button" disabled={busy} onClick={() => void onAutoVerify()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-[14px] font-medium text-[#0a0a0a] disabled:opacity-50">
            <ShieldCheck className="size-4" /> {busy ? "Verifying…" : "Verify membership"}
          </button>
          <button type="button" disabled={busy} onClick={() => void router.navigate({ to: "/tasks" })} className={quitCls}>Quit task</button>
          {error ? <p className="mt-3 text-center text-[12px] text-amber-300">{error}</p> : null}
          {autoStatus ? <p className="mt-2 text-center text-[12px] text-emerald-400">{autoStatus}</p> : null}
        </section>
      ) : (
        <section className="mt-3 rounded-2xl bg-[#121212] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><Camera className="size-4 text-orange-400" /><p className="text-[14px] font-medium">Submit Proof</p></div>
            <span className="text-[11px] text-neutral-500">{shotsFilled} of {screenshotsRequired}</span>
          </div>
          {needsUsername ? (
            <input value={proofUsername} onChange={(e) => setProofUsername(e.target.value)} placeholder={`@ ${platformLabel(platform)} username`} className="mb-3 w-full rounded-xl bg-[#1a1a1a] px-3.5 py-3 text-[13px] outline-none" />
          ) : null}
          <div className="space-y-2.5">
            {Array.from({ length: screenshotsRequired }).map((_, i) => (
              <button key={i} type="button" onClick={() => fileRefs.current[i]?.click()} className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0c0c0c] px-4 py-8">
                {shots[i] ? <img src={shots[i]} alt="" className="max-h-40 w-full rounded-xl object-contain" /> : (<><Camera className="mb-2 size-5 text-orange-400" /><p className="text-[13px] text-neutral-300">Screenshot {i + 1}</p></>)}
                <input ref={(el) => { fileRefs.current[i] = el; }} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onPickShot(i, e.target.files?.[0] ?? null)} />
              </button>
            ))}
          </div>
          <textarea value={proofNote} onChange={(e) => setProofNote(e.target.value)} rows={2} placeholder="Note (optional)…" className="mt-3 w-full resize-none rounded-xl bg-[#1a1a1a] px-3.5 py-2.5 text-[13px] outline-none" />
          <button type="button" disabled={busy || shotsFilled < screenshotsRequired} onClick={() => void onSubmitProof()} className="mt-3 flex w-full items-center justify-center rounded-2xl bg-orange-500 py-3.5 text-[14px] font-medium text-[#0a0a0a] disabled:opacity-40">
            {busy ? "Submitting…" : "Submit Proof"}
          </button>
          <button type="button" disabled={busy} onClick={() => void router.navigate({ to: "/tasks" })} className={quitCls}>Quit task</button>
          {error ? <p className="mt-2 text-center text-[12px] text-amber-300">{error}</p> : null}
        </section>
      )}
    </main>
  );
}
