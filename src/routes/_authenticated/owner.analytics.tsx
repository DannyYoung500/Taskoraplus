import { createFileRoute } from "@tanstack/react-router";
import { ownerOverview } from "@/lib/owner.functions";
import { getOwnerOverview } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/owner/analytics")({
  loader: async () => {
    try {
      const rich = await ownerOverview();
      return { rich, basic: null as null, error: null as string | null };
    } catch {
      try {
        const basic = await getOwnerOverview();
        return { rich: null, basic, error: null as string | null };
      } catch (e) {
        return {
          rich: null,
          basic: null,
          error: e instanceof Error ? e.message : "Owner required",
        };
      }
    }
  },
  component: OwnerAnalytics,
});

function OwnerAnalytics() {
  const { rich, basic, error } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Analytics</h1>
      <p className="mt-1 text-xs text-white/45">Growth · completions · payouts</p>
      {error ? <p className="mt-3 text-xs text-amber-200">{error}</p> : null}

      {rich ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Kpi label="Users" value={String(rich.totalUsers)} />
            <Kpi label="Active 7d" value={String(rich.activeUsers)} />
            <Kpi label="Rewards paid" value={`$${Number(rich.rewardsPaid).toFixed(0)}`} />
            <Kpi label="Withdrawals paid" value={`$${Number(rich.withdrawalsPaid).toFixed(0)}`} />
            <Kpi label="Deposits" value={`$${Number(rich.depositsTotal).toFixed(0)}`} />
            <Kpi label="Platform edge" value={`$${Number(rich.platformRevenue).toFixed(0)}`} />
          </div>
          <Chart title="User growth (30d)" series={rich.charts?.userGrowth ?? []} />
          <Chart title="Completions (30d)" series={rich.charts?.completions ?? []} />
          <Chart title="Withdrawals volume (30d)" series={rich.charts?.withdrawals ?? []} />
        </>
      ) : basic ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Kpi label="Users" value={String(basic.totalUsers)} />
          <Kpi label="Tasks" value={String(basic.activeTasks)} />
          <Kpi label="Pending reviews" value={String(basic.pendingReviews)} />
          <Kpi label="Rewards paid" value={`$${Number(basic.rewardsPaid).toFixed(2)}`} />
        </div>
      ) : null}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#12141c] p-3">
      <p className="text-[11px] text-white/45">{label}</p>
      <p className="mt-1 text-lg font-bold text-amber-300">{value}</p>
    </div>
  );
}

function Chart({ title, series }: { title: string; series: Array<{ day: string; value: number }> }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-semibold text-white/50">{title}</h2>
      <div className="flex h-24 items-end gap-0.5 rounded-2xl border border-white/8 bg-[#12141c] p-2">
        {series.slice(-30).map((s) => (
          <div
            key={s.day}
            title={`${s.day}: ${s.value}`}
            className="flex-1 rounded-t bg-amber-400/70"
            style={{ height: `${Math.max(4, (s.value / max) * 100)}%` }}
          />
        ))}
      </div>
    </section>
  );
}
