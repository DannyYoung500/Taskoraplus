import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { listTasks } from "@/lib/taskora.functions";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd, isDemoTaskTitle } from "@/lib/taskora-display";

const CATEGORIES: { key: "all" | Platform; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Telegram", label: "Telegram" },
  { key: "YouTube", label: "YouTube" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "X", label: "X" },
  { key: "TikTok", label: "TikTok" },
  { key: "Instagram", label: "Instagram" },
];

export const Route = createFileRoute("/_authenticated/tasks/")({
  loader: async () => {
    const rows = await listTasks().catch(() => []);
    return { rows: rows.filter((task) => !isDemoTaskTitle(task.title)) };
  },
  head: () => ({ meta: [{ title: "Tasks — TASKORA" }] }),
  component: TasksScreen,
});

function TasksScreen() {
  const { rows } = Route.useLoaderData();
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const tasks = rows.filter((t) => filter === "all" || t.platform === filter);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full ring-2 ring-cyan-400/40" />
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-black tracking-[0.06em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Tasks
          </p>
          <p className="text-[10px] text-slate-500">Verified marketplace · real USDT rewards</p>
        </div>
        <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">
          {tasks.length} live
        </span>
      </header>

      <div className="mb-3.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
              filter === c.key ? "text-[#04101c]" : "border border-white/10 bg-[#0b1628] text-slate-400"
            }`}
            style={filter === c.key ? { background: BLUE_GRAD } : undefined}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-[#0b1628] p-8 text-center">
            <ClipboardCheck className="mx-auto size-8 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">No live tasks</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Publish from Advertise or Owner Center. Demo titles are hidden.
            </p>
          </div>
        ) : (
          tasks.map((t) => (
            <Link
              key={t.id}
              to="/tasks/$taskId"
              params={{ taskId: t.id }}
              className="flex items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1628] p-3.5 active:scale-[0.995]"
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/[0.04]">
                <PlatformIcon platform={t.platform as Platform} size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{t.title}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {t.platform}
                  {t.advertiser ? ` · ${t.advertiser}` : ""}
                  {t.seconds ? ` · ${t.seconds}s` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-black text-cyan-200">+{formatUsd(Number(t.reward))}</p>
                <span
                  className="mt-1 inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-black text-white"
                  style={{ background: BLUE_GRAD }}
                >
                  Start <ChevronRight className="size-3" />
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
