import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, CreditCard, Save, ShieldCheck } from "lucide-react";
import { OwnerShell } from "@/components/OwnerShell";

export const Route = createFileRoute("/_authenticated/owner/payment-settings")({ component: PaymentSettingsPage });

const PROVIDERS = [
  "OxaPay",
  "Cryptomus",
  "NOWPayments",
  "CoinGate",
  "CoinPayments",
  "Binance Pay",
  "Coinbase Commerce",
  "BTCPay Server",
  "Custom Crypto Provider",
];

function PaymentSettingsPage() {
  const [provider, setProvider] = useState("OxaPay");
  const [enabled, setEnabled] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [network, setNetwork] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage("Payment provider settings are ready to be connected to the crypto payment adapter.");
  }

  return (
    <OwnerShell>
      <main className="px-4 pb-10 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60"><ChevronLeft className="size-4" /></Link>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Money</p><h1 className="text-xl font-extrabold">Payment Settings</h1></div>
        </div>
        <div className="mb-4 rounded-3xl border border-emerald-400/20 bg-[#121f33] p-4">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 text-emerald-300" /><div><p className="text-sm font-bold">Crypto payments only</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Configure crypto gateways used for TASKORA deposits and withdrawals. Game, ad and video credentials belong in the separate Provider Control Center.</p></div></div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PROVIDERS.map((name) => <button key={name} type="button" onClick={() => setProvider(name)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-bold ${provider === name ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-[#121f33] text-slate-400"}`}>{name}</button>)}
        </div>
        <section className="mt-3 rounded-3xl border border-white/10 bg-[#121f33] p-4">
          <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected gateway</p><h2 className="text-lg font-extrabold">{provider}</h2></div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Field label="API Base URL" value={apiBaseUrl} onChange={setApiBaseUrl} placeholder="https://api.provider.com" />
            <Field label="Merchant ID" value={merchantId} onChange={setMerchantId} placeholder="Merchant / Store ID" />
            <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="Enter API key" secret />
            <Field label="API Secret" value={apiSecret} onChange={setApiSecret} placeholder="Enter API secret" secret />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2"><Field label="Webhook URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="TASKORA callback endpoint" /><Field label="Network / Chain" value={network} onChange={setNetwork} placeholder="TRC20 / ERC20 / etc." /></div>
          <button type="button" onClick={save} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-[#07120d]"><Save className="size-4" /> Save Payment Settings</button>
          {message ? <p className="mt-3 text-center text-xs text-slate-400">{message}</p> : null}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3 text-[10px] leading-5 text-slate-500">Payment credentials must be stored server-side and never exposed to the Telegram Mini App client.</div>
        </section>
        <Link to="/owner/monetization" className="mt-4 flex items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300">Open Provider Control Center →</Link>
      </main>
    </OwnerShell>
  );
}

function Field({ label, value, onChange, placeholder, secret = false }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; secret?: boolean }) {
  return <label className="block"><span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span><input type={secret ? "password" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none focus:border-emerald-400/40" /></label>;
}
