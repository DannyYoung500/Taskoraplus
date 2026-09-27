import { createFileRoute } from "@tanstack/react-router";
import { getPublicPlatformStats } from "@/lib/strong-wave.functions";
import { TASKORA_LOGO } from "@/lib/brand";

export const Route = createFileRoute("/ledger")({
  head: () => ({ meta: [{ title: "Public ledger — TASKORA" }] }),
  loader: async () => {
    const stats = await getPublicPlatformStats().catch(() => ({
      verifiedToday: 0,
      paidWeekUsd: 0,
    }));
    return { stats };
  },
  component: PublicLedgerPage,
});

function PublicLedgerPage() {
  const { stats } = Route.useLoaderData();
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05080f] px-4 pb-16 pt-8 text-white">
      <div className="flex items-center gap-3">
        <img src={TASKORA_LOGO} alt="TASKORA" className="size-11 rounded-full ring-1 ring-cyan-400/40" />
        <div>
          <h1 className="text-xl font-black tracking-tight">Public ledger</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
            Real counts · no user data
          </p>
        </div>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#0a1f3d] to-[#061329] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">
            Verified today
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">
            {Number(stats.verifiedToday ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] text-white/40">Approved task proofs</p>
        </div>
        <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-[#062a2a] to-[#07172a] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">
            Paid this week
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-emerald-200">
            ${Number(stats.paidWeekUsd ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] text-white/40">Successful withdrawals</p>
        </div>
      </section>

      <p className="mt-8 text-center text-[11px] leading-5 text-white/40">
        TASKORA never requires a deposit to unlock earnings. Figures update from the live ledger.
      </p>
    </main>
  );
}
