import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, Users, Activity, Wallet, ClipboardCheck, ChevronRight } from "lucide-react";
import { ownerGetAnalytics } from "@/lib/owner-analytics.functions";

export const Route = createFileRoute("/_authenticated/owner/analytics")({
  loader: async () => {
    try {
      const data = await ownerGetAnalytics();
      return { data, error: null as string | null };
    } catch (e) {
      return {
        data: null as Awaited<ReturnType<typeof ownerGetAnalytics>> | null,
        error: e instanceof Error ? e.message : "Owner required",
      };
    }
  },
  component: OwnerAnalytics,
});

function OwnerAnalytics() {
  const { data, error } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="mt-1 text-xs text-white/45">Users · countries · presence · queues</p>
        </div>
        <Link
          to="/owner/users"
          className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200"
        >
          Users <ChevronRight className="size-3" />
        </Link>
      </div>

      {error ? <p className="mt-3 text-xs text-amber-200">{error}</p> : null}

      {data ? (
        <>
          <section className="mt-4 grid grid-cols-2 gap-2">
            <Kpi label="Total users" value={String(data.totalUsers)} icon={Users} tone="cyan" />
            <Kpi label="Online now" value={String(data.online)} icon={Activity} tone="green" />
            <Kpi label="Recent (1h)" value={String(data.recent)} icon={Activity} tone="amber" />
            <Kpi label="Offline" value={String(data.offline)} icon={Users} tone="slate" />
          </section>

          <section className="mt-3 grid grid-cols-3 gap-2">
            <Mini label="New 24h" value={String(data.new24h)} />
            <Mini label="New 7d" value={String(data.new7d)} />
            <Mini label="New 30d" value={String(data.new30d)} />
          </section>

          <section className="mt-3 grid grid-cols-2 gap-2">
            <Kpi label="Pending reviews" value={String(data.pendingReviews)} icon={ClipboardCheck} tone="gold" />
            <Kpi label="Pending payouts" value={String(data.pendingWithdrawals)} icon={Wallet} tone="purple" />
            <Kpi label="Rewards paid" value={`$${Number(data.rewardsPaid).toFixed(2)}`} icon={Wallet} tone="green" />
            <Kpi label="Active accounts" value={String(data.byStatus.active)} icon={Users} tone="cyan" />
          </section>

          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-black">
              <Globe className="size-4 text-cyan-300" /> Country heat map
            </h2>
            <p className="mb-2 text-[10px] text-white/40">Users · online now · share of base</p>
            {data.countries.length === 0 ? (
              <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/40">
                No country data yet. Run PRESENCE_COUNTRY_RUN_ONCE.sql and have users open the app.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.countries.map((c) => {
                  const pct = data.totalUsers > 0 ? Math.round((c.count / data.totalUsers) * 100) : 0;
                  const onlineN = Number((c as { online?: number }).online ?? 0);
                  return (
                    <div
                      key={c.name}
                      className="flex items-center gap-2 rounded-xl border border-white/8 bg-[#12141c] px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/90">
                        {c.name}
                      </span>
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] font-bold tabular-nums text-cyan-200">
                        {c.count}
                      </span>
                      <span
                        className={`w-10 text-right text-[10px] font-semibold tabular-nums ${
                          onlineN > 0 ? "text-emerald-300" : "text-white/25"
                        }`}
                      >
                        {onlineN > 0 ? `${onlineN} on` : "—"}
                      </span>
                      <span className="w-7 text-right text-[10px] text-white/35">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-5 grid grid-cols-3 gap-2">
            <Mini label="Active" value={String(data.byStatus.active)} />
            <Mini label="Suspended" value={String(data.byStatus.suspended)} />
            <Mini label="Banned" value={String(data.byStatus.banned)} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  tone: string;
}) {
  const toneMap: Record<string, string> = {
    cyan: "text-cyan-300",
    green: "text-emerald-300",
    amber: "text-amber-300",
    gold: "text-amber-200",
    purple: "text-violet-300",
    slate: "text-slate-300",
  };
  return (
    <div className="rounded-2xl border border-white/8 bg-[#12141c] p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`size-3.5 ${toneMap[tone] ?? "text-white/50"}`} />
        <p className="text-[11px] text-white/45">{label}</p>
      </div>
      <p className={`mt-1 text-lg font-bold tabular-nums ${toneMap[tone] ?? "text-amber-300"}`}>{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#12141c] px-2 py-2 text-center">
      <p className="text-sm font-extrabold tabular-nums text-white">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-white/35">{label}</p>
    </div>
  );
}
