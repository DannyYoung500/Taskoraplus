import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, DollarSign, Search, Sparkles, Users } from "lucide-react";
import { listTasks } from "@/lib/taskora.functions";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { TASKORA_LOGO } from "@/lib/brand";
import { formatUsd, isDemoTaskTitle } from "@/lib/taskora-display";
import { AppLink } from "@/components/AppLink";

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
    const rows = await listTasks().catch(() => []);
    return { rows: rows.filter((task) => !isDemoTaskTitle(task.title)) };
  },
  head: () => ({ meta: [{ title: "Tasks — TASKORA" }] }),
  component: TasksScreen,
});

function difficultyLabel(d?: string | null) {
  const v = String(d || "easy").toLowerCase();
  if (v === "hard") return "HARD";
  if (v === "medium") return "MEDIUM";
  return "EASY";
}

function estimateMins(seconds?: number | null) {
  const s = Math.max(0, Number(seconds || 0));
  if (s <= 0) return "2 mins";
  if (s < 60) return `${s}s`;
  return `${Math.max(1, Math.round(s / 60))} mins`;
}

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
      const featuredA = Number((a as { featured?: boolean }).featured ? 1 : 0);
      const featuredB = Number((b as { featured?: boolean }).featured ? 1 : 0);
      return featuredB - featuredA || Number(b.reward) - Number(a.reward);
    });
  }, [rows, filter, query, sort]);

  const liveCount = tasks.length;
  const rewardPool = tasks.reduce(
    (s, t) => s + Number(t.reward || 0) * Math.max(1, Number(t.slots_left ?? 1)),
    0,
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <header className="mb-4 flex items-center gap-2.5">
        <img
          src={TASKORA_LOGO}
          alt=""
          className="size-9 rounded-full object-cover"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium text-neutral-50">Tasks</p>
          <p className="text-[11px] text-neutral-500">Verified · real USDT</p>
        </div>
      </header>

      <div className="mb-1 flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-orange-500" />
        <p className="text-[12px] font-medium text-neutral-400">Platform stats</p>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-[#121212] px-2.5 py-3 text-center">
          <span className="mx-auto mb-1.5 flex size-8 items-center justify-center rounded-xl bg-emerald-500/15">
            <CheckCircle2 className="size-4 text-emerald-400" strokeWidth={1.75} />
          </span>
          <p className="text-[18px] font-medium text-neutral-50">{liveCount}</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">Tasks available</p>
        </div>
        <div className="rounded-2xl bg-[#121212] px-2.5 py-3 text-center">
          <span className="mx-auto mb-1.5 flex size-8 items-center justify-center rounded-xl bg-sky-500/15">
            <DollarSign className="size-4 text-sky-400" strokeWidth={1.75} />
          </span>
          <p className="text-[18px] font-medium text-emerald-400">{formatUsd(rewardPool)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">Reward pool</p>
        </div>
        <div className="rounded-2xl bg-[#121212] px-2.5 py-3 text-center">
          <span className="mx-auto mb-1.5 flex size-8 items-center justify-center rounded-xl bg-orange-500/15">
            <Users className="size-4 text-orange-400" strokeWidth={1.75} />
          </span>
          <p className="text-[18px] font-medium text-neutral-50">—</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">Your referrals</p>
        </div>
      </div>

      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-600"
          strokeWidth={1.75}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks or platforms"
          className="w-full rounded-2xl bg-[#121212] py-3 pl-10 pr-3.5 text-[13px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-orange-500/30"
        />
      </div>

      <div className="mb-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="w-full appearance-none rounded-2xl bg-[#121212] px-3.5 py-2.5 text-[12px] text-neutral-400 outline-none"
        >
          <option value="recommended">Recommended</option>
          <option value="reward">Highest reward</option>
          <option value="slots">Most spots</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                active ? "bg-orange-500 text-[#0a0a0a]" : "bg-[#121212] text-neutral-400"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl bg-[#121212] px-4 py-12 text-center">
          <p className="text-[14px] font-medium text-neutral-300">No tasks right now</p>
          <p className="mt-1 text-[12px] text-neutral-600">
            Check back soon or try another platform filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const slotsLeft = Number(t.slots_left ?? 0);
            const slotsTotal = Number(t.slots_total ?? 0);
            const featured = Boolean((t as { featured?: boolean }).featured);
            const almostFull =
              slotsTotal > 0 && slotsLeft > 0 && slotsLeft / slotsTotal <= 0.2;
            const diff = difficultyLabel((t as { difficulty?: string }).difficulty);
            const secs = Number((t as { seconds?: number }).seconds ?? 0);

            return (
              <article key={t.id} className="rounded-2xl bg-[#121212] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a1a1a]">
                    <PlatformLogo platform={t.platform as Platform} size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium leading-snug text-neutral-50">
                          {t.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-neutral-500">
                          {platformLabel(t.platform as Platform)}
                        </p>
                      </div>
                      {featured ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">
                          <Sparkles className="size-2.5" /> Featured
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[18px] font-semibold text-emerald-400">
                        {formatUsd(Number(t.reward))}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                          {diff}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-1 text-[10px] font-medium text-neutral-400">
                          <Clock3 className="size-3" strokeWidth={1.75} />
                          {estimateMins(secs)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-neutral-600">
                        {slotsLeft}
                        {slotsTotal ? ` / ${slotsTotal}` : ""} spots available
                      </p>
                      {almostFull ? (
                        <span className="text-[11px] font-medium text-orange-400">Almost full!</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <AppLink
                  to="/tasks/$taskId"
                  params={{ taskId: String(t.id) }}
                  className="mt-3.5 flex w-full items-center justify-center rounded-xl bg-orange-500 py-3 text-[14px] font-medium text-[#0a0a0a]"
                >
                  Start Task
                </AppLink>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
