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
  const [startedAtIso, setStartedAtIso] = useState<string | null>(null);
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
        data: {
          taskId: task.id,
          proofText: "auto:telegram_membership",
          startedAtIso: startedAtIso ?? new Date().toISOString(),
        },
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
          startedAtIso: startedAtIso ?? new Date().toISOString(),
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
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-300" />
          <h1 className="mt-3 text-lg font-bold">Submitted</h1>
          <p className="mt-1 text-sm text-white/55">We will review your proof shortly.</p>
          <AppLink to="/tasks" className="mt-4 inline-block rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-[#05080f]">
            Back to tasks
          </AppLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <AppLink to="/tasks" className="rounded-full border border-white/10 p-2 text-white/60">
          <ArrowLeft className="size-4" />
        </AppLink>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">{platformLabel(platform)}</p>
          <h1 className="truncate text-lg font-bold">{task.title}</h1>
        </div>
        <PlatformLogo platform={platform} className="size-9" />
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-white/50">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
          <Zap className="size-3 text-cyan-300" /> {formatUsd(reward)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
          <Users className="size-3" /> {slotsLeft}/{slotsTotal || "∞"} slots
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
          <Clock3 className="size-3" /> Review
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
          <ShieldCheck className="size-3 text-emerald-300" /> {proofMode}
        </span>
      </div>

      {warning ? (
        <div className="mb-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-[12px] text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{warning}</p>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <section className="mb-3 space-y-2 rounded-2xl border border-white/8 bg-[#12151c] p-4">
          <p className="text-xs font-bold text-white">Steps</p>
          <ol className="space-y-1.5 text-[12px] text-white/65">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-bold text-cyan-300">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 py-3 text-sm font-bold text-cyan-200"
        >
          <ExternalLink className="size-4" /> Open task link
        </a>
      ) : null}

      {!started ? (
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            setStartedAtIso(new Date().toISOString());
            void (async () => {
              try {
                const { collectDeviceFpV2 } = await import("@/lib/device-fp-client");
                const { reportDeviceFpV2 } = await import("@/lib/strong-remaining.functions");
                await reportDeviceFpV2({ data: { rawFp: collectDeviceFpV2() } });
              } catch {
                /* soft */
              }
            })();
          }}
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
