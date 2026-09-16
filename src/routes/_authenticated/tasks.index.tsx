import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { TaskCard } from "@/components/TaskCard";
import { CATEGORIES } from "@/lib/taskora-data";
import type { Platform } from "@/components/PlatformIcon";
import { normalizeTaskAction } from "@/lib/task-actions";
import { listTasks } from "@/lib/taskora.functions";
import { isDemoTaskTitle } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/tasks/")({
  loader: async () => {
    const rows = await listTasks().catch(() => []);
    return { rows: rows.filter((task) => !isDemoTaskTitle(task.title)) };
  },
  head: () => ({
    meta: [
      { title: "Tasks — TASKORA" },
      {
        name: "description",
        content: "Browse verified social tasks across Telegram, YouTube, WhatsApp, X and more.",
      },
    ],
  }),
  component: TasksScreen,
});

function TasksScreen() {
  const { rows } = Route.useLoaderData();
  const [filter, setFilter] = useState<"all" | Platform>("all");

  const tasks = rows
    .filter((t) => filter === "all" || t.platform === filter)
    .map((t) => ({
      id: t.id,
      platform: t.platform as Platform,
      title: t.title,
      advertiser: t.advertiser,
      reward: Number(t.reward),
      seconds: t.seconds,
      taskType: normalizeTaskAction(
        (t as unknown as { task_type?: string | null }).task_type ??
          ((t.steps ?? []).find((step) => /complete:/i.test(step))?.split(":").slice(1).join(":") ?? null),
      ),
    }));

  return (
    <Screen>
      <ScreenTitle title="Tasks" subtitle="Verified tasks. Real rewards." />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                filter === c.key
                  ? "text-[#05070c] shadow-[0_0_20px_rgba(245,197,66,0.25)]"
                  : "border border-white/10 bg-white/5 text-white/60"
              }`}
              style={
                filter === c.key
                  ? { background: "linear-gradient(135deg,#FFE08A,#F5C542,#C9961A)" }
                  : undefined
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] py-12 text-center text-sm text-white/45">
            No tasks available. Owner must publish from Advertise.
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
