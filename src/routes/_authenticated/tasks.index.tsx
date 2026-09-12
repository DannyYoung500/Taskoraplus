import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { TaskCard } from "@/components/TaskCard";
import { CATEGORIES } from "@/lib/taskora-data";
import type { Platform } from "@/components/PlatformIcon";
import { listTasks } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/tasks/")({
  loader: async () => {
    const rows = await listTasks().catch(() => []);
    return { rows };
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
      status: "available" as const,
      slotsLeft: t.slots_left,
      steps: t.steps ?? [],
      proof: t.proof,
    }));

  return (
    <Screen>
      <ScreenTitle title="Tasks" subtitle="Verified tasks. Real rewards." />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                filter === c.key
                  ? "bg-green-grad text-primary-foreground shadow-glow"
                  : "bg-secondary text-secondary-foreground"
              }`}
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
          <p className="py-12 text-center text-sm text-muted-foreground">
            No tasks available. Owner must publish real campaigns.
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
