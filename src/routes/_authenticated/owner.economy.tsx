import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save, Search, Settings2 } from "lucide-react";
import {
  getAdvertiseEconomy,
  saveAdvertiseEconomySettings,
  updateAdvertiseService,
} from "@/lib/advertise-owner.functions";
import { OwnerShell } from "@/components/OwnerShell";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";

export const Route = createFileRoute("/_authenticated/owner/economy")({
  component: OwnerEconomyPage,
});

type ServiceRow = {
  service_id: string;
  platform: string;
  service_name: string;
  min_quantity: number;
  max_quantity: number;
  customer_unit_price: number;
  tasker_unit_reward: number;
  taskora_unit_margin: number;
  active: boolean;
  pricing_model: string;
};

const DEFAULTS = {
  default_tasker_share_percent: 70,
  default_taskora_margin_percent: 30,
  youtube_watch_customer_per_second: 0.0001,
  youtube_watch_tasker_per_second: 0.00007,
  youtube_watch_taskora_per_second: 0.00003,
  youtube_watch_min_seconds: 1,
  youtube_watch_max_seconds: 3600,
  global_min_campaign_value_usd: 0,
  global_max_campaign_value_usd: 0,
};

function fmt(value: number) {
  return `$${Number(value).toFixed(Number(value) < 0.01 ? 6 : 3)}`;
}

function asPlatform(p: string): Platform | null {
  const key = p.toLowerCase().replace(/\s+/g, "_") as Platform;
  const known: Platform[] = [
    "telegram", "youtube", "whatsapp", "x", "instagram", "tiktok", "discord",
    "facebook", "reddit", "linkedin", "twitch", "threads", "spotify", "soundcloud",
    "audiomack", "pinterest", "google", "website", "survey", "app_review",
  ];
  if (known.includes(key)) return key;
  if (p.toLowerCase().includes("twitter")) return "x";
  return null;
}

function OwnerEconomyPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void getAdvertiseEconomy()
      .then((r) => {
        setSettings({ ...DEFAULTS, ...(r.settings ?? {}) });
        setServices((r.services as ServiceRow[]) ?? []);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Could not load economy."));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) =>
      `${s.platform} ${s.service_name} ${s.service_id}`.toLowerCase().includes(q),
    );
  }, [services, search]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const row of filtered) {
      const key = row.platform || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const activeCount = services.filter((s) => s.active).length;

  function set(key: keyof typeof DEFAULTS, value: string) {
    setSettings((s) => ({ ...s, [key]: Number(value) }));
  }

  async function saveSettings() {
    setBusy(true);
    setMsg("");
    try {
      await saveAdvertiseEconomySettings({
        data: {
          taskerSharePercent: Number(settings.default_tasker_share_percent),
          marginPercent: Number(settings.default_taskora_margin_percent),
          youtubeWatchCustomerPerSecond: Number(settings.youtube_watch_customer_per_second),
          youtubeWatchTaskerPerSecond: Number(settings.youtube_watch_tasker_per_second),
          youtubeWatchTaskoraPerSecond: Number(settings.youtube_watch_taskora_per_second),
          youtubeWatchMinSeconds: Number(settings.youtube_watch_min_seconds),
          youtubeWatchMaxSeconds: Number(settings.youtube_watch_max_seconds),
          globalMinCampaignValueUsd: Number(settings.global_min_campaign_value_usd),
          globalMaxCampaignValueUsd: Number(settings.global_max_campaign_value_usd),
          reason,
        },
      });
      setReason("");
      setMsg("✓ Economy settings saved and audited.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function editService(row: ServiceRow) {
    const unit = row.pricing_model === "watch_second" ? "second" : "unit";
    const customer = window.prompt(`Customer price per ${unit} (USD)`, String(row.customer_unit_price));
    if (customer == null) return;
    const tasker = window.prompt("Tasker reward (USD)", String(row.tasker_unit_reward));
    if (tasker == null) return;
    const margin = window.prompt("TASKORA margin (USD)", String(row.taskora_unit_margin));
    if (margin == null) return;
    const min = window.prompt("Minimum quantity", String(row.min_quantity));
    if (min == null) return;
    const max = window.prompt("Maximum quantity", String(row.max_quantity));
    if (max == null) return;
    const why = window.prompt("Reason for this change (required for audit)");
    if (!why?.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const saved = await updateAdvertiseService({
        data: {
          serviceId: row.service_id,
          customerUnitPrice: Number(customer),
          taskerUnitReward: Number(tasker),
          taskoraUnitMargin: Number(margin),
          minQuantity: Number(min),
          maxQuantity: Number(max),
          active: row.active,
          reason: why,
        },
      });
      setServices((rows) =>
        rows.map((r) => (r.service_id === row.service_id ? (saved as ServiceRow) : r)),
      );
      setMsg(`✓ ${row.service_name} updated.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OwnerShell>
      <main className="px-4 pb-10 pt-4 text-white">
        <header className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Money · Pricing</p>
          <h1 className="text-xl font-extrabold tracking-tight">Platform prices</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            Control advertiser and tasker rates per network. Brand logos · audited edits · live data only.
          </p>
        </header>

        <section className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/8 bg-[#12141c] p-3">
            <p className="text-[9px] uppercase tracking-wide text-white/35">Services</p>
            <p className="mt-1 text-lg font-bold text-sky-300">{services.length}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#12141c] p-3">
            <p className="text-[9px] uppercase tracking-wide text-white/35">Active</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#12141c] p-3">
            <p className="text-[9px] uppercase tracking-wide text-white/35">Platforms</p>
            <p className="mt-1 text-lg font-bold text-amber-300">{byPlatform.length}</p>
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-amber-300/15 bg-[#12141c] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="size-4 text-amber-300" />
            <div>
              <p className="text-sm font-bold">Global economy</p>
              <p className="text-[10px] text-white/40">Defaults for new services · USD</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tasker share %" value={settings.default_tasker_share_percent} onChange={(v) => set("default_tasker_share_percent", v)} />
            <Field label="TASKORA margin %" value={settings.default_taskora_margin_percent} onChange={(v) => set("default_taskora_margin_percent", v)} />
            <Field label="Min order $ (0=off)" value={settings.global_min_campaign_value_usd} onChange={(v) => set("global_min_campaign_value_usd", v)} />
            <Field label="Max order $ (0=off)" value={settings.global_max_campaign_value_usd} onChange={(v) => set("global_max_campaign_value_usd", v)} />
          </div>
          <div className="mt-4 border-t border-white/8 pt-3">
            <p className="text-xs font-bold text-sky-200">YouTube Watch & Earn rates</p>
            <p className="mt-0.5 text-[10px] text-white/35">Per verified second</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Customer / sec" value={settings.youtube_watch_customer_per_second} onChange={(v) => set("youtube_watch_customer_per_second", v)} />
            <Field label="Tasker / sec" value={settings.youtube_watch_tasker_per_second} onChange={(v) => set("youtube_watch_tasker_per_second", v)} />
            <Field label="TASKORA / sec" value={settings.youtube_watch_taskora_per_second} onChange={(v) => set("youtube_watch_taskora_per_second", v)} />
            <Field label="Min seconds" value={settings.youtube_watch_min_seconds} onChange={(v) => set("youtube_watch_min_seconds", v)} />
            <Field label="Max seconds" value={settings.youtube_watch_max_seconds} onChange={(v) => set("youtube_watch_max_seconds", v)} />
          </div>
          <label className="mt-3 block text-[10px] font-semibold text-white/45">
            Audit reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you changing rates?" className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-amber-400/40" />
          </label>
          <button type="button" disabled={busy} onClick={() => void saveSettings()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffe08a] via-[#f5c542] to-[#c9961a] py-3.5 text-sm font-extrabold text-[#05070c] disabled:opacity-50">
            <Save className="size-4" />
            {busy ? "Saving…" : "SAVE GLOBAL ECONOMY"}
          </button>
        </section>

        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#12141c] px-3 py-2.5">
          <Search className="size-4 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search platform or service…" className="w-full bg-transparent text-sm outline-none placeholder:text-white/30" />
        </div>

        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Services by platform · {filtered.length}
        </p>

        <div className="space-y-4">
          {byPlatform.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/45">
              No services loaded yet. Seed advertise services in Supabase or publish from Advertise.
            </p>
          ) : (
            byPlatform.map(([platform, rows]) => {
              const pl = asPlatform(platform);
              return (
                <section key={platform} className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    {pl ? (
                      <PlatformLogo platform={pl} size={36} />
                    ) : (
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                        {platform.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-bold">{pl ? platformLabel(pl) : platform}</p>
                      <p className="text-[10px] text-white/40">{rows.length} services</p>
                    </div>
                  </div>
                  {rows.map((row) => (
                    <div key={row.service_id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{row.service_name}</p>
                          <p className="mt-0.5 text-[10px] text-white/40">
                            {row.pricing_model === "watch_second" ? "Per second" : "Per unit"} ·{" "}
                            {row.active ? <span className="text-emerald-300">Active</span> : <span className="text-amber-300">Paused</span>}
                          </p>
                        </div>
                        <button type="button" disabled={busy} onClick={() => void editService(row)} className="shrink-0 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[11px] font-bold text-amber-100">
                          Edit price
                        </button>
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                        <Metric label="Customer pays" value={fmt(Number(row.customer_unit_price))} />
                        <Metric label="Tasker earns" value={fmt(Number(row.tasker_unit_reward))} />
                        <Metric label="Platform margin" value={fmt(Number(row.taskora_unit_margin))} />
                      </div>
                      <p className="mt-2 text-[10px] text-white/35">
                        Qty {Number(row.min_quantity).toLocaleString()} – {Number(row.max_quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </section>
              );
            })
          )}
        </div>

        {msg ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center text-[12px] text-sky-100">{msg}</p>
        ) : null}
      </main>
    </OwnerShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-2">
      <p className="text-[8px] uppercase tracking-wide text-white/30">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-white/85">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[9px] font-semibold text-white/40">
      {label}
      <input
        type="number"
        step="any"
        value={value ?? 0}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-white outline-none focus:border-amber-400/40"
      />
    </label>
  );
}
