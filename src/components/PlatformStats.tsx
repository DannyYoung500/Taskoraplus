import type { ComponentType, ReactNode } from "react";
import { CheckSquare, Play, Users, DollarSign, Gift, Flame } from "lucide-react";

export type StatCard = {
  key: string;
  value: string | number;
  label: string;
  /** icon tone */
  tone: "pink" | "green" | "orange" | "cyan" | "amber" | "violet";
  Icon: ComponentType<{ className?: string }>;
};

const TONE: Record<
  StatCard["tone"],
  { iconBg: string; iconColor: string; valueColor: string }
> = {
  pink: {
    iconBg: "bg-[#3a1a2e]",
    iconColor: "text-pink-400",
    valueColor: "text-white",
  },
  green: {
    iconBg: "bg-[#16301f]",
    iconColor: "text-emerald-400",
    valueColor: "text-white",
  },
  orange: {
    iconBg: "bg-[#3a2810]",
    iconColor: "text-orange-400",
    valueColor: "text-white",
  },
  cyan: {
    iconBg: "bg-[#0f2a36]",
    iconColor: "text-cyan-400",
    valueColor: "text-white",
  },
  amber: {
    iconBg: "bg-[#3a3010]",
    iconColor: "text-amber-400",
    valueColor: "text-white",
  },
  violet: {
    iconBg: "bg-[#2a1a3a]",
    iconColor: "text-violet-400",
    valueColor: "text-white",
  },
};

/** Screenshot-style Platform stats row (3 cards). */
export function PlatformStats({
  title = "Platform stats",
  cards,
}: {
  title?: string;
  cards: StatCard[];
}) {
  if (!cards.length) return null;
  return (
    <section className="mb-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-orange-400" />
        <p className="text-[13px] font-bold text-slate-100">{title}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => {
          const t = TONE[c.tone];
          return (
            <div
              key={c.key}
              className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-[#12151c] px-2 py-3 text-center shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
            >
              <span
                className={`mb-2 inline-flex size-9 items-center justify-center rounded-xl ${t.iconBg}`}
              >
                <c.Icon className={`size-4 ${t.iconColor}`} />
              </span>
              <p className={`text-[18px] font-black leading-none tabular-nums ${t.valueColor}`}>
                {c.value}
              </p>
              <p className="mt-1.5 text-[9px] font-medium leading-tight text-slate-500">{c.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Helpers to build common cards */
export function tasksStatsCards(opts: {
  tasksAvailable: number;
  rewardPoolUsd: number;
  referrals: number;
}): StatCard[] {
  return [
    {
      key: "tasks",
      value: opts.tasksAvailable,
      label: "Tasks available",
      tone: "green",
      Icon: CheckSquare,
    },
    {
      key: "rewards",
      value:
        opts.rewardPoolUsd >= 1
          ? `$${opts.rewardPoolUsd.toFixed(0)}`
          : `$${opts.rewardPoolUsd.toFixed(2)}`,
      label: "Reward pool",
      tone: "cyan",
      Icon: DollarSign,
    },
    {
      key: "refs",
      value: opts.referrals,
      label: "Your referrals",
      tone: "orange",
      Icon: Users,
    },
  ];
}

export function watchStatsCards(opts: {
  videosToWatch: number;
  totalEarnableUsd: number;
  bonusLeft?: number;
}): StatCard[] {
  const cards: StatCard[] = [
    {
      key: "videos",
      value: opts.videosToWatch,
      label: "Videos to watch",
      tone: "pink",
      Icon: Play,
    },
    {
      key: "earn",
      value:
        opts.totalEarnableUsd >= 1
          ? `$${opts.totalEarnableUsd.toFixed(0)}`
          : `$${opts.totalEarnableUsd.toFixed(2)}`,
      label: "Earnable now",
      tone: "cyan",
      Icon: Flame,
    },
  ];
  if (opts.bonusLeft != null) {
    cards.push({
      key: "bonus",
      value: opts.bonusLeft,
      label: "Bonus ads left",
      tone: "amber",
      Icon: Gift,
    });
  } else {
    cards.push({
      key: "ready",
      value: opts.videosToWatch > 0 ? "Live" : "—",
      label: "Feed status",
      tone: "green",
      Icon: CheckSquare,
    });
  }
  return cards;
}
