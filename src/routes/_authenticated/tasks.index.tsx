import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { TaskCard } from "@/components/TaskCard";
import { CATEGORIES, TASKS } from "@/lib/taskora-data";
import type { Platform } from "@/components/PlatformIcon";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({
    meta: [
      { title: "Tasks — TASKORA" },
      {
        name: "description",
        content: "Browse verified social tasks across Telegram, YouTube, WhatsApp, X and more.",
      },
      { property: "og:title", content: "Tasks — TASKORA" },
      {
        property: "og:description",
        content: "Browse verified social tasks and earn real crypto rewards.",
      },
    ],
  }),
  component: TasksScreen,
});

function TasksScreen() {
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const list = TASKS.filter((t) => filter === "all" || t.platform === filter);

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
        {list.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {list.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No tasks here yet — check back soon.
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
