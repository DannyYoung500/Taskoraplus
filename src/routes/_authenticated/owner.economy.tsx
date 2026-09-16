import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Save, Search, Settings2 } from "lucide-react";
import { getAdvertiseEconomy, saveAdvertiseEconomySettings, updateAdvertiseService } from "@/lib/advertise-owner.functions";

export const Route = createFileRoute("/_authenticated/owner/economy")({ component: OwnerEconomyPage });

type ServiceRow = {
  service_id: string; platform: string; service_name: string; min_quantity: number; max_quantity: number;
  customer_unit_price: number; tasker_unit_reward: number; taskora_unit_margin: number; active: boolean; pricing_model: string;
};

const DEFAULTS = {
  default_tasker_share_percent: 70, default_taskora_margin_percent: 30,
  youtube_watch_customer_per_second: .0001, youtube_watch_tasker_per_second: .00007, youtube_watch_taskora_per_second: .00003,
  youtube_watch_min_seconds: 1, youtube_watch_max_seconds: 3600, global_min_campaign_value_usd: 0, global_max_campaign_value_usd: 0,
};

function fmt(value: number) { return `$${Number(value).toFixed(Number(value) < .01 ? 6 : 3)}`; }

function OwnerEconomyPage() {
  const [settings, setSettings] = useState<any>(DEFAULTS);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { void getAdvertiseEconomy().then((r) => { setSettings(r.settings ?? DEFAULTS); setServices(r.services as ServiceRow[]); }).catch((e) => setMsg(e instanceof Error ? e.message : "Could not load economy.")); }, []);

  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return !q ? services : services.filter((s) => `${s.platform} ${s.service_name} ${s.service_id}`.toLowerCase().includes(q)); }, [services, search]);
  const activeCount = services.filter((s) => s.active).length;
  const marginTotal = services.reduce((sum, s) => sum + Number(s.taskora_unit_margin), 0);

  function set(key: string, value: string) { setSettings((s: any) => ({ ...s, [key]: Number(value) })); }

  async function saveSettings() {
    setBusy(true); setMsg("");
    try {
      await saveAdvertiseEconomySettings({ data: {
        taskerSharePercent: Number(settings.default_tasker_share_percent), marginPercent: Number(settings.default_taskora_margin_percent),
        youtubeWatchCustomerPerSecond: Number(settings.youtube_watch_customer_per_second), youtubeWatchTaskerPerSecond: Number(settings.youtube_watch_tasker_per_second), youtubeWatchTaskoraPerSecond: Number(settings.youtube_watch_taskora_per_second),
        youtubeWatchMinSeconds: Number(settings.youtube_watch_min_seconds), youtubeWatchMaxSeconds: Number(settings.youtube_watch_max_seconds),
        globalMinCampaignValueUsd: Number(settings.global_min_campaign_value_usd), globalMaxCampaignValueUsd: Number(settings.global_max_campaign_value_usd), reason,
      }});
      setReason(""); setMsg("Economy settings saved and audited.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(false); }
  }

  async function editService(row: ServiceRow) {
    const customer = window.prompt(`Customer price per ${row.pricing_model === "watch_second" ? "second" : "unit"}`, String(row.customer_unit_price));
    if (customer == null) return;
    const tasker = window.prompt("Tasker reward", String(row.tasker_unit_reward));
    if (tasker == null) return;
    const margin = window.prompt("TASKORA margin", String(row.taskora_unit_margin));
    if (margin == null) return;
    const min = window.prompt("Minimum quantity", String(row.min_quantity));
    if (min == null) return;
    const max = window.prompt("Maximum quantity", String(row.max_quantity));
    if (max == null) return;
    const why = window.prompt("Reason for this pricing/limit change");
    if (!why?.trim()) return;
    setBusy(true); setMsg("");
    try {
      const saved = await updateAdvertiseService({ data: { serviceId: row.service_id, customerUnitPrice: Number(customer), taskerUnitReward: Number(tasker), taskoraUnitMargin: Number(margin), minQuantity: Number(min), maxQuantity: Number(max), active: row.active, reason: why } });
      setServices((rows) => rows.map((r) => r.service_id === row.service_id ? saved as ServiceRow : r));
      setMsg(`${row.service_name} updated.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Update failed."); } finally { setBusy(false); }
  }

  return <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
    <div className="mb-4 flex items-center gap-2"><Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60"><ChevronLeft className="size-4" /></Link><div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-[.22em] text-amber-300">Owner Control</p><h1 className="text-xl font-extrabold">Advertise Economy</h1></div><Settings2 className="size-5 text-amber-300" /></div>

    <section className="grid grid-cols-3 gap-2"><Stat label="Services" value={String(services.length)} /><Stat label="Active" value={String(activeCount)} /><Stat label="Margin sum" value={fmt(marginTotal)} /></section>

    <section className="mt-4 rounded-3xl border border-amber-300/15 bg-[#12141c] p-4">
      <div className="mb-3"><p className="text-sm font-bold">Global economy</p><p className="mt-1 text-[10px] text-white/40">All money values are USD. Changes are owner-only and audited.</p></div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tasker share %" value={settings.default_tasker_share_percent} onChange={(v) => set("default_tasker_share_percent", v)} />
        <Field label="TASKORA margin %" value={settings.default_taskora_margin_percent} onChange={(v) => set("default_taskora_margin_percent", v)} />
        <Field label="Global min order $ (0 = off)" value={settings.global_min_campaign_value_usd} onChange={(v) => set("global_min_campaign_value_usd", v)} />
        <Field label="Global max order $ (0 = off)" value={settings.global_max_campaign_value_usd} onChange={(v) => set("global_max_campaign_value_usd", v)} />
      </div>
      <div className="mt-4 border-t border-white/8 pt-3"><p className="text-xs font-bold">YouTube Watch & Earn</p><p className="mt-1 text-[10px] text-white/35">Advertise watch campaigns use verified seconds.</p></div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Customer / second" value={settings.youtube_watch_customer_per_second} onChange={(v) => set("youtube_watch_customer_per_second", v)} />
        <Field label="Tasker / second" value={settings.youtube_watch_tasker_per_second} onChange={(v) => set("youtube_watch_tasker_per_second", v)} />
        <Field label="TASKORA / second" value={settings.youtube_watch_taskora_per_second} onChange={(v) => set("youtube_watch_taskora_per_second", v)} />
        <Field label="Min seconds" value={settings.youtube_watch_min_seconds} onChange={(v) => set("youtube_watch_min_seconds", v)} />
        <Field label="Max seconds" value={settings.youtube_watch_max_seconds} onChange={(v) => set("youtube_watch_max_seconds", v)} />
      </div>
      <label className="mt-3 block text-[10px] font-semibold text-white/45">Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you changing the economy?" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" /></label>
      <button type="button" disabled={busy} onClick={() => void saveSettings()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffe08a] via-[#f5c542] to-[#c9961a] py-3 text-sm font-extrabold text-[#05070c] disabled:opacity-50"><Save className="size-4" />{busy ? "Saving…" : "SAVE ECONOMY"}</button>
    </section>

    <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#12141c] px-3 py-2"><Search className="size-4 text-white/30" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search service, platform or ID" className="w-full bg-transparent text-xs outline-none" /></div>
    <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Service pricing & limits · {filtered.length}</p>
    <div className="space-y-2">
      {filtered.map((row) => <div key={row.service_id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold">{row.service_name}</p><p className="mt-1 text-[10px] capitalize text-white/35">{row.platform} · {row.pricing_model === "watch_second" ? "per second" : "per unit"}</p></div><button type="button" disabled={busy} onClick={() => void editService(row)} className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-2.5 py-1.5 text-[10px] font-bold text-amber-200">Edit</button></div><div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]"><Metric label="Customer" value={fmt(Number(row.customer_unit_price))} /><Metric label="Tasker" value={fmt(Number(row.tasker_unit_reward))} /><Metric label="Margin" value={fmt(Number(row.taskora_unit_margin))} /></div><p className="mt-2 text-[10px] text-white/35">Min {Number(row.min_quantity).toLocaleString()} · Max {Number(row.max_quantity).toLocaleString()} · {row.active ? "Active" : "Paused"}</p></div>)}
    </div>
    {msg ? <p className="mt-4 text-center text-[11px] text-white/55">{msg}</p> : null}
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-[#12141c] p-3"><p className="text-[9px] uppercase tracking-wide text-white/30">{label}</p><p className="mt-1 text-sm font-bold text-amber-200">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-black/20 p-2"><p className="text-[8px] text-white/30">{label}</p><p className="mt-0.5 font-bold text-white/75">{value}</p></div>; }
function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) { return <label className="block text-[9px] font-semibold text-white/40">{label}<input type="number" step="any" value={value ?? 0} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white outline-none" /></label>; }
