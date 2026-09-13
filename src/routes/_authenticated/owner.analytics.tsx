import { createFileRoute } from "@tanstack/react-router";
import { getOwnerOverview } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/owner/analytics")({
  loader: async () => {
    try {
      const basic = await getOwnerOverview();
      return { basic, error: null as string | null };
    } catch (e) {
      return {
        basic: null,
        error: e instanceof Error ? e.message : "Owner required",
      };
    }
  },
  component: OwnerAnalytics,
});

function OwnerAnalytics() {
  const { basic, error } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Analytics</h1>
      <p className="mt-1 text-xs text-white/45">Core platform metrics</p>
      {error ? <p className="mt-3 text-xs text-amber-200">{error}</p> : null}
      {basic ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Kpi label="Users" value={String(basic.totalUsers)} />
          <Kpi label="Active tasks" value={String(basic.activeTasks)} />
          <Kpi label="Pending reviews" value={String(basic.pendingReviews)} />
          <Kpi label="Pending withdrawals" value={String(basic.pendingWithdrawals)} />
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
