import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { getEconomySettings, saveEconomySettings } from "@/lib/owner-ops.functions";

export const Route = createFileRoute("/_authenticated/owner/economy")({
  component: OwnerEconomyPage,
});

function OwnerEconomyPage() {
  const [minW, setMinW] = useState("10");
  const [minDep, setMinDep] = useState("5");
  const [refPct, setRefPct] = useState("5");
  const [checkXp, setCheckXp] = useState("10");
  const [fee, setFee] = useState("0");
  const [reason, setReason] = useState("");
  const [prices, setPrices] = useState<
    Array<{ platform: string; action: string; user_reward: number; advertiser_price: number }>
  >([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getEconomySettings()
      .then((r) => {
        setMinW(String(r.settings.min_withdrawal ?? 10));
        setMinDep(String(r.settings.min_advertiser_deposit ?? 5));
        setRefPct(String(r.settings.referral_commission_pct ?? 5));
        setCheckXp(String(r.settings.daily_checkin_xp ?? 10));
        setFee(String(r.settings.withdrawal_fee_pct ?? 0));
        setPrices(r.prices as never);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await saveEconomySettings({
        data: {
          min_withdrawal: Number(minW),
          min_advertiser_deposit: Number(minDep),
          referral_commission_pct: Number(refPct),
          daily_checkin_xp: Number(checkXp),
          withdrawal_fee_pct: Number(fee),
          reason,
        },
      });
      setMsg("Economy settings saved (audited). Daily check-in remains XP-only.");
      setReason("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Economy Controls</h1>
          <p className="text-xs text-white/45">Min $10 withdrawal · $5 advertiser · 5% referral · XP check-in</p>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-white/8 bg-[#12141c] p-4">
        <Field label="Min withdrawal (USD)" value={minW} onChange={setMinW} />
        <Field label="Min advertiser deposit (USD)" value={minDep} onChange={setMinDep} />
        <Field label="Referral commission %" value={refPct} onChange={setRefPct} />
        <Field label="Daily check-in XP (cash = 0)" value={checkXp} onChange={setCheckXp} />
        <Field label="Withdrawal fee %" value={fee} onChange={setFee} />
        <label className="block text-xs text-white/55">
          Reason (required)
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this change?"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="w-full rounded-2xl py-3 text-sm font-extrabold text-[#05070c] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#FFE08A,#F5C542,#C9961A)" }}
        >
          {busy ? "Saving…" : "SAVE ECONOMY SETTINGS"}
        </button>
        {msg ? <p className="text-center text-xs text-white/55">{msg}</p> : null}
      </div>

      <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
        Core task pricing (catalog)
      </p>
      <div className="space-y-1.5">
        {prices.length === 0 ? (
          <p className="text-xs text-white/40">Run OWNER_DASHBOARD_SPEC.sql to seed prices.</p>
        ) : (
          prices.map((p) => (
            <div
              key={`${p.platform}-${p.action}`}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-[#12141c] px-3 py-2 text-xs"
            >
              <span className="capitalize text-white/70">
                {p.platform} · {p.action}
              </span>
              <span className="font-semibold text-amber-300">
                ${Number(p.user_reward).toFixed(3)} / ${Number(p.advertiser_price).toFixed(3)}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-white/55">
      {label}
      <input
        type="number"
        step="any"
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
