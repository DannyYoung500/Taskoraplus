import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  CreditCard,
  Save,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { OwnerShell } from "@/components/OwnerShell";
import {
  listMonetizationProviders,
  saveMonetizationProvider,
  type MonetizationProvider,
} from "@/lib/monetization.functions";

export const Route = createFileRoute("/_authenticated/owner/payment-settings")({
  component: PaymentSettingsPage,
});

/** Crypto / payment gateways (also seeded in monetization catalog as offerwalls/other). */
const CRYPTO_KEYS = [
  "oxapay",
  "cryptomus",
  "nowpayments",
  "coingate",
  "coinpayments",
  "binance_pay",
  "coinbase_commerce",
  "btcpay",
] as const;

const CRYPTO_LABELS: Record<string, string> = {
  oxapay: "OxaPay",
  cryptomus: "Cryptomus",
  nowpayments: "NOWPayments",
  coingate: "CoinGate",
  coinpayments: "CoinPayments",
  binance_pay: "Binance Pay",
  coinbase_commerce: "Coinbase Commerce",
  btcpay: "BTCPay Server",
};

function PaymentSettingsPage() {
  const [providers, setProviders] = useState<MonetizationProvider[]>([]);
  const [selected, setSelected] = useState<string>("oxapay");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [form, setForm] = useState({
    enabled: false,
    priority: 50,
    apiBaseUrl: "",
    publicId: "",
    placementId: "",
    postbackUrl: "",
    webhookUrl: "",
    minimumPayoutUsd: "",
  });

  async function load() {
    setLoading(true);
    try {
      const all = await listMonetizationProviders();
      // Prefer offerwalls + any matching crypto keys; fallback to catalog stubs
      setProviders(all);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load payment providers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const provider =
    providers.find((p) => p.providerKey === selected) ??
    ({
      id: `catalog:${selected}`,
      category: "offerwalls",
      providerKey: selected,
      providerName: CRYPTO_LABELS[selected] ?? selected,
      enabled: false,
      priority: 50,
      apiBaseUrl: null,
      publicId: null,
      placementId: null,
      postbackUrl: null,
      webhookUrl: null,
      revenueSharePercent: null,
      userRewardSharePercent: null,
      minimumPayoutUsd: null,
      settings: {},
      secretNames: [],
    } satisfies MonetizationProvider);

  useEffect(() => {
    setForm({
      enabled: provider.enabled,
      priority: provider.priority,
      apiBaseUrl: provider.apiBaseUrl ?? "",
      publicId: provider.publicId ?? "",
      placementId: provider.placementId ?? "",
      postbackUrl: provider.postbackUrl ?? "",
      webhookUrl: provider.webhookUrl ?? "",
      minimumPayoutUsd:
        provider.minimumPayoutUsd == null ? "" : String(provider.minimumPayoutUsd),
    });
    setApiKey("");
    setApiSecret("");
    setShowSecret(false);
    setMessage(null);
  }, [provider.id, provider.providerKey, selected]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const secrets: Array<{ name: string; value: string }> = [];
      if (apiKey.trim()) secrets.push({ name: "API Key", value: apiKey.trim() });
      if (apiSecret.trim()) secrets.push({ name: "API Secret", value: apiSecret.trim() });

      await saveMonetizationProvider({
        data: {
          id: provider.id,
          providerKey: selected,
          providerName: CRYPTO_LABELS[selected] ?? selected,
          category: "offerwalls",
          enabled: form.enabled,
          priority: Number(form.priority) || 50,
          apiBaseUrl: form.apiBaseUrl,
          publicId: form.publicId,
          placementId: form.placementId,
          postbackUrl: form.postbackUrl,
          webhookUrl: form.webhookUrl,
          minimumPayoutUsd: form.minimumPayoutUsd === "" ? null : Number(form.minimumPayoutUsd),
          secrets,
        },
      });
      setMessage("✓ Payment gateway saved securely (server-side vault). Webhooks remain the authority for deposits.");
      setApiKey("");
      setApiSecret("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save payment settings.");
    } finally {
      setBusy(false);
    }
  }

  const configured = !provider.id.startsWith("catalog:");

  return (
    <OwnerShell>
      <main className="px-4 pb-10 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Money</p>
            <h1 className="text-xl font-extrabold">Payment Settings</h1>
          </div>
        </div>

        <div className="mb-4 rounded-3xl border border-emerald-400/20 bg-[#121f33] p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-bold">Crypto deposits & withdrawals</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Configure crypto gateways for TASKORA money movement. Keys are stored server-side in
                Supabase Vault and never sent to the Mini App client. Signed webhooks remain the
                deposit authority.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-emerald-300" />
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {CRYPTO_KEYS.map((key) => {
                const p = providers.find((x) => x.providerKey === key);
                const on = p?.enabled;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-bold ${
                      selected === key
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-[#121f33] text-slate-400"
                    }`}
                  >
                    {CRYPTO_LABELS[key]}
                    {on ? " · ON" : ""}
                  </button>
                );
              })}
            </div>

            <section className="mt-3 rounded-3xl border border-white/10 bg-[#121f33] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Selected gateway
                  </p>
                  <h2 className="text-lg font-extrabold">{CRYPTO_LABELS[selected]}</h2>
                  <p className="text-[9px] text-emerald-300">
                    {configured ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Configuration loaded
                      </span>
                    ) : (
                      "Not configured · enter credentials below"
                    )}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[10px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Field
                  label="API Base URL"
                  value={form.apiBaseUrl}
                  onChange={(v) => setForm((f) => ({ ...f, apiBaseUrl: v }))}
                  placeholder="https://api.provider.com"
                />
                <Field
                  label="Merchant / Store ID"
                  value={form.publicId}
                  onChange={(v) => setForm((f) => ({ ...f, publicId: v }))}
                  placeholder="Merchant ID"
                />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    API Key
                  </span>
                  <div className="mt-1 flex items-center rounded-2xl border border-white/10 bg-black/20 px-3">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={configured ? "•••• leave blank to keep" : "Enter API key"}
                      className="w-full bg-transparent py-3 text-xs outline-none"
                    />
                    <button type="button" onClick={() => setShowSecret((v) => !v)} className="text-slate-500">
                      {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    API Secret
                  </span>
                  <input
                    type={showSecret ? "text" : "password"}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder={configured ? "•••• leave blank to keep" : "Enter API secret"}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field
                  label="Webhook / IPN URL"
                  value={form.webhookUrl}
                  onChange={(v) => setForm((f) => ({ ...f, webhookUrl: v }))}
                  placeholder="https://your.app/api/payments/webhook"
                />
                <Field
                  label="Network / Chain"
                  value={form.placementId}
                  onChange={(v) => setForm((f) => ({ ...f, placementId: v }))}
                  placeholder="TRC20 / ERC20 / BTC"
                />
                <Field
                  label="Postback URL"
                  value={form.postbackUrl}
                  onChange={(v) => setForm((f) => ({ ...f, postbackUrl: v }))}
                  placeholder="TASKORA deposit callback"
                />
                <Field
                  label="Min payout USD"
                  value={form.minimumPayoutUsd}
                  onChange={(v) => setForm((f) => ({ ...f, minimumPayoutUsd: v }))}
                  placeholder="10"
                />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-[#07120d] disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {busy ? "Saving…" : "Save Payment Settings"}
              </button>

              {message ? (
                <p className="mt-3 text-center text-xs leading-relaxed text-slate-400">{message}</p>
              ) : null}

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3 text-[10px] leading-5 text-slate-500">
                <CreditCard className="mb-1 inline size-3.5 text-emerald-300" /> Credentials never
                leave the server. After save, wire the webhook to credit deposits only after signed
                confirmation from the gateway.
              </div>
            </section>

            <Link
              to="/owner/monetization"
              className="mt-4 flex items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"
            >
              Open Provider Control Center (Games / Ads / Video) →
            </Link>
            <Link
              to="/owner/economy"
              className="mt-2 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-300"
            >
              Economy Controls (min withdrawal, fees) →
            </Link>
          </>
        )}
      </main>
    </OwnerShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none focus:border-emerald-400/40"
      />
    </label>
  );
}
