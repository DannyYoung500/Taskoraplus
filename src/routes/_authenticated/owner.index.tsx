import { createFileRoute, Link } from "@tanstack/react-router";
import { getOwnerOverview } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/owner/")({
  loader: async () => {
    try {
      const overview = await getOwnerOverview();
      return { overview, error: null as string | null };
    } catch (e) {
      return {
        overview: null,
        error: e instanceof Error ? e.message : "Owner access required",
      };
    }
  },
  component: OwnerHub,
});

function OwnerHub() {
  const { overview, error } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="text-xl font-bold">Owner Control</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Admin access is granted when your Telegram ID is in TASKORA_OWNER_TELEGRAM_IDS.
      </p>

      {error ? <p className="mt-4 text-sm text-warning">{error}</p> : null}

      {overview ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Users" value={String(overview.totalUsers)} />
          <Stat label="Active tasks" value={String(overview.activeTasks)} />
          <Stat label="Pending reviews" value={String(overview.pendingReviews)} />
          <Stat label="Pending withdrawals" value={String(overview.pendingWithdrawals)} />
          <Stat label="Rewards paid" value={`$${Number(overview.rewardsPaid).toFixed(2)}`} />
        </div>
      ) : null}

      <div className="mt-6 space-y-2">
        <Link to="/owner/reviews" className="card-surface block p-4 text-sm font-semibold">
          Task review queue
        </Link>
        <Link to="/owner/withdrawals" className="card-surface block p-4 text-sm font-semibold">
          Withdrawal queue
        </Link>
        <Link to="/advertise" className="card-surface block p-4 text-sm font-semibold">
          Create / publish task
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
