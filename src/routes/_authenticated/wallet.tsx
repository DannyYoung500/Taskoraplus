import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  Wallet as WalletIcon,
  Shield,
  Clock,
  QrCode,
} from "lucide-react";
import { Screen } from "@/components/Screen";
import { getDashboard } from "@/lib/taskora.functions";
import {
  requestWithdrawalGuarded,
  requestDepositGuarded,
} from "@/lib/taskora-mutations.functions";

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

const WITHDRAW_METHODS = [
  { id: "USDT · TRC20", label: "USDT", network: "TRC20", icon: "₮" },
  { id: "USDT · BEP20", label: "USDT", network: "BEP20", icon: "₮" },
  { id: "BTC", label: "BTC", network: "Bitcoin", icon: "₿" },
  { id: "TON", label: "TON", network: "TON", icon: "◆" },
] as const;

const DEPOSIT_METHODS = [
  {
    id: "USDT · TRC20",
    label: "USDT TRC20",
    network: "Tron",
    address: "TXk9rA2mP4nQ7vL8wY3cF6hJ1sD5bN0uE",
    icon: "₮",
    color: "#26A17B",
  },
  {
    id: "USDT · BEP20",
    label: "USDT BEP20",
    network: "BSC",
    address: "0x9A2bC4d5E6f708192a3B4c5D6e7F8091a2B3c4D5",
    icon: "₮",
    color: "#F0B90B",
  },
  {
    id: "BTC",
    label: "Bitcoin",
    network: "BTC",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    icon: "₿",
    color: "#F7931A",
  },
  {
    id: "TON",
    label: "TON",
    network: "TON",
    address: "EQD________________________________________",
    icon: "◆",
    color: "#0098EA",
  },
] as const;

function WalletScreen() {
  const { dash, error: loadError } = Route.useLoaderData();
  const [tab, setTab] = useState<"deposit" | "withdraw" | "activity">("deposit");

  const [wMethod, setWMethod] = useState<string>(WITHDRAW_METHODS[0]!.id);
  const [wAddress, setWAddress] = useState("");
  const [wAmount, setWAmount] = useState("");
  const [wBusy, setWBusy] = useState(false);
  const [wMsg, setWMsg] = useState<string | null>(null);

  const [dMethod, setDMethod] = useState<(typeof DEPOSIT_METHODS)[number]>(DEPOSIT_METHODS[0]!);
  const [dAmount, setDAmount] = useState("");
  const [dTxHash, setDTxHash] = useState("");
  const [dBusy, setDBusy] = useState(false);
  const [dMsg, setDMsg] = useState<string | null>(loadError);
  const [copied, setCopied] = useState(false);

  const balance = Number(dash?.balance ?? 0);
  const pending = Number(dash?.pending ?? 0);
  const txs = dash?.transactions ?? [];

  async function onWithdraw() {
    setWBusy(true);
    setWMsg(null);
    try {
      await requestWithdrawalGuarded({
        data: { method: wMethod, address: wAddress.trim(), amount: Number(wAmount) },
      });
      setWMsg("Withdrawal requested. Owner will process it shortly.");
      setWAddress("");
      setWAmount("");
    } catch (e) {
      setWMsg(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setWBusy(false);
    }
  }

  async function onDeposit() {
    setDBusy(true);
    setDMsg(null);
    try {
      const row = await requestDepositGuarded({
        data: {
          method: dMethod.id,
          amount: Number(dAmount),
          txHash: dTxHash.trim() || undefined,
        },
      });
      setDMsg(
        `Deposit #${String(row.id).slice(0, 8)} submitted · $${Number(row.amount).toFixed(2)} pending confirmation.`,
      );
      setDAmount("");
      setDTxHash("");
    } catch (e) {
      setDMsg(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setDBusy(false);
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(dMethod.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setDMsg("Copy failed — select the address manually.");
    }
  }

  return (
    <Screen className="!bg-[#05070c]">
      <section className="relative mb-5 overflow-hidden rounded-3xl border border-sky-400/20 bg-gradient-to-br from-[#0c1a2e] via-[#121f33] to-[#0a1220] p-5 shadow-lg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/70">
              Available balance
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-white">
              ${balance.toFixed(2)}
            </p>
            <p className="mt-1.5 text-xs text-white/45">
              Pending rewards · ${pending.toFixed(2)}
            </p>
          </div>
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30">
            <WalletIcon className="size-5" />
          </span>
        </div>
        <div className="relative mt-4 flex gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-black/25 px-3 py-2 text-[10px] text-white/50">
            <Shield className="size-3.5 text-emerald-300" /> Secure ledger
          </div>
          <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-black/25 px-3 py-2 text-[10px] text-white/50">
            <Clock className="size-3.5 text-amber-300" /> 24h new-account hold
          </div>
        </div>
      </section>

      <div className="mb-4 flex gap-1 rounded-2xl border border-white/8 bg-[#12141c] p-1">
        {(
          [
            { id: "deposit", label: "Deposit" },
            { id: "withdraw", label: "Withdraw" },
            { id: "activity", label: "Activity" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
              tab === t.id
                ? "bg-sky-400 text-[#0a0c12] shadow"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deposit" ? (
        <section className="space-y-3">
          <p className="text-xs text-white/45">
            Send crypto to the address below, then submit amount + optional TX hash for faster
            confirmation.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {DEPOSIT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setDMethod(m)}
                className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition ${
                  dMethod.id === m.id
                    ? "border-sky-400/50 bg-sky-400/10"
                    : "border-white/8 bg-[#12141c]"
                }`}
              >
                <span
                  className="inline-flex size-9 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{m.label}</p>
                  <p className="text-[10px] text-white/40">{m.network}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#12141c] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Deposit address · {dMethod.network}
              </p>
              <QrCode className="size-4 text-white/25" />
            </div>
            <p className="break-all rounded-xl bg-black/40 px-3 py-3 font-mono text-[11px] leading-relaxed text-sky-100/90">
              {dMethod.address}
            </p>
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 py-2.5 text-xs font-bold text-sky-200"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy address
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[10px] text-amber-200/70">
              Send only {dMethod.label} on {dMethod.network}. Wrong network = lost funds.
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-[#12141c] p-4">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Amount sent (USD)
            </label>
            <input
              value={dAmount}
              onChange={(e) => setDAmount(e.target.value)}
              placeholder="e.g. 25.00"
              inputMode="decimal"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-sky-400/40"
            />
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Transaction hash (optional)
            </label>
            <input
              value={dTxHash}
              onChange={(e) => setDTxHash(e.target.value)}
              placeholder="TX ID / hash for faster review"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-sky-400/40"
            />
            <button
              type="button"
              disabled={dBusy}
              onClick={() => void onDeposit()}
              className="mt-1 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 py-3.5 text-sm font-bold text-[#0a0c12] disabled:opacity-50"
            >
              {dBusy ? "Submitting…" : "Submit deposit for confirmation"}
            </button>
            {dMsg ? <p className="text-center text-xs text-amber-200/90">{dMsg}</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "withdraw" ? (
        <section className="space-y-3">
          <p className="text-xs text-white/45">
            Min $10 · processed by owner after review · first withdrawals may need extra checks.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {WITHDRAW_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setWMethod(m.id)}
                className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left ${
                  wMethod === m.id
                    ? "border-sky-400/50 bg-sky-400/10"
                    : "border-white/8 bg-[#12141c]"
                }`}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
                  {m.icon}
                </span>
                <div>
                  <p className="text-xs font-bold">{m.label}</p>
                  <p className="text-[10px] text-white/40">{m.network}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="space-y-2 rounded-2xl border border-white/10 bg-[#12141c] p-4">
            <input
              value={wAddress}
              onChange={(e) => setWAddress(e.target.value)}
              placeholder="Your wallet address"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-sky-400/40"
            />
            <input
              value={wAmount}
              onChange={(e) => setWAmount(e.target.value)}
              placeholder="Amount (USD)"
              inputMode="decimal"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-sky-400/40"
            />
            <button
              type="button"
              disabled={wBusy}
              onClick={() => void onWithdraw()}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 py-3.5 text-sm font-bold text-[#0a0c12] disabled:opacity-50"
            >
              {wBusy ? "Submitting…" : "Request withdrawal"}
            </button>
            {wMsg ? <p className="text-center text-xs text-amber-200/90">{wMsg}</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section>
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/8 bg-[#12141c]">
            {txs.length === 0 ? (
              <p className="p-5 text-center text-sm text-white/45">No transactions yet.</p>
            ) : (
              txs.slice(0, 40).map((e: { id: string; amount: number | string; label: string; created_at: string }) => {
                const amt = Number(e.amount);
                return (
                  <div key={e.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span
                      className={`inline-flex size-9 items-center justify-center rounded-full ${
                        amt < 0 ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {amt < 0 ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownLeft className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.label}</p>
                      <p className="text-[10px] text-white/40">
                        {new Date(e.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        amt < 0 ? "text-red-300" : "text-emerald-300"
                      }`}
                    >
                      {amt < 0 ? "−" : "+"}${Math.abs(amt).toFixed(2)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </Screen>
  );
}
