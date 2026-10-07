import { createFileRoute } from "@tanstack/react-router";
import { getPublicPlatformStats } from "@/lib/strong-wave.functions";
import { getPublicPayoutLedger } from "@/lib/strong-next.functions";
import { getVerifiedSparkline } from "@/lib/strong-more.functions";
import { TASKORA_LOGO } from "@/lib/brand";

export const Route = createFileRoute("/ledger")({
  head: () => ({ meta: [{ title: "Public ledger — TASKORA" }] }),
  loader: async () => {
    const [stats, payouts, spark] = await Promise.all([
      getPublicPlatformStats().catch(() => ({ verifiedToday: 0, paidWeekUsd: 0 })),
      getPublicPayoutLedger().catch(() => []),
      getVerifiedSparkline().catch(() => []),
    ]);
    return { stats, payouts: payouts ?? [], spark: spark ?? [] };
  },
  component: PublicLedgerPage,
});

function Sparkline({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="mt-3 flex h-16 items-end gap-1.5">
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.count / max) * 56));
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] tabular-nums text-cyan-200/80">{d.count}</span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-cyan-300"
              style={{ height: h }}
              title={`${d.day}: ${d.count}`}
            />
            <span className="text-[8px] text-white/35">{d.day.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function PublicLedgerPage() {
  const { stats, payouts, spark } = Route.useLoaderData();
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05080f] px-4 pb-16 pt-8 text-white">
      <div className="flex items-center gap-3">
        <img src={TASKORA_LOGO} alt="TASKORA" className="size-11 rounded-full ring-1 ring-cyan-400/40" />
        <div>
          <h1 className="text-xl font-black tracking-tight">Public ledger</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
            Real counts · masked payouts
          </p>
        </div>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#0a1f3d] to-[#061329] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">Verified today</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">
            {Number(stats.verifiedToday ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] text-white/40">Approved task proofs</p>
        </div>
        <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-[#062a2a] to-[#07172a] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Paid this week</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-emerald-200">
            ${Number(stats.paidWeekUsd ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] text-white/40">Successful withdrawals</p>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-cyan-400/15 bg-[#0b1628] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">
          Verified tasks · last 7 days
        </p>
        {(spark as { day: string; count: number }[]).length > 0 ? (
          <Sparkline data={spark as { day: string; count: number }[]} />
        ) : (
          <p className="mt-3 text-[12px] text-white/40">No verification data yet.</p>
        )}
      </section>

      <section className="mt-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white/50">Recent paid withdrawals</p>
        {(payouts as Array<{
          id: string; amount: number; method: string; addressMasked: string;
          txMasked: string | null; name: string; at: string;
        }>).length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#0c1018] p-4 text-[12px] text-white/40">
            No public payouts yet.
          </p>
        ) : (
          (payouts as Array<{
            id: string; amount: number; method: string; addressMasked: string;
            txMasked: string | null; name: string; at: string;
          }>).map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/8 bg-[#0c1018] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">{p.name}</p>
                <p className="text-sm font-black tabular-nums text-emerald-300">
                  ${Number(p.amount).toFixed(2)}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-white/45">
                {p.method} · {p.addressMasked}
                {p.txMasked ? ` · tx ${p.txMasked}` : ""}
              </p>
              <p className="mt-0.5 text-[10px] text-white/30">
                {p.at ? new Date(p.at).toLocaleString() : ""} · ref {p.id}
              </p>
            </div>
          ))
        )}
      </section>

      <p className="mt-8 text-center text-[11px] leading-5 text-white/40">
        TASKORA never requires a deposit to unlock earnings. Names and addresses are masked for privacy.
      </p>
    </main>
  );
}
