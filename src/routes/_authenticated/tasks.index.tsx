import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { listTasks } from "@/lib/taskora.functions";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd, isDemoTaskTitle } from "@/lib/taskora-display";

const CATEGORIES: { key: "all" | Platform; label: string }[] = [
  { key: "all", label: "All tasks" },
  { key: "telegram", label: "Telegram" },
  { key: "youtube", label: "YouTube" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "x", label: "X" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
];

type SortMode = "recommended" | "reward" | "newest" | "slots";

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recommended");

  const tasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((task) => {
      const platformMatch = filter === "all" || task.platform === filter;
      if (!platformMatch) return false;
      if (!q) return true;
      return [task.title, task.advertiser, task.platform]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });

    return [...filtered].sort((a, b) => {
      if (sort === "reward") return Number(b.reward) - Number(a.reward);
      if (sort === "slots") return Number(b.slots_left ?? 0) - Number(a.slots_left ?? 0);
      if (sort === "newest") {
        return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      }
      const featuredA = Number((a as any).featured ? 1 : 0);
      const featuredB = Number((b as any).featured ? 1 : 0);
      return featuredB - featuredA || Number(b.reward) - Number(a.reward);
    });
  }, [rows, filter, query, sort]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl overflow-x-hidden bg-[#030814] px-4 pb-28 pt-4 text-white sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <img src={TASKORA_LOGO} alt="" className="size-11 rounded-full ring-2 ring-cyan-400/40" />
        <div className="min-w-0 flex-1">
          <p
            className="text-xl font-black tracking-[0.04em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Task Marketplace
          </p>
          <p className="text-xs text-slate-500">Browse verified tasks and earn real USDT rewards.</p>
        </div>
        <span className="hidden rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 sm:inline-flex">
          {rows.length} available
        </span>
      </header>

      <section className="mb-4 rounded-3xl border border-white/8 bg-[#081426] p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3">
            <Search className="size-4 shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, platforms or campaigns"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 sm:w-52">
            <SlidersHorizontal className="size-4 shrink-0 text-slate-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="w-full bg-transparent text-sm text-slate-200 outline-none"
            >
              <option value="recommended">Recommended</option>
              <option value="reward">Highest reward</option>
              <option value="newest">Newest</option>
              <option value="slots">Most slots</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className="shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold transition"
              style={
                filter === c.key
                  ? { background: BLUE_GRAD, color: "#04101c" }
                  : undefined
              }
              data-inactive={filter !== c.key}
            >
              {filter === c.key ? c.label : <span className="rounded-full border border-white/10 bg-[#0b1628] px-0.5 text-slate-400">{c.label}</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-black">Available now</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} match your filters
          </p>
        </div>
        {query || filter !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="text-[11px] font-bold text-cyan-300"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-3xl border border-white/8 bg-[#0b1628] p-10 text-center">
          <CheckCircle2 className="mx-auto size-9 text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-300">No tasks match right now</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Try another platform or search term. New tasks appear here as campaigns become available.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tasks.map((t) => {
            const task = t as typeof t & {
              description?: string | null;
              difficulty?: string | null;
              featured?: boolean | null;
              advertiserProfile?: {
                displayName: string;
                username: string | null;
                verified: boolean;
                level: string;
                streak: number;
              } | null;
            };
            const reward = formatUsd(Number(t.reward));
            const seconds = Number(t.seconds ?? 0);
            return (
              <Link
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="group rounded-3xl border border-white/8 bg-[#0b1628] p-4 transition-colors hover:border-cyan-400/20 hover:bg-[#0d1b31] active:scale-[0.995]"
              >
                <div className="flex items-start gap-3">
                  <PlatformLogo platform={t.platform as Platform} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-sm font-bold leading-5">{t.title}</p>
                      {task.featured ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-1 text-[9px] font-bold text-cyan-200">
                          <Sparkles className="size-3" /> Featured
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {platformLabel(t.platform as Platform)}
                      {t.advertiser ? ` · ${t.advertiser}` : ""}
                    </p>
                  </div>
                </div>

                {task.description ? (
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{task.description}</p>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Info icon={<span className="text-cyan-300">$</span>} label="Reward" value={reward} />
                  <Info icon={<Clock3 className="size-3.5 text-cyan-300" />} label="Time" value={seconds ? `${seconds}s` : "Flexible"} />
                  <Info icon={<Users className="size-3.5 text-cyan-300" />} label="Slots" value={String(t.slots_left ?? 0)} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/6 pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    Verified task
                    {task.difficulty ? ` · ${task.difficulty}` : ""}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                    View task <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/20 px-2.5 py-2.5">
      <div className="flex items-center gap-1.5">{icon}<span className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">{label}</span></div>
      <p className="mt-1 text-xs font-black text-slate-200">{value}</p>
    </div>
  );
}
