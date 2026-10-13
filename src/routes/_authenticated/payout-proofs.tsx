import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { listPublicPayouts } from "@/lib/strong-p7.functions";
import { formatUsd } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/payout-proofs")({
  head: () => ({ meta: [{ title: "Payouts - TASKORA" }] }),
  component: PublicPayoutsPage,
});

function PublicPayoutsPage() {
  const [items, setItems] = useState<
    Array<{ amount: number; addressMask: string; paidAt: string; method: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listPublicPayouts()
      .then((r) => setItems(r.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <header className="mb-4 flex items-center gap-2">
        <AppLink to="/wallet" className="rounded-full bg-[#121212] p-2">
          <ChevronLeft className="size-4 text-neutral-400" />
        </AppLink>
        <div>
          <p className="text-[16px] font-semibold text-neutral-50">Public payouts</p>
          <p className="text-[11px] text-neutral-500">Recent real USDT withdrawals</p>
        </div>
      </header>

      {loading ? (
        <p className="text-center text-[13px] text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-[#121212] px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-neutral-300">No public payouts yet</p>
          <p className="mt-1 text-[12px] text-neutral-600">Paid withdrawals will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div
              key={`${it.paidAt}-${i}`}
              className="flex items-center justify-between rounded-2xl bg-[#121212] px-3.5 py-3"
            >
              <div>
                <p className="text-[14px] font-semibold text-emerald-400">{formatUsd(it.amount)}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {it.method} · {it.addressMask}
                </p>
              </div>
              <p className="text-[10px] text-neutral-600">
                {it.paidAt ? new Date(it.paidAt).toLocaleDateString() : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
