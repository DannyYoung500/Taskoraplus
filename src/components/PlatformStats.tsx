import type { ComponentType } from "react";
import { CheckSquare, Play, Users, DollarSign, Gift, Flame } from "lucide-react";

export type StatCard = {
  key: string;
  value: string | number;
  label: string;
  tone: "rose" | "emerald" | "orange" | "violet" | "sky" | "amber";
  Icon: ComponentType<{ className?: string }>;
};

const TONE: Record<
  StatCard["tone"],
  { iconColor: string }
> = {
  rose: { iconColor: "text-rose-400" },
  emerald: { iconColor: "text-emerald-400" },
  orange: { iconColor: "text-orange-400" },
  violet: { iconColor: "text-violet-400" },
  sky: { iconColor: "text-sky-400" },
  amber: { iconColor: "text-amber-400" },
};

/** Soft platform stats — no heavy borders, light type */
export function PlatformStats({
  title = "Platform stats",
  cards,
}: {
  title?: string;
  cards: StatCard[];
}) {
  if (!cards.length) return null;
  return (
    <section className="mb-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-orange-400" />
        <p className="text-[13px] font-medium text-neutral-200">{title}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => {
          const t = TONE[c.tone];
          return (
            <div
              key={c.key}
              className="flex flex-col items-center rounded-2xl bg-[#141414] px-2 py-3.5 text-center"
            >
              <c.Icon className={`mb-2 size-4 ${t.iconColor}`} strokeWidth={1.75} />
              <p className="text-[17px] font-semibold tabular-nums tracking-tight text-neutral-50">
                {c.value}
              </p>
              <p className="mt-1 text-[9px] font-normal leading-tight text-neutral-500">{c.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
      tone: "emerald",
      Icon: CheckSquare,
    },
    {
      key: "rewards",
      value:
        opts.rewardPoolUsd >= 1
          ? `$${opts.rewardPoolUsd.toFixed(0)}`
          : `$${opts.rewardPoolUsd.toFixed(2)}`,
      label: "Reward pool",
      tone: "sky",
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
      tone: "rose",
      Icon: Play,
    },
    {
      key: "earn",
      value:
        opts.totalEarnableUsd >= 1
          ? `$${opts.totalEarnableUsd.toFixed(0)}`
          : `$${opts.totalEarnableUsd.toFixed(2)}`,
      label: "Earnable now",
      tone: "orange",
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
      tone: "emerald",
      Icon: CheckSquare,
    });
  }
  return cards;
}
