import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";
import { getDashboard } from "@/lib/taskora.functions";
import { requestWithdrawalGuarded } from "@/lib/taskora-mutations.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  loader: async () => {
    try {
      const dash = await getDashboard();
      return { dash, error: null as string | null };
    } catch (e) {
      return { dash: null, error: e instanceof Error ? e.message : "Could not load wallet" };
    }
  },
  head: () => ({ meta: [{ title: "Wallet — TASKORA" }] }),
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
      await requestWithdrawalGuarded({
        data: { method, address: address.trim(), amount: Number(amount) },
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
      <ScreenTitle title="Wallet" subtitle="Crypto payouts · min $10 · owner review" />

      <section
        className="relative overflow-hidden rounded-3xl border border-amber-400/25 p-5"
        style={{
          background:
            "radial-gradient(ellipse at 80% 20%, rgba(245,197,66,0.2), transparent 50%), linear-gradient(145deg,#161820,#0a0c12)",
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">Available</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight text-amber-300">${balance.toFixed(2)}</p>
        <p className="mt-2 text-xs text-white/50">Pending ${pending.toFixed(2)}</p>
      </section>

      <Card className="mt-4 p-4">
        <h2 className="text-sm font-bold text-white">Withdraw</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-2xl px-3 py-3 text-xs font-semibold ${
                method === m
                  ? "border border-amber-400/40 bg-amber-400/15 text-amber-200"
                  : "border border-white/8 bg-white/5 text-white/60"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Wallet address"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/40"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (USD) · min 10"
          inputMode="decimal"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/40"
        />
        <GoldButton className="mt-3" disabled={busy} onClick={() => void onWithdraw()}>
          {busy ? "Submitting…" : "Request withdrawal"}
        </GoldButton>
        {message ? <p className="mt-2 text-center text-xs text-white/50">{message}</p> : null}
      </Card>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Activity</h2>
        <Card className="divide-y divide-white/8">
          {txs.length === 0 ? (
            <p className="p-4 text-sm text-white/45">No transactions yet. Complete tasks to earn.</p>
          ) : (
            txs.slice(0, 30).map((e: { id: string; amount: number; label: string; created_at: string }) => {
              const amt = Number(e.amount);
              return (
                <div key={e.id} className="flex items-center gap-3 p-3.5">
                  <span
                    className={`inline-flex size-9 items-center justify-center rounded-full ${
                      amt < 0 ? "bg-white/5" : "bg-amber-400/15"
                    }`}
                  >
                    {amt < 0 ? (
                      <ArrowUpRight className="size-4 text-white/50" />
                    ) : (
                      <ArrowDownLeft className="size-4 text-amber-300" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.label}</p>
                    <p className="text-[11px] text-white/35">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                  <p className={`text-sm font-bold ${amt < 0 ? "text-white/50" : "text-amber-300"}`}>
                    {amt < 0 ? "-" : "+"}${Math.abs(amt).toFixed(2)}
                  </p>
                </div>
              );
            })
          )}
        </Card>
      </section>
    </Screen>
  );
}
