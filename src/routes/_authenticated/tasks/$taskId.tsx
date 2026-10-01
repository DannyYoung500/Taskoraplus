import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Users,
  Link2,
  Camera,
  Type,
  AlertTriangle,
  ExternalLink,
  Zap,
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
    return { task };
  },
  component: TaskDetail,
});

function TaskDetail() {
  const { task } = Route.useLoaderData();
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proofText, setProofText] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);

  const platform = String(task.platform || "other").toLowerCase() as Platform;
  const proofMode = String((task as { proof?: string }).proof ?? "screenshot").toLowerCase();
  const isTelegramJoin =
    platform === "telegram" ||
    /t\.me\//i.test(String(task.link ?? "")) ||
    proofMode === "auto";
  const isAuto = proofMode === "auto" || isTelegramJoin;
  const steps: string[] = Array.isArray((task as { steps?: string[] }).steps)
    ? ((task as { steps: string[] }).steps)
    : String((task as { instructions?: string }).instructions || "")
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
  const warning = String((task as { warning_text?: string }).warning_text || "").trim();
  const slotsLeft = Number((task as { slots_left?: number }).slots_left ?? 0);
  const slotsTotal = Number((task as { slots_total?: number }).slots_total ?? 0);
  const reward = Number(task.reward ?? 0);
  const link = String(task.link ?? "").trim();

  async function onAutoVerify() {
    setBusy(true);
    setError(null);
    setAutoStatus("Checking membership…");
    try {
      await submitTaskGuarded({
        data: { taskId: task.id, proofText: "auto:telegram_membership" },
      });
      setSubmitted(true);
      setAutoStatus("Verified · membership confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-verify failed");
      setAutoStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitProof() {
    setBusy(true);
    setError(null);
    try {
      const text = proofText.trim();
      const url = proofUrl.trim() || (text.startsWith("http") ? text : "");
      if (!text && !url) throw new Error("Add proof text and/or a screenshot URL.");
      await submitTaskGuarded({
        data: {
          taskId: task.id,
          proofText: text || url,
          proofUrl: url || undefined,
        },
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05080f] px-4 pb-28 pt-5 text-white">
        <div className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 via-[#12151c] to-cyan-500/10 p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-400/20">
            <CheckCircle2 className="size-7 text-emerald-300" />
          </div>
          <h1 className="mt-4 text-lg font-black">Submitted</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-white/55">
            {autoStatus ||
              "Your proof is in the review queue. Reward credits after verification."}
          </p>
          <AppLink
            to="/tasks"
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-400 py-3 text-sm font-extrabold text-[#05080f]"
          >
            Back to tasks
          </AppLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05080f] px-4 pb-28 pt-4 text-white">
      <div className="mb-4 flex items-center gap-2">
        <AppLink to="/tasks" className="rounded-full border border-white/10 p-2 text-white/60" aria-label="Back">
          <ArrowLeft className="size-4" />
        </AppLink>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">
            Task · {platformLabel(platform)}
          </p>
          <h1 className="truncate text-base font-black">{task.title}</h1>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-200">
          {formatUsd(reward)}
        </span>
      </div>

      <section className="mb-4 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-[#12151c] to-violet-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-black/30 ring-1 ring-white/10">
            <PlatformLogo platform={platform} size={36} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">{platformLabel(platform)}</p>
            <p className="mt-0.5 truncate text-[11px] text-white/45">
              {String((task as { advertiser?: string }).advertiser || "TASKORA Advertiser")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/60">
                <Clock3 className="size-3" />
                {Number((task as { seconds?: number }).seconds ?? 30)}s est.
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/60">
                <Users className="size-3" />
                {slotsLeft}/{slotsTotal || "∞"} left
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold text-cyan-200">
                <ShieldCheck className="size-3" />
                {isAuto ? "Auto verify" : "Screenshot proof"}
              </span>
            </div>
          </div>
        </div>
        {slotsTotal > 0 ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-400"
              style={{
                width: `${Math.min(100, Math.round(((slotsTotal - slotsLeft) / slotsTotal) * 100))}%`,
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="mb-4 rounded-2xl border border-white/8 bg-[#12151c] p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white">
          <Zap className="size-3.5 text-cyan-300" /> How to complete
        </p>
        <ol className="space-y-2">
          {(steps.length ? steps : ["Open the link", "Complete the action", "Return and submit proof"]).map(
            (step, i) => (
              <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed text-white/70">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[10px] font-black text-cyan-200">
                  {i + 1}
                </span>
                {step}
              </li>
            ),
          )}
        </ol>
        {warning ? (
          <p className="mt-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-100">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {warning}
          </p>
        ) : null}
      </section>

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mb-4 flex items-center gap-2 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-[12px] font-bold text-sky-100"
        >
          <Link2 className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Open target link</span>
          <ExternalLink className="size-3.5 opacity-70" />
        </a>
      ) : null}

      {!started ? (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="w-full rounded-2xl bg-cyan-400 py-3.5 text-sm font-extrabold text-[#05080f]"
        >
          Start task
        </button>
      ) : (
        <section className="space-y-3 rounded-2xl border border-white/8 bg-[#12151c] p-4">
          <p className="text-xs font-bold text-white">Submit proof</p>
          {isAuto && !proofText ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAutoVerify()}
              className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-extrabold text-[#05080f] disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Auto-verify membership"}
            </button>
          ) : null}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-white/45">
              <Type className="size-3" /> Proof note
            </label>
            <textarea
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              rows={3}
              placeholder="Username, comment text, or what you did…"
              className="w-full rounded-xl border border-white/10 bg-[#0a0c12] px-3 py-2.5 text-[13px] outline-none focus:border-cyan-400/40"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-white/45">
              <Camera className="size-3" /> Screenshot URL (optional)
            </label>
            <input
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="w-full rounded-xl border border-white/10 bg-[#0a0c12] px-3 py-2.5 text-[13px] outline-none focus:border-cyan-400/40"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSubmitProof()}
            className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-extrabold text-[#05080f] disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          {autoStatus ? <p className="text-[11px] text-emerald-300">{autoStatus}</p> : null}
          {error ? <p className="text-[11px] text-amber-200">{error}</p> : null}
        </section>
      )}
    </main>
  );
}
