import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  Wallet as WalletIcon,
  Shield,
  Clock,
} from "lucide-react";
import { Screen } from "@/components/Screen";
import { getDashboard } from "@/lib/taskora.functions";
import { getPublicFeatures } from "@/lib/owner-economy.functions";
import { hapticSuccess, hapticError } from "@/lib/telegram-native";
import { formatUsd } from "@/lib/taskora-display";
import {
  requestWithdrawalGuarded,
  requestDepositGuarded,
} from "@/lib/taskora-mutations.functions";
import { CryptoLogo, resolveCryptoId } from "@/components/CryptoIcon";
import { BLUE_GRAD } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/wallet")({
  loader: async () => {
    try {
      const [dash, features] = await Promise.all([
        getDashboard(),
        getPublicFeatures().catch(() => ({
          min_withdrawal_usd: 3,
          min_deposit_usd: 5,
          payouts_paused: false,
        })),
      ]);
      return { dash, features, error: null as string | null };
    } catch (e) {
      return {
        dash: null,
        features: { min_withdrawal_usd: 3, min_deposit_usd: 5, payouts_paused: false },
        error: e instanceof Error ? e.message : "Could not load wallet",
      };
    }
  },
  head: () => ({ meta: [{ title: "Wallet — TASKORA" }] }),
  component: WalletScreen,
});

const WITHDRAW_METHODS = [
  { id: "USDT · TRC20", label: "USDT", network: "TRC20 (Tron)" },
  { id: "USDT · BEP20", label: "USDT", network: "BEP20 (BSC)" },
  { id: "BTC", label: "Bitcoin", network: "Bitcoin" },
  { id: "TON", label: "TON", network: "TON" },
] as const;

const DEFAULT_DEPOSIT = [
  {
    id: "USDT · TRC20",
    label: "USDT TRC20",
    network: "Tron",
    address: "TXk9rA2mP4nQ7vL8wY3cF6hJ1sD5bN0uE",
  },
  {
    id: "USDT · BEP20",
    label: "USDT BEP20",
    network: "BSC",
    address: "0x9A2bC4d5E6f708192a3B4c5D6e7F8091a2B3c4D5",
  },
  {
    id: "BTC",
    label: "Bitcoin",
    network: "BTC",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  },
  {
    id: "TON",
    label: "TON",
    network: "TON",
    address: "EQD________________________________________",
  },
] as const;

function WalletScreen() {
  const { dash, features, error: loadError } = Route.useLoaderData();
  const minWd = Number((features as { min_withdrawal_usd?: number })?.min_withdrawal_usd ?? 3);
  const minDep = Number((features as { min_deposit_usd?: number })?.min_deposit_usd ?? 5);
  const [tab, setTab] = useState<"deposit" | "withdraw" | "activity">("deposit");

  const [wMethod, setWMethod] = useState<string>(WITHDRAW_METHODS[0]!.id);
  const [wAddress, setWAddress] = useState("");
  const [wAmount, setWAmount] = useState("");
  const [wBusy, setWBusy] = useState(false);
  const [wMsg, setWMsg] = useState<string | null>(null);

  const [dIdx, setDIdx] = useState(0);
  const [dAmount, setDAmount] = useState("");
  const [dTxHash, setDTxHash] = useState("");
  const [dBusy, setDBusy] = useState(false);
  const [dMsg, setDMsg] = useState<string | null>(loadError);
  const [copied, setCopied] = useState(false);

  const ownerAddrs = (
    (features as { deposit_addresses?: Array<{ id: string; method: string; network: string; address: string }> })
      ?.deposit_addresses ?? []
  ).filter((a) => a.address);

  const depositMethods =
    ownerAddrs.length > 0
      ? ownerAddrs.map((a) => ({
          id: a.id,
          label: a.method,
          network: a.network || a.method,
          address: a.address,
        }))
      : DEFAULT_DEPOSIT.map((m) => ({ ...m }));

  const dMethod = depositMethods[Math.min(dIdx, Math.max(0, depositMethods.length - 1))] ?? depositMethods[0];

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
      hapticSuccess();
      setWMsg("Withdrawal requested. Owner will process it shortly.");
      setWAddress("");
      setWAmount("");
    } catch (e) {
      hapticError();
      setWMsg(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setWBusy(false);
    }
  }

  async function onDeposit() {
    if (!dMethod) {
      setDMsg("No deposit address configured. Contact support.");
      return;
    }
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
        `Deposit #${String(row.id).slice(0, 8)} submitted · ${formatUsd(row.amount)} pending confirmation.`,
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
    if (!dMethod?.address) return;
    try {
      await navigator.clipboard.writeText(dMethod.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setDMsg("Copy failed — select the address manually.");
    }
  }

  return (
    <Screen className="!bg-[#030814]">
      <section
        className="relative mb-4 overflow-hidden rounded-[22px] border border-cyan-400/25 p-5 shadow-lg"
        style={{
          background:
            "radial-gradient(circle at 88% 12%,rgba(56,189,248,0.2),transparent 42%), linear-gradient(145deg,#0a1a33,#060f1c)",
        }}
      >
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
              Available balance
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-white tabular-nums">
              {formatUsd(balance)}
            </p>
            <p className="mt-1.5 text-xs text-slate-400">
              Pending rewards · {formatUsd(pending)}
            </p>
          </div>
          <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-200">
            <WalletIcon className="size-5" />
          </span>
        </div>
        <div className="relative mt-4 flex gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-[10px] text-slate-400">
            <Shield className="size-3.5 text-emerald-300" /> Secure ledger
          </div>
          <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-[10px] text-slate-400">
            <Clock className="size-3.5 text-amber-300" /> 24h new-account hold
          </div>
        </div>
      </section>

      <div className="mb-4 flex gap-1 rounded-2xl border border-cyan-400/15 bg-[#0b1628] p-1">
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
              tab === t.id ? "text-white shadow-md" : "text-slate-400 hover:text-slate-200"
            }`}
            style={tab === t.id ? { background: BLUE_GRAD } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deposit" ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300/80">
              How to deposit
            </p>
            <ol className="space-y-1.5 text-[11px] leading-snug text-slate-300">
              <li className="flex gap-2">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-[10px] font-bold text-cyan-200">1</span>
                Choose network & copy the address below
              </li>
              <li className="flex gap-2">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-[10px] font-bold text-cyan-200">2</span>
                {"Send crypto from your wallet (min " + formatUsd(minDep) + ")"}
              </li>
              <li className="flex gap-2">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-[10px] font-bold text-cyan-200">3</span>
                Submit amount + TX hash for faster review
              </li>
            </ol>
          </div>

          {depositMethods.length === 0 ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-center text-[12px] text-amber-100">
              Deposit addresses are not configured yet. Owner sets them in Settings → Economy.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {depositMethods.map((m, i) => {
              const active = dMethod?.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDIdx(i)}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(56,189,248,0.12)]"
                      : "border-white/8 bg-[#0b1628]"
                  }`}
                >
                  <CryptoLogo method={m.label || m.id} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{m.label}</p>
                    <p className="text-[10px] text-slate-400">{m.network}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-cyan-400/15 bg-[#0b1628] p-4">
            <div className="mb-2 flex items-center gap-2">
              <CryptoLogo method={dMethod?.label || dMethod?.id || "USDT"} size={28} />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Deposit address · {dMethod?.network}
              </p>
            </div>
            <p className="break-all rounded-xl border border-cyan-400/15 bg-black/40 px-3 py-3.5 font-mono text-[11px] leading-relaxed text-cyan-100/95">
              {dMethod?.address ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 py-3 text-xs font-bold text-cyan-100 transition active:scale-[0.98]"
            >
              {copied ? (<><Check className="size-3.5" /> Address copied</>) : (<><Copy className="size-3.5" /> Copy address</>)}
            </button>
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-center">
              <p className="text-[11px] font-semibold text-amber-200">
                ⚠ Send only {dMethod?.label} on {dMethod?.network}
              </p>
              <p className="mt-0.5 text-[10px] text-amber-200/70">
                Wrong network or asset = permanent loss. Double-check before sending.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border border-white/8 bg-[#0b1628] p-4">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {"Amount sent (USD) · min " + formatUsd(minDep)}
            </label>
            <input value={dAmount} onChange={(e) => setDAmount(e.target.value)} placeholder="e.g. 25.0000" inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none focus:border-cyan-400/40" />
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Transaction hash / TX ID (recommended)</label>
            <input value={dTxHash} onChange={(e) => setDTxHash(e.target.value)} placeholder="Paste TX hash for faster confirmation" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none focus:border-cyan-400/40" />
            <button type="button" disabled={dBusy} onClick={() => void onDeposit()} className="mt-1 w-full rounded-2xl py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50" style={{ background: BLUE_GRAD }}>
              {dBusy ? "Submitting…" : "Submit deposit for confirmation"}
            </button>
            {dMsg ? (<p className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-center text-xs text-cyan-100/90">{dMsg}</p>) : null}
            <p className="text-center text-[10px] text-slate-500">Credits appear after owner confirms on-chain. Usually under 30 min.</p>
          </div>
        </section>
      ) : null}

      {tab === "withdraw" ? (
        <section className="space-y-3">
          <p className="text-xs text-slate-400">{`Min ${formatUsd(minWd)} · processed by owner after review · first withdrawals may need extra checks.`}</p>
          <Link to="/payout-proofs" className="block text-center text-[11px] font-semibold text-cyan-300 underline-offset-2 hover:underline">View public payout proofs →</Link>
          <div className="grid grid-cols-2 gap-2">
            {WITHDRAW_METHODS.map((m) => {
              const active = wMethod === m.id;
              return (
                <button key={m.id} type="button" onClick={() => setWMethod(m.id)} className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition ${
                  active ? "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(56,189,248,0.12)]" : "border-white/8 bg-[#0b1628]"
                }`}>
                  <CryptoLogo method={m.id} size={36} />
                  <div>
                    <p className="text-xs font-bold text-white">{m.label}</p>
                    <p className="text-[10px] text-slate-400">{m.network}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="space-y-2 rounded-2xl border border-white/8 bg-[#0b1628] p-4">
            <p className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <CryptoLogo method={wMethod} size={18} />
              {resolveCryptoId(wMethod).toUpperCase()} payout address
            </p>
            <input value={wAddress} onChange={(e) => setWAddress(e.target.value)} placeholder="Your wallet address" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40" />
            <input value={wAmount} onChange={(e) => setWAmount(e.target.value)} placeholder="Amount (USD)" inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40" />
            <button type="button" disabled={wBusy} onClick={() => void onWithdraw()} className="w-full rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-50" style={{ background: BLUE_GRAD }}>
              {wBusy ? "Submitting…" : "Request withdrawal"}
            </button>
            {wMsg ? (<p className="text-center text-xs text-cyan-100/90">{wMsg}</p>) : null}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section>
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/8 bg-[#0b1628]">
            {txs.length === 0 ? (
              <p className="p-5 text-center text-sm text-slate-400">No transactions yet.</p>
            ) : (
              txs.slice(0, 40).map((e: { id: string; amount: number | string; label: string; created_at: string }) => {
                const amt = Number(e.amount);
                return (
                  <div key={e.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className={`inline-flex size-9 items-center justify-center rounded-full ${
                      amt < 0 ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                    }`}>
                      {amt < 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{e.label}</p>
                      <p className="text-[10px] text-slate-500">{new Date(e.created_at).toLocaleString()}</p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums ${amt < 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {amt < 0 ? "−" : "+"}{formatUsd(Math.abs(amt))}
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
