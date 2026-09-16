import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";
import { Screen, GoldButton } from "@/components/Screen";
import { PlatformBadge, platformLabel } from "@/components/PlatformIcon";
import type { Platform } from "@/components/PlatformIcon";
import { TaskActionPlayer } from "@/components/TaskActionPlayer";
import {
  isTaskActionAllowed,
  normalizeTaskAction,
  taskActionLabel,
} from "@/lib/task-actions";
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

type TaskWithAction = {
  task_type?: string | null;
  description?: string | null;
  instructions?: string | null;
  warning_text?: string | null;
  target_url?: string | null;
  difficulty?: string | null;
  screenshots_required?: number | null;
  proof_requirements?: string[] | null;
  featured?: boolean | null;
  task_metadata?: Record<string, unknown> | null;
};

function inferAction(task: TaskWithAction & { title: string; steps: string[] | null }) {
  const stored = normalizeTaskAction(task.task_type);
  if (stored) return stored;
  const completeStep = (task.steps ?? []).find((step) => /complete:/i.test(step));
  const fromStep = normalizeTaskAction(completeStep?.split(":").slice(1).join(":"));
  if (fromStep) return fromStep;
  if (/\bwatch\b|\bvideo\b/i.test(task.title)) return "watch" as const;
  return null;
}

function TaskDetail() {
  const { task } = Route.useLoaderData();
  const taskMeta = task as typeof task & TaskWithAction;
  const [started, setStarted] = useState(false);
  const [watchComplete, setWatchComplete] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proofText, setProofText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const platform = task.platform as Platform;
  const action = inferAction(taskMeta);
  const targetUrl = taskMeta.target_url ?? task.link;
  const actionAllowed = action ? isTaskActionAllowed(platform, action) : true;
  const isWatch = action === "watch";
  const canSubmit = !isWatch || watchComplete;

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await submitTaskGuarded({
        data: {
          taskId: task.id,
          proofText: proofText.trim() || undefined,
          proofUrl: targetUrl ?? undefined,
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
      <Link
        to="/tasks"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/50"
      >
        <ArrowLeft className="size-4" /> Tasks
      </Link>

      <div className="rounded-2xl border border-white/8 bg-[#12141c] p-4">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={platform} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
              {platformLabel(platform)} · {task.advertiser}
            </p>
            <h1 className="mt-0.5 text-lg font-bold leading-snug text-white">{task.title}</h1>
            {action ? (
              <span className="mt-2 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                {taskActionLabel(action)} task
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Meta label="Reward" value={`$${Number(task.reward).toFixed(2)}`} Icon={ShieldCheck} />
          <Meta label="Time" value={`${task.seconds}s`} Icon={Clock3} />
          <Meta label="Slots left" value={`${task.slots_left}`} Icon={Users} />
        </div>
      </div>

      {!actionAllowed ? (
        <section className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4">
          <p className="text-sm font-semibold text-red-200">Task configuration error</p>
          <p className="mt-1 text-xs leading-5 text-red-100/60">
            This task asks for {action ? taskActionLabel(action) : "an unsupported action"} on {platformLabel(platform)}. It is blocked instead of showing a task from another platform.
          </p>
        </section>
      ) : null}

      {isWatch && actionAllowed && targetUrl ? (
        <section className="mt-4 rounded-2xl border border-white/8 bg-[#12141c] p-3">
          <TaskActionPlayer url={targetUrl} onComplete={() => setWatchComplete(true)} />
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-white/8 bg-[#12141c] p-4">
        <h2 className="text-sm font-bold text-white">Task details</h2>
        {taskMeta.description ? (
          <p className="mt-2 text-sm leading-6 text-white/70">{taskMeta.description}</p>
        ) : null}
        {taskMeta.warning_text ? (
          <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/70">
            {taskMeta.warning_text}
          </div>
        ) : null}
        {taskMeta.instructions ? (
          <p className="mt-3 text-sm leading-6 text-white/70">{taskMeta.instructions}</p>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-white/8 bg-[#12141c] p-4">
        <h2 className="text-sm font-bold text-white">Steps</h2>
        <ol className="mt-3 space-y-3">
          {(task.steps ?? []).map((step: string, i: number) => (
            <li key={`${step}-${i}`} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-xs font-bold text-amber-300">
                {i + 1}
              </span>
              <p className="text-sm leading-6 text-white/80">{step}</p>
            </li>
          ))}
        </ol>
        {!isWatch && targetUrl ? (
          <a
            href={targetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block text-center text-sm font-semibold text-amber-300"
          >
            Open target →
          </a>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-white/8 bg-[#12141c] p-4">
        <h2 className="text-sm font-bold text-white">Verification</h2>
        <p className="mt-1 text-xs text-white/45">
          {isWatch
            ? watchComplete
              ? "Watch requirement completed. You can submit this task."
              : "You must complete the video before submission is unlocked."
            : "Submit the requested proof. Owner verification rules still apply."}
        </p>
        {!isWatch || watchComplete ? (
          <input
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            placeholder={task.proof === "username" ? "@yourusername" : "Optional proof note"}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/40"
          />
        ) : null}
        {error ? <p className="mt-2 text-xs text-amber-200">{error}</p> : null}
      </section>

      <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-md px-4 pb-2">
        {submitted ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/15 px-4 py-3.5 text-sm font-semibold text-amber-200">
            <CheckCircle2 className="size-4" /> Submitted — awaiting verification
          </div>
        ) : (
          <GoldButton
            disabled={busy || !actionAllowed || !canSubmit}
            onClick={() => (started ? void onSubmit() : setStarted(true))}
          >
            {busy
              ? "Submitting…"
              : started
                ? "Submit for verification"
                : isWatch && !watchComplete
                  ? "Watch video to continue"
                  : `Start task · $${Number(task.reward).toFixed(2)}`}
          </GoldButton>
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
    <div className="rounded-2xl border border-white/8 bg-black/25 px-2 py-3">
      <Icon className="mx-auto size-4 text-amber-300" />
      <p className="mt-1.5 text-sm font-bold leading-none text-white">{value}</p>
      <p className="mt-1 text-[11px] text-white/40">{label}</p>
    </div>
  );
}
