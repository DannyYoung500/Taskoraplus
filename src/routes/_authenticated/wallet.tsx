import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Bitcoin } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { LEDGER, USER } from "@/lib/taskora-data";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — TASKORA" },
      {
        name: "description",
        content: "Track your TASKORA balance, rewards history and crypto withdrawals.",
      },
      { property: "og:title", content: "Wallet — TASKORA" },
      {
        property: "og:description",
        content: "Balance, rewards history and crypto withdrawals in one place.",
      },
    ],
  }),
  component: WalletScreen,
});

const METHODS = ["USDT · TRC20", "USDT · BEP20", "BTC", "TON"];

function WalletScreen() {
  return (
    <Screen>
      <ScreenTitle title="Wallet" subtitle="Crypto payouts only" />

      <section className="bg-brand relative overflow-hidden rounded-3xl p-5 text-navy-foreground shadow-raised">
        <p className="text-xs uppercase tracking-[0.18em] opacity-70">Available</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">${USER.balance.toFixed(2)}</p>
        <p className="mt-2 text-xs opacity-80">
          Pending ${USER.pending.toFixed(2)} · Minimum withdrawal $10.00
        </p>
      </section>

      <section className="card-surface mt-4 p-4">
        <h2 className="text-sm font-bold">Withdraw</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-3 text-xs font-semibold text-secondary-foreground"
            >
              <Bitcoin className="size-4 text-primary" />
              {m}
            </button>
          ))}
        </div>
        <input
          placeholder="Wallet address"
          className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          placeholder="Amount (USD)"
          inputMode="decimal"
          className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="bg-green-grad mt-3 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow">
          Request withdrawal
        </button>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Activity</h2>
        <div className="card-surface divide-y divide-border">
          {LEDGER.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3.5">
              <span
                className={`inline-flex size-9 items-center justify-center rounded-full ${
                  e.amount < 0 ? "bg-secondary" : "bg-accent"
                }`}
              >
                {e.amount < 0 ? (
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                ) : (
                  <ArrowDownLeft className="size-4 text-accent-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{e.label}</p>
                <p className="text-[11px] text-muted-foreground">{e.date}</p>
              </div>
              <p
                className={`text-sm font-bold ${e.amount < 0 ? "text-muted-foreground" : "text-success"}`}
              >
                {e.amount < 0 ? "-" : "+"}${Math.abs(e.amount).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </Screen>
  );
}
