import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bitcoin } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { getDashboard, requestWithdrawal } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  loader: async () => {
    try {
      const dash = await getDashboard();
      return { dash, error: null as string | null };
    } catch (e) {
      return {
        dash: null,
        error: e instanceof Error ? e.message : "Could not load wallet",
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Wallet — TASKORA" },
      { name: "description", content: "Track your TASKORA balance, rewards history and crypto withdrawals." },
    ],
  }),
  component: WalletScreen,
});

const METHODS = ["USDT · TRC20", "USDT · BEP20", "BTC", "TON"];

function WalletScreen() {
  const { dash, error: loadError } = Route.useLoaderData();
  const [method, setMethod] = useState(METHODS[0]!);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(loadError);

  const balance = Number(dash?.balance ?? 0);
  const pending = Number(dash?.pending ?? 0);
  const txs = dash?.transactions ?? [];

  async function onWithdraw() {
    setBusy(true);
    setMessage(null);
    try {
      await requestWithdrawal({
        data: {
          method,
          address: address.trim(),
          amount: Number(amount),
        },
      });
      setMessage("Withdrawal requested. Owner will process it.");
      setAddress("");
      setAmount("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Wallet" subtitle="Crypto payouts only" />

      <section className="bg-brand relative overflow-hidden rounded-3xl p-5 text-navy-foreground shadow-raised">
        <p className="text-xs uppercase tracking-[0.18em] opacity-70">Available</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">${balance.toFixed(2)}</p>
        <p className="mt-2 text-xs opacity-80">
          Pending ${pending.toFixed(2)} · Minimum withdrawal $10.00
        </p>
      </section>

      <section className="card-surface mt-4 p-4">
        <h2 className="text-sm font-bold">Withdraw</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-xs font-semibold ${
                method === m ? "bg-green-grad text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              <Bitcoin className="size-4" />
              {m}
            </button>
          ))}
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Wallet address"
          className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (USD)"
          inputMode="decimal"
          className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          disabled={busy}
          onClick={onWithdraw}
          className="bg-green-grad mt-3 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Request withdrawal"}
        </button>
        {message ? <p className="mt-2 text-center text-xs text-muted-foreground">{message}</p> : null}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Activity</h2>
        <div className="card-surface divide-y divide-border">
          {txs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            txs.slice(0, 30).map((e) => {
              const amt = Number(e.amount);
              return (
                <div key={e.id} className="flex items-center gap-3 p-3.5">
                  <span
                    className={`inline-flex size-9 items-center justify-center rounded-full ${
                      amt < 0 ? "bg-secondary" : "bg-accent"
                    }`}
                  >
                    {amt < 0 ? (
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    ) : (
                      <ArrowDownLeft className="size-4 text-accent-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${amt < 0 ? "text-muted-foreground" : "text-success"}`}>
                    {amt < 0 ? "-" : "+"}${Math.abs(amt).toFixed(2)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </Screen>
  );
}
