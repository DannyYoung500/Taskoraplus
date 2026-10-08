import { createFileRoute } from "@tanstack/react-router";
import { AppLink } from "@/components/AppLink";
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
import { ACCENT_GRAD } from "@/lib/brand";

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
  { id: "USDT · BEP20", label: "USDT", network: "BEP20 (BSC)" },
  { id: "USDT · TRC20", label: "USDT", network: "TRC20 (TRX / Tron)" },
] as const;

const SUPPORTED_DEPOSIT_ASSETS = [
  { id: "TON", label: "TON", network: "TON" },
  { id: "USDT · BEP20", label: "USDT", network: "BEP20 (BSC)" },
  { id: "USDT · TRC20", label: "USDT", network: "TRC20 (TRX / Tron)" },
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

  const configuredDeposits = ownerAddrs.map((a) => ({
    id: a.id,
    label: a.method,
    network: a.network || a.method,
    address: a.address,
  }));
  const depositMethods = SUPPORTED_DEPOSIT_ASSETS.map((asset) => {
    const configured = configuredDeposits.find((a) => a.id === asset.id || a.label === asset.label);
    return { ...asset, address: configured?.address ?? "" };
  });

  const dMethod = depositMethods[Math.min(dIdx, Math.max(0, depositMethods.length - 1))] ?? depositMethods[0];

  const balance = Number(dash?.balance ?? 0);
  const pending = Number(dash?.pending ?? 0);
  const txs = dash?.transactions ?? [];

  async function onWithdraw() {
    setWBusy(true);
    setWMsg(null);
    try {
      const initData =
        typeof window !== "undefined"
          ? String((window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "")
          : "";
      await requestWithdrawalGuarded({
        data: {
          method: wMethod,
          address: wAddress.trim(),
          amount: Number(wAmount),
          initData: initData || undefined,
        },
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
    <Screen className="!bg-[#080808]">
      <section className="relative mb-4 overflow-hidden rounded-2xl bg-[#121212] p-5">
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] font-normal text-neutral-500">Available balance</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-neutral-50 tabular-nums">
              {formatUsd(balance)}
            </p>
            <p className="mt-1.5 text-[12px] font-normal text-neutral-500">
              Pending · {formatUsd(pending)}
            </p>
          </div>
          <WalletIcon className="size-6 text-orange-400" strokeWidth={1.75} />
        </div>
        <div className="relative mt-4 flex gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-[#0a0a0a] px-3 py-2 text-[10px] font-normal text-neutral-500">
            <Shield className="size-3.5 text-emerald-400" strokeWidth={1.75} /> Secure ledger
          </div>
          <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-[#0a0a0a] px-3 py-2 text-[10px] font-normal text-neutral-500">
            <Clock className="size-3.5 text-amber-400" strokeWidth={1.75} /> Review holds apply
          </div>
        </div>
      </section>

      <div className="mb-4 flex gap-1 rounded-2xl bg-[#121212] p-1">
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
            className={`flex-1 rounded-xl py-2.5 text-[12px] font-medium transition ${
              tab === t.id ? "text-white" : "text-neutral-500"
            }`}
            style={tab === t.id ? { background: ACCENT_GRAD } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deposit" ? (
        <section className="space-y-3">
          <div className="rounded-2xl bg-[#141210] p-3.5">
            <p className="mb-2 text-[11px] font-medium text-orange-300/90">How to deposit</p>
            <ol className="space-y-1.5 text-[11px] font-normal leading-snug text-neutral-400">
              <li>1. Choose network & copy the address</li>
              <li>2. Send crypto (min {formatUsd(minDep)})</li>
              <li>3. Submit amount + TX hash for faster review</li>
            </ol>
          </div>

          {depositMethods.length === 0 ? (
            <div className="rounded-2xl bg-amber-500/10 p-4 text-center text-[12px] font-normal text-amber-200">
              Deposit addresses not configured yet.
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
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-3 text-left transition ${
                    active ? "bg-orange-500/15" : "bg-[#121212]"
                  }`}
                >
                  <CryptoLogo method={m.label || m.id} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-neutral-100">{m.label}</p>
                    <p className="text-[10px] font-normal text-neutral-500">{m.network}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl bg-[#121212] p-4">
            <div className="mb-2 flex items-center gap-2">
              <CryptoLogo method={dMethod?.label || dMethod?.id || "USDT"} size={24} />
              <p className="text-[10px] font-normal text-neutral-500">
                Address · {dMethod?.network}
              </p>
            </div>
            {dMethod?.address ? (
              <>
                <p className="break-all rounded-xl bg-[#0a0a0a] px-3 py-3.5 font-mono text-[11px] leading-relaxed text-neutral-200">
                  {dMethod.address}
                </p>
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500/10 py-3 text-[12px] font-medium text-orange-300 active:opacity-90"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" strokeWidth={1.75} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" strokeWidth={1.75} /> Copy address
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="rounded-xl bg-amber-500/10 px-3 py-3 text-center">
                <p className="text-[12px] font-medium text-amber-200">Address not configured</p>
                <p className="mt-1 text-[10px] font-normal text-amber-200/70">
                  Do not send funds until an address appears here.
                </p>
              </div>
            )}
            <p className="mt-3 text-center text-[10px] font-normal text-amber-200/80">
              Send only {dMethod?.label} on {dMethod?.network}
            </p>
          </div>

          <div className="space-y-2.5 rounded-2xl bg-[#121212] p-4">
            <label className="block text-[10px] font-normal text-neutral-500">
              Amount (USD) · min {formatUsd(minDep)}
            </label>
            <input
              value={dAmount}
              onChange={(e) => setDAmount(e.target.value)}
              placeholder="e.g. 25.00"
              inputMode="decimal"
              className="w-full rounded-xl bg-[#0a0a0a] px-4 py-3.5 text-sm font-normal text-neutral-100 outline-none focus:ring-1 focus:ring-orange-400/30"
            />
            <label className="block text-[10px] font-normal text-neutral-500">TX hash (recommended)</label>
            <input
              value={dTxHash}
              onChange={(e) => setDTxHash(e.target.value)}
              placeholder="Paste TX hash"
              className="w-full rounded-xl bg-[#0a0a0a] px-4 py-3.5 text-sm font-normal text-neutral-100 outline-none focus:ring-1 focus:ring-orange-400/30"
            />
            <button
              type="button"
              disabled={dBusy}
              onClick={() => void onDeposit()}
              className="mt-1 w-full rounded-2xl py-3.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: ACCENT_GRAD }}
            >
              {dBusy ? "Submitting…" : "Submit deposit"}
            </button>
            {dMsg ? (
              <p className="rounded-xl bg-orange-500/10 px-3 py-2 text-center text-[12px] font-normal text-orange-200">
                {dMsg}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "withdraw" ? (
        <section className="space-y-3">
          <p className="text-[12px] font-normal text-neutral-500">
            Min {formatUsd(minWd)} · processed after review
          </p>
          <AppLink
            to="/payout-proofs"
            className="block text-center text-[11px] font-medium text-orange-400"
          >
            View public payout proofs →
          </AppLink>
          <div className="grid grid-cols-2 gap-2">
            {WITHDRAW_METHODS.map((m) => {
              const active = wMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setWMethod(m.id)}
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-3 text-left transition ${
                    active ? "bg-orange-500/15" : "bg-[#121212]"
                  }`}
                >
                  <CryptoLogo method={m.id} size={32} />
                  <div>
                    <p className="text-[12px] font-medium text-neutral-100">{m.label}</p>
                    <p className="text-[10px] font-normal text-neutral-500">{m.network}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="space-y-2 rounded-2xl bg-[#121212] p-4">
            <p className="mb-1 flex items-center gap-2 text-[10px] font-normal text-neutral-500">
              <CryptoLogo method={wMethod} size={16} />
              {resolveCryptoId(wMethod).toUpperCase()} address
            </p>
            <input
              value={wAddress}
              onChange={(e) => setWAddress(e.target.value)}
              placeholder="Your wallet address"
              className="w-full rounded-xl bg-[#0a0a0a] px-4 py-3 text-sm font-normal text-neutral-100 outline-none focus:ring-1 focus:ring-orange-400/30"
            />
            <input
              value={wAmount}
              onChange={(e) => setWAmount(e.target.value)}
              placeholder="Amount (USD)"
              inputMode="decimal"
              className="w-full rounded-xl bg-[#0a0a0a] px-4 py-3 text-sm font-normal text-neutral-100 outline-none focus:ring-1 focus:ring-orange-400/30"
            />
            <button
              type="button"
              disabled={wBusy}
              onClick={() => void onWithdraw()}
              className="w-full rounded-2xl py-3.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: ACCENT_GRAD }}
            >
              {wBusy ? "Submitting…" : "Request withdrawal"}
            </button>
            {wMsg ? (
              <p className="text-center text-[12px] font-normal text-orange-200">{wMsg}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section>
          <div className="overflow-hidden rounded-2xl bg-[#121212]">
            {txs.length === 0 ? (
              <p className="p-5 text-center text-[13px] font-normal text-neutral-500">No transactions yet.</p>
            ) : (
              txs.slice(0, 40).map((e: { id: string; amount: number | string; label: string; created_at: string }) => {
                const amt = Number(e.amount);
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 border-b border-white/[0.04] px-3.5 py-3 last:border-0"
                  >
                    <span
                      className={`inline-flex size-8 items-center justify-center rounded-lg ${
                        amt < 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {amt < 0 ? (
                        <ArrowUpRight className="size-4" strokeWidth={1.75} />
                      ) : (
                        <ArrowDownLeft className="size-4" strokeWidth={1.75} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-neutral-100">{e.label}</p>
                      <p className="text-[10px] font-normal text-neutral-600">
                        {new Date(e.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`text-[13px] font-medium tabular-nums ${
                        amt < 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {amt < 0 ? "−" : "+"}
                      {formatUsd(Math.abs(amt))}
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
