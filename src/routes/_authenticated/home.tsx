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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      tasks: tasks.filter((task) => !isDemoTaskTitle(task.title)).slice(0, 8),
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
  const streak = profile?.streak ?? 0;
  const levelNum = Number(levelStats?.level ?? profile?.level_num ?? 1);
  const progressPct = Number(levelStats?.progress ?? 0);
  const isOwner = Boolean(dash?.isOwner);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) void syncMyTimezone({ data: { timezone } }).catch(() => {});
    let cancelled = false;
    void (async () => {
      try {
        const nav = navigator;
        const stable = [
          nav.userAgent,
          nav.platform,
          nav.language,
          timezone,
          String(nav.hardwareConcurrency ?? ""),
          String((nav as Navigator & { deviceMemory?: number }).deviceMemory ?? ""),
          String(window.screen?.width ?? ""),
          String(window.screen?.height ?? ""),
          String(window.screen?.colorDepth ?? ""),
          String(window.devicePixelRatio ?? ""),
        ].join("|");
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable));
        const deviceFp = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (!cancelled) {
          await recordSecuritySignal({
            data: {
              deviceFp,
              timezone,
              language: nav.language,
              screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
            },
          });
        }
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);

  async function onCheckin() {
    setCheckBusy(true);
    setCheckMsg(null);
    try {
      const r = await dailyCheckin();
      setCheckMsg(r.already ? `Already checked in · streak ${r.streak}` : `Day ${r.streak} · Check-in complete`);
    } catch (e) {
      setCheckMsg(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <header className="mb-4 flex items-center gap-2.5">
        <img src={TASKORA_LOGO} alt="TASKORA" className="size-9 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold tracking-wide text-neutral-50">TASKORA</p>
          <p className="text-[10px] font-normal text-neutral-500">Earn · Watch · Grow</p>
        </div>
        <AppLink to="/notifications" aria-label="Notifications" className="p-2 text-neutral-400">
          <Bell className="size-5" strokeWidth={1.75} />
        </AppLink>
        <AppLink to="/profile" className="flex items-center gap-1.5 rounded-full bg-[#141414] py-1 pl-1 pr-2.5">
          {photo ? (
            <img src={photo} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-neutral-300">
              {name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="max-w-[64px] truncate text-[11px] font-medium text-neutral-200">{name}</p>
            <p className="text-[9px] font-normal text-neutral-500">Level {levelNum}</p>
          </div>
        </AppLink>
      </header>

      {isOwner ? (
        <AppLink
          to="/owner"
          className="mb-3 flex items-center justify-between rounded-2xl bg-orange-500/10 px-3.5 py-2.5 text-[12px] font-medium text-orange-200"
        >
          <span className="inline-flex items-center gap-2">
            <Crown className="size-4" strokeWidth={1.75} /> Owner Control Center
          </span>
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </AppLink>
      ) : null}

      <section className="relative mb-4 overflow-hidden rounded-2xl bg-[#121212] p-4">
        <p className="text-[11px] font-normal text-neutral-500">Total balance</p>
        <p className="mt-1.5 text-[36px] font-semibold leading-none tracking-tight text-neutral-50">
          {formatUsd(balance)}
        </p>
        <p className="mt-2 text-[12px] font-normal text-neutral-500">
          Available {formatUsd(balance)}
          {pending > 0 ? <span> · Pending {formatUsd(pending)}</span> : null}
        </p>
        <AppLink
          to="/wallet"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium text-white"
          style={{ background: ACCENT_GRAD }}
        >
          <WalletCards className="size-3.5" strokeWidth={1.75} />
          Withdraw
        </AppLink>
      </section>

      <section className="mb-4">
        <div className="grid grid-cols-3 gap-2">
          <Quick to="/tasks" label="Tasks" Icon={ClipboardCheck} />
          <Quick to="/watch-earn" label="Watch" Icon={PlayCircle} />
          <Quick to="/advertise" label="Advertise" Icon={Megaphone} />
          <Quick to="/leaderboard" label="Rank" Icon={Trophy} />
          <Quick to="/ambassador" label="Invite" Icon={Users} />
          <Quick to="/my-tasks" label="My orders" Icon={ClipboardList} />
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-[#121212] p-3.5">
        <div className="flex items-center gap-3">
          <Trophy className="size-5 shrink-0 text-orange-400" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-neutral-100">Level {levelNum}</p>
            <p className="text-[11px] font-normal text-neutral-500">Keep going for the next level</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-medium text-orange-400">{progressPct}%</p>
            <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-orange-400" style={{ width: progressPct + "%" }} />
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        disabled={checkBusy}
        onClick={() => void onCheckin()}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-[#121212] px-3.5 py-3 text-left active:opacity-90"
      >
        <CalendarCheck className="size-5 shrink-0 text-orange-400" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-neutral-100">Daily check-in</p>
          <p className="truncate text-[11px] font-normal text-neutral-500">
            {checkMsg ?? `Streak ${streak}d · claim today's reward`}
          </p>
        </div>
        <span className="text-[11px] font-medium text-orange-400">{checkBusy ? "…" : "Claim"}</span>
      </button>

      <section className="mb-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-medium text-neutral-200">Daily missions</p>
          <AppLink to="/daily-missions" className="text-[11px] font-normal text-orange-400">
            View all
          </AppLink>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {missions.slice(0, 3).map((m: any) => (
            <AppLink key={m.id} to="/daily-missions" className="rounded-2xl bg-[#121212] p-2.5 active:opacity-90">
              {m.mission_type === "rewarded_ad" ? (
                <PlayCircle className="size-4 text-orange-400" strokeWidth={1.75} />
              ) : (
                <ClipboardCheck className="size-4 text-emerald-400" strokeWidth={1.75} />
              )}
              <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-tight text-neutral-200">{m.title}</p>
              <p className="mt-1 text-[10px] font-normal text-orange-400">
                {Number(m.reward_usdt) > 0 ? formatUsd(m.reward_usdt) : "Bonus"}
              </p>
            </AppLink>
          ))}
          {missions.length === 0 ? (
            <p className="col-span-3 rounded-2xl bg-[#121212] p-4 text-center text-[12px] font-normal text-neutral-600">
              No missions today
            </p>
          ) : null}
        </div>
      </section>

      <section>
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
              No tasks yet — check back soon
            </p>
          ) : (
            tasks.map((t: { id: string; title: string; reward: number; platform: string; advertiser?: string; seconds?: number; featured?: boolean }) => (
              <article key={t.id} className="rounded-2xl bg-[#121212] p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a1a1a]">
                    <PlatformLogo platform={t.platform as Platform} size={26} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-neutral-50">{t.title}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {platformLabel(t.platform as Platform)}
                        </p>
                      </div>
                      {t.featured ? (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-400">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[16px] font-semibold text-emerald-400">
                        {formatUsd(Number(t.reward))}
                      </span>
                      <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-400">
                        EASY
                      </span>
                    </div>
                  </div>
                </div>
                <AppLink
                  to="/tasks/$taskId"
                  params={{ taskId: String(t.id) }}
                  className="mt-3 flex w-full items-center justify-center rounded-xl bg-orange-500 py-2.5 text-[13px] font-medium text-[#0a0a0a]"
                >
                  Start Task
                </AppLink>
              </article>
            ))
          )}
        </div>
      </section>
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
    <AppLink
      to={to}
      className="flex min-h-[64px] flex-col items-center justify-center rounded-2xl bg-[#121212] px-1 py-2.5 text-center active:opacity-90"
    >
      <Icon className="size-5 text-orange-400" strokeWidth={1.75} />
      <p className="mt-1.5 w-full truncate text-[10px] font-normal text-neutral-400">{label}</p>
    </AppLink>
  );
}
