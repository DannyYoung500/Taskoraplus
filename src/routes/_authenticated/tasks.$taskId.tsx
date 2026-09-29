import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";
import { Screen } from "@/components/Screen";
import { PlatformBadge, platformLabel } from "@/components/PlatformIcon";
import type { Platform } from "@/components/PlatformIcon";
import { getTask } from "@/lib/taskora.functions";
import { submitTaskGuarded } from "@/lib/taskora-mutations.functions";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useScreenshot, setUseScreenshot] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const platform = task.platform as Platform;
  const isTelegramJoin =
    String(task.platform).toLowerCase() === "telegram" ||
    /t\.me\//i.test(String(task.link ?? "")) ||
    String(task.proof) === "auto";
  const isWatch =
    String(task.proof) === "auto" &&
    /watch/i.test(String(task.title ?? "")) &&
    !isTelegramJoin;
  const rewardDisplay = `$${Number(task.reward).toFixed(6)}`;

  async function onAutoVerifyTelegram() {
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

  async function onSubmitScreenshot() {
    setBusy(true);
    setError(null);
    try {
      if (!proofText.trim()) throw new Error("Add a screenshot URL or proof note.");
      await submitTaskGuarded({
        data: {
          taskId: task.id,
          proofText: proofText.trim(),
          proofUrl: proofText.trim().startsWith("http") ? proofText.trim() : undefined,
        },
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="size-4" /> Tasks
      </Link>

      <div className="card-surface p-4">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={platform} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {platformLabel(platform)} · {task.advertiser}
            </p>
            <h1 className="mt-0.5 text-lg font-bold leading-snug">{task.title}</h1>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Meta label="Reward" value={rewardDisplay} Icon={ShieldCheck} />
          <Meta label="Time" value={`${task.seconds ?? "—"}s`} Icon={Clock3} />
          <Meta label="Slots left" value={`${task.slots_left}`} Icon={Users} />
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Locked catalog reward · same amount credited on approval
        </p>
      </div>

      <section className="card-surface mt-4 p-4">
        <h2 className="text-sm font-bold">How to complete</h2>
        <ol className="mt-3 space-y-3">
          {(task.steps ?? []).map((step: string, i: number) => (
            <li key={`${step}-${i}`} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-sm leading-6">{step}</p>
            </li>
          ))}
        </ol>
        {task.link ? (
          <a href={task.link} target="_blank" rel="noreferrer" className="mt-4 block text-center text-sm font-semibold text-primary">
            Open target
          </a>
        ) : null}
      </section>

      <section className="card-surface mt-4 p-4">
        <h2 className="text-sm font-bold">Verification</h2>
        {isTelegramJoin && !useScreenshot ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Automatic membership check via Telegram bot (bot must be admin). Screenshot is optional — only if you choose it. No soft fallback.
            </p>
            {autoStatus ? <p className="mt-2 text-xs text-emerald-400">{autoStatus}</p> : null}
            {error ? <p className="mt-2 text-xs text-warning">{error}</p> : null}
            <button
              type="button"
              disabled={busy || submitted}
              onClick={() => void onAutoVerifyTelegram()}
              className="mt-3 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify membership (auto)"}
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => {
                setUseScreenshot(true);
                setError(null);
              }}
              className="mt-2 w-full rounded-2xl border border-white/15 py-2.5 text-xs font-bold text-white/70"
            >
              Choose screenshot verification instead
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {isWatch
                ? "Watch verification is automatic after required watch time in the player."
                : useScreenshot
                  ? "Screenshot path selected. Reward only after review."
                  : "Pending until owner verifies."}
            </p>
            {!isWatch ? (
              <input
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="Screenshot URL or proof note"
                className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
              />
            ) : null}
            {error ? <p className="mt-2 text-xs text-warning">{error}</p> : null}
            {useScreenshot ? (
              <button type="button" className="mt-2 text-[11px] text-cyan-300" onClick={() => setUseScreenshot(false)}>
                ← Back to automatic membership check
              </button>
            ) : null}
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-md px-4 pb-2">
        {submitted ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold">
            <CheckCircle2 className="size-4" /> Submitted — awaiting verification
          </div>
        ) : isTelegramJoin && !useScreenshot ? null : (
          <button
            disabled={busy}
            onClick={() => (started ? void onSubmitScreenshot() : setStarted(true))}
            className="bg-green-grad w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Submitting…" : started ? "Submit for verification" : `Start task · ${rewardDisplay}`}
          </button>
        )}
      </div>
    </Screen>
  );
}

function Meta({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl bg-secondary px-2 py-3">
      <Icon className="mx-auto size-4 text-primary" />
      <p className="mt-1.5 text-[11px] font-bold leading-none break-all">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
