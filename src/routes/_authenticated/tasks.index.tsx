import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { listTasks } from "@/lib/taskora.functions";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { TASKORA_LOGO } from "@/lib/brand";
import { formatUsd, isDemoTaskTitle } from "@/lib/taskora-display";
import { AppLink } from "@/components/AppLink";
import { PlatformStats, tasksStatsCards } from "@/components/PlatformStats";
import { getPlatformStats } from "@/lib/platform-stats.functions";

const CATEGORIES: { key: "all" | Platform; label: string }[] = [
  { key: "all", label: "All" },
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
    const [rows, stats] = await Promise.all([
      listTasks().catch(() => []),
      getPlatformStats().catch(() => null),
    ]);
    return {
      rows: rows.filter((task) => !isDemoTaskTitle(task.title)),
      stats,
    };
  },
  head: () => ({ meta: [{ title: "Tasks — TASKORA" }] }),
  component: TasksScreen,
});

function TasksScreen() {
  const { rows, stats: loaderStats } = Route.useLoaderData();
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recommended");
  const [stats, setStats] = useState(loaderStats);

  useEffect(() => {
    if (loaderStats) setStats(loaderStats);
  }, [loaderStats]);

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
      const featuredA = Number((a as { featured?: boolean }).featured ? 1 : 0);
      const featuredB = Number((b as { featured?: boolean }).featured ? 1 : 0);
      return featuredB - featuredA || Number(b.reward) - Number(a.reward);
    });
  }, [rows, filter, query, sort]);

  const tasksAvailable = stats?.tasksAvailable ?? rows.length;
  const rewardPool =
    stats?.rewardPoolUsd ??
    Math.round(rows.reduce((s, t) => s + Number(t.reward ?? 0), 0) * 100) / 100;
  const referrals = stats?.referralsTotal ?? 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] px-4 pb-28 pt-4 text-neutral-100">
      <header className="mb-4 flex items-center gap-2.5">
        <img src={TASKORA_LOGO} alt="" className="size-9 rounded-lg object-cover" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold tracking-wide text-neutral-50">Tasks</p>
          <p className="text-[10px] font-normal text-neutral-500">Verified · real USDT</p>
        </div>
        <span className="text-[11px] font-medium text-orange-400">{tasksAvailable} live</span>
      </header>

      <PlatformStats
        cards={tasksStatsCards({
          tasksAvailable,
          rewardPoolUsd: rewardPool,
          referrals,
        })}
      />

      {/* Search + filters — soft surfaces */}
      <section className="mb-4 rounded-2xl bg-[#121212] p-3">
        <label className="flex items-center gap-2 rounded-xl bg-[#0a0a0a] px-3 py-2.5">
          <Search className="size-4 shrink-0 text-neutral-500" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks or platforms"
            className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-neutral-600"
          />
        </label>
        <div className="mt-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2 text-[12px] font-normal text-neutral-300 outline-none"
          >
            <option value="recommended">Recommended</option>
            <option value="reward">Highest reward</option>
            <option value="newest">Newest</option>
            <option value="slots">Most slots</option>
          </select>
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                filter === c.key
                  ? "bg-orange-500 text-white"
                  : "bg-[#1a1a1a] text-neutral-400"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {tasks.length === 0 ? (
        <div className="rounded-2xl bg-[#121212] p-10 text-center">
          <CheckCircle2 className="mx-auto size-8 text-neutral-600" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-neutral-400">No tasks match</p>
          <p className="mt-1 text-xs font-normal text-neutral-600">Try another filter or clear search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const task = t as typeof t & {
              description?: string | null;
              difficulty?: string | null;
              featured?: boolean | null;
            };
            const slotsLeft = Number(t.slots_left ?? 0);
            const slotsTotal = Number((t as { slots_total?: number }).slots_total ?? 0);
            const filled =
              slotsTotal > 0
                ? Math.min(100, Math.round(((slotsTotal - slotsLeft) / slotsTotal) * 100))
                : 0;
            return (
              <AppLink
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="block rounded-2xl bg-[#121212] p-3.5 active:opacity-90"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#0a0a0a]">
                    <PlatformLogo platform={t.platform as Platform} size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-neutral-100">{t.title}</p>
                      {task.featured ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-medium text-orange-400">
                          <Sparkles className="size-2.5" strokeWidth={1.75} /> Hot
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-normal text-neutral-500">
                      {t.advertiser ?? "TASKORA"} · {platformLabel(t.platform as Platform)}
                    </p>
                    {slotsTotal > 0 ? (
                      <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-orange-400/80" style={{ width: `${filled}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[13px] font-medium text-emerald-400">{formatUsd(Number(t.reward))}</span>
                    <ChevronRight className="size-4 text-neutral-600" strokeWidth={1.75} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3 text-[10px] font-normal text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3 text-neutral-500" strokeWidth={1.75} />
                    {Number(t.seconds ?? 0) ? `${t.seconds}s` : "Flex"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3 text-neutral-500" strokeWidth={1.75} />
                    {slotsLeft}
                    {slotsTotal ? `/${slotsTotal}` : ""} left
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-500/90">
                    <CheckCircle2 className="size-3" strokeWidth={1.75} /> Verified
                  </span>
                </div>
              </AppLink>
            );
          })}
        </div>
      )}
    </main>
  );
}
