import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";
import { Screen } from "@/components/Screen";
import { PlatformBadge, platformLabel } from "@/components/PlatformIcon";
import type { Platform } from "@/components/PlatformIcon";
import { getTask, submitTask } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  loader: async ({ params }) => {
    const task = await getTask({ data: { taskId: params.taskId } }).catch(() => null);
    if (!task) throw notFound();
    return { task };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Task unavailable — TASKORA" }, { name: "robots", content: "noindex" }],
      };
    }
    const { task } = loaderData;
    return {
      meta: [
        { title: `${task.title} — TASKORA` },
        {
          name: "description",
          content: `${task.advertiser} · Earn $${Number(task.reward).toFixed(2)} for this verified task.`,
        },
      ],
    };
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

  const platform = task.platform as Platform;

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await submitTask({
        data: {
          taskId: task.id,
          proofText: proofText.trim() || undefined,
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
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
      >
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
          <Meta label="Reward" value={`$${Number(task.reward).toFixed(2)}`} Icon={ShieldCheck} />
          <Meta label="Time" value={`${task.seconds}s`} Icon={Clock3} />
          <Meta label="Slots left" value={`${task.slots_left}`} Icon={Users} />
        </div>
      </div>

      <section className="card-surface mt-4 p-4">
        <h2 className="text-sm font-bold">How to complete</h2>
        <ol className="mt-3 space-y-3">
          {(task.steps ?? []).map((step, i) => (
            <li key={`${step}-${i}`} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                {i + 1}
              </span>
              <p className="text-sm leading-6">{step}</p>
            </li>
          ))}
        </ol>
        {task.link ? (
          <a
            href={task.link}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block text-center text-sm font-semibold text-primary"
          >
            Open target
          </a>
        ) : null}
      </section>

      <section className="card-surface mt-4 p-4">
        <h2 className="text-sm font-bold">Verification</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Submissions stay pending until an owner/admin verifies them. Rewards are never released from a
          frontend click alone.
        </p>
        {task.proof === "username" || task.proof === "screenshot" || task.proof === "auto" ? (
          <input
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            placeholder={task.proof === "username" ? "@yourusername" : "Optional proof note / username"}
            className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        ) : null}
        {error ? <p className="mt-2 text-xs text-warning">{error}</p> : null}
      </section>

      <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-md px-4 pb-2">
        {submitted ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground shadow-raised">
            <CheckCircle2 className="size-4" />
            Submitted — awaiting verification
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={() => (started ? onSubmit() : setStarted(true))}
            className="bg-green-grad w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.99] disabled:opacity-60"
          >
            {busy
              ? "Submitting…"
              : started
                ? "Submit for verification"
                : `Start task · $${Number(task.reward).toFixed(2)}`}
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
      <p className="mt-1.5 text-sm font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
