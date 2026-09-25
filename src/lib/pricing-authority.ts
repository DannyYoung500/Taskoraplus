/**
 * Server-side pricing authority — catalog is source of truth.
 * 70% worker / 30% Taskora. Browser prices are ignored.
 */
import { SERVICES, TASKER_SHARE, TASKORA_SHARE, type ServiceDef } from "@/lib/advertise-services";

export type LockedPricing = {
  serviceId: string;
  customerUnit: number;
  workerUnit: number;
  taskoraUnit: number;
  qty: number;
  customerTotal: number;
  workerTotal: number;
  taskoraTotal: number;
  watchSeconds?: number;
};

export function findServiceById(serviceId: string): ServiceDef | null {
  for (const list of Object.values(SERVICES)) {
    const hit = list.find((s) => s.id === serviceId);
    if (hit) return hit;
  }
  return null;
}

export async function loadCatalogService(serviceId: string): Promise<{
  customer: number;
  worker: number;
  taskora: number;
  minQty: number;
  maxQty: number;
  active: boolean;
  unit: string;
  taskType: string;
  title: string;
} | null> {
  const fallback = findServiceById(serviceId);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("advertise_service_catalog" as never)
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (data) {
      const row = data as Record<string, unknown>;
      const customer = Number(row.customer_unit_price ?? fallback?.fromUsd ?? 0);
      const worker = Number(row.tasker_unit_reward ?? customer * TASKER_SHARE);
      const taskora = Number(row.taskora_unit_margin ?? customer * TASKORA_SHARE);
      return {
        customer,
        worker,
        taskora,
        minQty: Number(row.min_quantity ?? fallback?.minQty ?? 1),
        maxQty: Number(row.max_quantity ?? fallback?.maxQty ?? 10000),
        active: row.active !== false,
        unit: String(row.unit ?? fallback?.unit ?? "units"),
        taskType: String(row.task_type ?? fallback?.taskType ?? "action"),
        title: String(row.service_name ?? fallback?.title ?? serviceId),
      };
    }
  } catch {
    /* table may not exist */
  }
  if (!fallback) return null;
  return {
    customer: fallback.fromUsd,
    worker: fallback.taskerUsd,
    taskora: fallback.taskoraUsd,
    minQty: fallback.minQty,
    maxQty: fallback.maxQty,
    active: true,
    unit: fallback.unit,
    taskType: fallback.taskType,
    title: fallback.title,
  };
}

export async function loadWatchRatePerSecond(): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("advertise_economy_settings" as never)
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (data) {
      const r = Number((data as { youtube_watch_customer_per_second?: number }).youtube_watch_customer_per_second);
      if (r > 0) return r;
    }
  } catch {
    /* soft */
  }
  const yt = findServiceById("yt_watch");
  return yt?.fromUsd && yt.fromUsd > 0 ? yt.fromUsd : 0.0003;
}

export async function resolveLockedPricing(opts: {
  serviceId: string;
  qty: number;
  watchSeconds?: number;
}): Promise<LockedPricing> {
  const cat = await loadCatalogService(opts.serviceId);
  if (!cat || !cat.active) throw new Error("Service not available in catalog.");
  const qty = Math.max(cat.minQty, Math.min(cat.maxQty, Math.floor(opts.qty) || cat.minQty));

  let customerUnit = cat.customer;
  let workerUnit = cat.worker;
  let taskoraUnit = cat.taskora;
  let watchSeconds: number | undefined;

  if (cat.unit === "seconds" || cat.taskType === "watch" || opts.serviceId.includes("watch")) {
    const secs = Math.max(1, Math.min(28800, Math.floor(opts.watchSeconds ?? 60)));
    watchSeconds = secs;
    const rate = await loadWatchRatePerSecond();
    customerUnit = rate * secs;
    workerUnit = customerUnit * TASKER_SHARE;
    taskoraUnit = customerUnit * TASKORA_SHARE;
  } else {
    workerUnit = customerUnit * TASKER_SHARE;
    taskoraUnit = customerUnit * TASKORA_SHARE;
  }

  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  customerUnit = round6(customerUnit);
  workerUnit = round6(workerUnit);
  taskoraUnit = round6(taskoraUnit);

  return {
    serviceId: opts.serviceId,
    customerUnit,
    workerUnit,
    taskoraUnit,
    qty,
    customerTotal: round6(customerUnit * qty),
    workerTotal: round6(workerUnit * qty),
    taskoraTotal: round6(taskoraUnit * qty),
    watchSeconds,
  };
}

export function formatUsd6(n: number) {
  return `$${Number(n).toFixed(6)}`;
}

export function formatWatchClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
