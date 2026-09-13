import { createFileRoute, Link } from "@tanstack/react-router";
import { getOwnerOverview } from "@/lib/taskora.functions";

const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

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
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
      <header className="mb-5 flex items-center gap-3">
        <img src={LOGO} alt="" className="size-10 rounded-full object-cover" />
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Owner</p>
          <h1 className="text-xl font-bold">Control Center</h1>
        </div>
      </header>

      {error ? (
        <p className="card-surface mb-4 p-4 text-sm text-warning">
          {error}
          <br />
          <span className="text-xs text-muted-foreground">
            Set TASKORA_OWNER_TELEGRAM_IDS to your Telegram user id on Vercel.
          </span>
        </p>
      ) : null}

      {overview ? (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <Stat label="Users" value={String(overview.totalUsers)} />
          <Stat label="Active tasks" value={String(overview.activeTasks)} />
          <Stat label="Pending reviews" value={String(overview.pendingReviews)} />
          <Stat label="Pending withdrawals" value={String(overview.pendingWithdrawals)} />
          <Stat label="Rewards paid" value={`$${Number(overview.rewardsPaid).toFixed(2)}`} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Link to="/owner/reviews" className="card-surface block p-4 text-sm font-semibold">
          Task review queue
        </Link>
        <Link to="/owner/withdrawals" className="card-surface block p-4 text-sm font-semibold">
          Withdrawal queue
        </Link>
        <Link to="/advertise" className="card-surface block p-4 text-sm font-semibold">
          Create / publish task
        </Link>
        <Link to="/home" className="card-surface block p-4 text-sm font-semibold text-muted-foreground">
          Back to worker home
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-primary">{value}</p>
    </div>
  );
}
