import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, ShieldCheck, TrendingUp, Gift, ArrowRight } from "lucide-react";
import { Screen } from "@/components/Screen";
import { TaskCard } from "@/components/TaskCard";
import { TASKS, USER, ACHIEVEMENTS } from "@/lib/taskora-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TASKORA — Verified Tasks. Real Rewards." },
      {
        name: "description",
        content:
          "Complete verified social tasks on Telegram, YouTube, WhatsApp and more, and earn real crypto rewards with TASKORA.",
      },
      { property: "og:title", content: "TASKORA — Verified Tasks. Real Rewards." },
      {
        property: "og:description",
        content: "Earn real crypto rewards for verified social tasks, right inside Telegram.",
      },
    ],
  }),
  component: HomeScreen,
});

function HomeScreen() {
  const featured = TASKS.filter((t) => t.status === "available").slice(0, 4);

  return (
    <Screen>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <p className="text-lg font-bold leading-tight">{USER.name}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          {USER.level}
        </span>
      </div>

      <section className="bg-brand relative overflow-hidden rounded-3xl p-5 text-navy-foreground shadow-raised">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "var(--gradient-sheen)" }} />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.18em] opacity-70">Available balance</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">${USER.balance.toFixed(2)}</p>
          <div className="mt-3 flex gap-4 text-xs opacity-85">
            <span>Pending ${USER.pending.toFixed(2)}</span>
            <span>Lifetime ${USER.lifetime.toFixed(2)}</span>
          </div>
          <div className="mt-5 flex gap-2">
            <Link
              to="/wallet"
              className="bg-green-grad flex-1 rounded-2xl px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Withdraw
            </Link>
            <Link
              to="/tasks"
              className="flex-1 rounded-2xl border border-navy-foreground/25 px-4 py-3 text-center text-sm font-semibold"
            >
              Earn now
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2.5">
        <StatTile Icon={Flame} value={`${USER.streak} days`} label="Check-in streak" />
        <StatTile Icon={ShieldCheck} value={`${USER.verifiedTasks}`} label="Verified tasks" />
        <StatTile Icon={TrendingUp} value={`${USER.referrals}`} label="Referrals" />
      </section>

      <Link
        to="/ambassador"
        className="card-surface mt-4 flex items-center gap-3 p-4 active:scale-[0.99]"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-accent">
          <Gift className="size-5 text-accent-foreground" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">Channel Ambassador</p>
          <p className="text-xs text-muted-foreground">Earn from every tasker you bring in</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" />
      </Link>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Top tasks today</h2>
          <Link to="/tasks" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="space-y-2.5">
          {featured.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Achievements</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} className="card-surface p-3">
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{a.detail}</p>
              <p
                className={`mt-2 text-[11px] font-semibold ${a.done ? "text-success" : "text-muted-foreground"}`}
              >
                {a.done ? "Unlocked" : "Locked"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </Screen>
  );
}

function StatTile({
  Icon,
  value,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="card-surface p-3">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-sm font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
