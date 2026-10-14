import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ComponentType } from "react";
import {
  ClipboardCheck,
  PlayCircle,
  Users,
  Bell,
  Megaphone,
  Crown,
  ChevronRight,
  CalendarCheck,
  WalletCards,
  ClipboardList,
  Trophy,
  Flame,
} from "lucide-react";
import { listTasks, getDashboard, dailyCheckin, syncMyTimezone } from "@/lib/taskora.functions";
import { AppLink } from "@/components/AppLink";
import { listDailyMissions } from "@/lib/daily-missions.functions";
import { recordSecuritySignal } from "@/lib/security-engine.functions";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { TaskCard } from "@/components/TaskCard";
import { TASKORA_LOGO, ACCENT_GRAD } from "@/lib/brand";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatUsd, isDemoTaskTitle, isDemoTransactionLabel } from "@/lib/taskora-display";

const LEVEL_REQUIREMENTS = [
  { tasks: 0, videos: 0, games: 0, ads: 0 },
  { tasks: 25, videos: 50, games: 25, ads: 50 },
  { tasks: 75, videos: 150, games: 75, ads: 150 },
  { tasks: 150, videos: 300, games: 150, ads: 300 },
  { tasks: 250, videos: 500, games: 250, ads: 500 },
  { tasks: 400, videos: 800, games: 400, ads: 800 },
  { tasks: 600, videos: 1200, games: 600, ads: 1200 },
  { tasks: 850, videos: 1700, games: 850, ads: 1700 },
  { tasks: 1200, videos: 2400, games: 1200, ads: 2400 },
  { tasks: 1600, videos: 3200, games: 1600, ads: 3200 },
  { tasks: 2100, videos: 4200, games: 2100, ads: 4200 },
  { tasks: 2700, videos: 5400, games: 2700, ads: 5400 },
  { tasks: 3400, videos: 6800, games: 3400, ads: 6800 },
  { tasks: 4200, videos: 8400, games: 4200, ads: 8400 },
  { tasks: 5000, videos: 10000, games: 5000, ads: 10000 },
] as const;

const getMyLevelStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
    const [tasks, videos, games, ads] = await Promise.all([
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("status", "verified"),
      supabaseAdmin.from("watch_video_sessions").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("status", "completed"),
      supabaseAdmin.from("game_rounds").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("status", "completed"),
      supabaseAdmin.from("watch_completions").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
    ]);
    const activity = { tasks: tasks.count ?? 0, videos: videos.count ?? 0, games: games.count ?? 0, ads: ads.count ?? 0 };
    let level = 1;
    for (let i = 1; i < LEVEL_REQUIREMENTS.length; i += 1) {
      const req = LEVEL_REQUIREMENTS[i];
      if (activity.tasks >= req.tasks && activity.videos >= req.videos && activity.games >= req.games && activity.ads >= req.ads) level = i + 1;
      else break;
    }
    const next = LEVEL_REQUIREMENTS[Math.min(level, LEVEL_REQUIREMENTS.length - 1)];
    const progress =
      level >= LEVEL_REQUIREMENTS.length
        ? 100
        : Math.min(
            99,
            Math.round(
              Math.min(
                activity.tasks / Math.max(1, next.tasks),
                activity.videos / Math.max(1, next.videos),
                activity.games / Math.max(1, next.games),
                activity.ads / Math.max(1, next.ads),
              ) * 100,
            ),
          );
    return { level, progress };
  });

export const Route = createFileRoute("/_authenticated/home")({
  loader: async () => {
    const [tasks, dash, missions, levelStats] = await Promise.all([
      listTasks().catch(() => []),
      getDashboard().catch(() => null),
      listDailyMissions().catch(() => []),
      getMyLevelStats().catch(() => ({ level: 1, progress: 0 })),
    ]);
    return {
      tasks: tasks.filter((task) => !isDemoTaskTitle(task.title)).slice(0, 4),
      dash,
      missions,
      levelStats,
    };
  },
  component: HomePage,
});

function HomePage() {
  const { tasks, dash, missions, levelStats } = Route.useLoaderData();
  const transactions = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const rawBalance = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const balance = rawBalance <= 0.00005 ? 0 : Math.max(0, rawBalance);
  const pending = (dash?.submissions ?? [])
    .filter((s) => s.status === "pending" && !isDemoTaskTitle(s.tasks?.title))
    .reduce((sum, s) => sum + Number(s.tasks?.reward ?? 0), 0);

  const profile = dash?.profile as
    | { display_name?: string | null; photo_url?: string | null; streak?: number; level_num?: number | null }
    | null;

  const name = profile?.display_name ?? "Tasker";
  const photo = profile?.photo_url ?? null;
  const streak = Number(profile?.streak ?? 0);
  const level = Number(levelStats?.level ?? profile?.level_num ?? 1);
  const levelProgress = Number(levelStats?.progress ?? 0);

  useEffect(() => {
    syncMyTimezone().catch(() => {});
    recordSecuritySignal({ signal: "home_view" }).catch(() => {});
  }, []);

  const [checking, setChecking] = useState(false);
  const onCheckin = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await dailyCheckin();
    } catch {
      /* ignore */
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <header className="mb-4 flex items-center gap-3">
        <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full object-cover" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-neutral-50">Hi, {name}</p>
          <p className="text-[11px] text-neutral-500">Level {level} · Streak {streak}d</p>
        </div>
        <AppLink to="/notifications" className="flex size-9 items-center justify-center rounded-full bg-[#121212]">
          <Bell className="size-4 text-neutral-400" />
        </AppLink>
      </header>

      <section className="mb-4 rounded-2xl bg-[#121212] p-4">
        <p className="text-[11px] text-neutral-500">Available balance</p>
        <p className="mt-1 text-[28px] font-bold tracking-tight text-emerald-400">{formatUsd(balance)}</p>
        <p className="mt-0.5 text-[11px] text-neutral-500">Pending {formatUsd(pending)}</p>
        <div className="mt-3 flex gap-2">
          <AppLink
            to="/wallet"
            className="flex-1 rounded-full py-2.5 text-center text-[12px] font-bold text-white"
            style={{ background: ACCENT_GRAD }}
          >
            Wallet
          </AppLink>
          <button
            type="button"
            onClick={onCheckin}
            disabled={checking}
            className="flex-1 rounded-full bg-white/10 py-2.5 text-[12px] font-bold text-neutral-100 active:opacity-80 disabled:opacity-50"
          >
            {checking ? "..." : "Daily check-in"}
          </button>
        </div>
      </section>

      <section className="mb-4">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-orange-500" />
          <p className="text-[12px] font-medium text-neutral-400">Quick actions</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Quick to="/tasks" label="Tasks" Icon={ClipboardList} />
          <Quick to="/watch-earn" label="Watch" Icon={PlayCircle} />
          <Quick to="/my-tasks" label="My tasks" Icon={ClipboardCheck} />
          <Quick to="/leaderboard" label="Ranks" Icon={Trophy} />
        </div>
      </section>

      <section className="mb-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-200">
            <Flame className="size-3.5 text-orange-400" strokeWidth={1.75} /> Top tasks
          </p>
          <AppLink to="/tasks" className="text-[11px] font-normal text-orange-400">
            View all
          </AppLink>
        </div>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="rounded-2xl bg-[#121212] p-4 text-[13px] font-normal text-neutral-500">
              No tasks yet - check back soon
            </p>
          ) : (
            tasks.map((t: any) => (
              <TaskCard
                key={t.id}
                task={{
                  id: String(t.id),
                  platform: String(t.platform || ""),
                  title: String(t.title || ""),
                  advertiser: t.advertiser,
                  reward: Number(t.reward ?? 0),
                  points: t.points,
                  seconds: Number(t.seconds ?? 0),
                  slots_left: t.slots_left,
                  slots_total: t.slots_total,
                  featured: Boolean(t.featured),
                }}
              />
            ))
          )}
        </div>
      </section>

      {missions && missions.length > 0 ? (
        <section className="mb-4">
          <p className="mb-2 text-[13px] font-medium text-neutral-200">Daily missions</p>
          <div className="space-y-2">
            {missions.slice(0, 3).map((m: any) => (
              <div key={m.id || m.title} className="rounded-2xl bg-[#121212] px-3 py-2.5">
                <p className="text-[13px] font-medium text-neutral-100">{m.title || m.name}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">{m.description || m.reward_label || ""}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Quick({
  to,
  label,
  Icon,
}: {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <AppLink to={to} className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#121212] px-1 py-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500/15">
        <Icon className="size-4 text-orange-400" strokeWidth={1.75} />
      </span>
      <p className="truncate text-[10px] font-normal text-neutral-400">{label}</p>
    </AppLink>
  );
}
