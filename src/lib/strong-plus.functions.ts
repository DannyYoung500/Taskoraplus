import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "node:crypto";
import { assertProofNotRecycled } from "@/lib/strong-ops";

export function proofPerceptualKey(opts: {
  proofText?: string | null;
  proofUrl?: string | null;
}): string | null {
  const parts: string[] = [];
  if (opts.proofUrl) {
    let u = String(opts.proofUrl).trim().toLowerCase();
    try {
      const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
      u = `${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, "");
    } catch {
      u = u.split("?")[0].split("#")[0];
    }
    u = u.replace(/\/(w|h|s|q)\d+\//g, "/").replace(/_\d+x\d+\./g, ".");
    parts.push(u);
  }
  if (opts.proofText) {
    const t = String(opts.proofText)
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[0-9a-f]{8,}/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    if (t.length >= 12) parts.push(t);
  }
  if (!parts.length) return null;
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function assertProofPerceptualUnique(opts: {
  userId: string;
  proofText?: string | null;
  proofUrl?: string | null;
}): Promise<{ proofHash: string | null; perceptualKey: string | null }> {
  const base = await assertProofNotRecycled(opts);
  const pKey = proofPerceptualKey(opts);
  if (!pKey) return { proofHash: base.proofHash, perceptualKey: null };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id, proof_hash, proof_url")
      .neq("user_id", opts.userId)
      .limit(200);
    if (data?.length) {
      for (const row of data) {
        const otherKey = proofPerceptualKey({
          proofUrl: (row as { proof_url?: string }).proof_url,
          proofText: null,
        });
        if (otherKey && otherKey === pKey) {
          throw new Error(
            "This proof looks like a recycled screenshot/link used by another account. Submit original proof only.",
          );
        }
        const ph = String((row as { proof_hash?: string }).proof_hash ?? "");
        if (ph && base.proofHash && ph === base.proofHash) {
          throw new Error("This proof was already used on another account.");
        }
      }
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("proof") || e.message.includes("recycled"))) throw e;
  }
  return { proofHash: base.proofHash, perceptualKey: pKey };
}

const METHOD_WD_LIMITS: Record<string, { max24h: number; maxAmount24h: number }> = {
  USDT_TRC20: { max24h: 5, maxAmount24h: 500 },
  TRC20: { max24h: 5, maxAmount24h: 500 },
  USDT_BEP20: { max24h: 5, maxAmount24h: 500 },
  BEP20: { max24h: 5, maxAmount24h: 500 },
  USDT_ERC20: { max24h: 3, maxAmount24h: 300 },
  ERC20: { max24h: 3, maxAmount24h: 300 },
  BINANCE: { max24h: 3, maxAmount24h: 200 },
  BYBIT: { max24h: 3, maxAmount24h: 200 },
  OKX: { max24h: 3, maxAmount24h: 200 },
  CEX: { max24h: 3, maxAmount24h: 200 },
};

export async function assertWithdrawalMethodVelocity(opts: {
  userId: string;
  method: string;
  amount: number;
}): Promise<void> {
  const method = String(opts.method || "").trim().toUpperCase().replace(/\s+/g, "_");
  const limits =
    METHOD_WD_LIMITS[method] ||
    (method.includes("TRC")
      ? METHOD_WD_LIMITS.TRC20
      : method.includes("BEP")
        ? METHOD_WD_LIMITS.BEP20
        : method.includes("ERC")
          ? METHOD_WD_LIMITS.ERC20
          : { max24h: 4, maxAmount24h: 250 });
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("withdrawals")
      .select("id, amount, method, status, created_at")
      .eq("user_id", opts.userId)
      .gte("created_at", since)
      .not("status", "in", '("failed","rejected","cancelled")')
      .limit(50);
    const tail = method.split("_").pop() || method;
    const rows = (data ?? []).filter((r) => {
      const m = String((r as { method?: string }).method || "").toUpperCase().replace(/\s+/g, "_");
      return m === method || m.includes(tail);
    });
    if (rows.length >= limits.max24h) {
      throw new Error(
        `Method limit: max ${limits.max24h} ${method} withdrawals per 24h. Try another network or wait.`,
      );
    }
    const sumAmt = rows.reduce((s, r) => s + Number((r as { amount?: number }).amount || 0), 0) + Number(opts.amount);
    if (sumAmt > limits.maxAmount24h) {
      throw new Error(
        `Method limit: max $${limits.maxAmount24h} via ${method} per 24h (including this request).`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Method limit")) throw e;
  }
}

export async function assertDeviceAddressLock(opts: {
  userId: string;
  address: string;
  fingerprint?: string | null;
}): Promise<void> {
  const addr = opts.address.trim();
  if (addr.length < 10) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let fp = opts.fingerprint;
    if (!fp) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("device_fp").eq("id", opts.userId).maybeSingle();
      fp = (prof as { device_fp?: string } | null)?.device_fp ?? null;
    }
    if (!fp || String(fp).length < 8) return;
    const { data: cluster } = await supabaseAdmin.from("profiles").select("id").eq("device_fp", fp).limit(12);
    if ((cluster ?? []).length >= 3) {
      throw new Error("Withdrawal blocked: this device is linked to too many accounts. Contact support.");
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const ids = (cluster ?? []).map((p) => p.id);
    if (!ids.length) return;
    const { data: wds } = await supabaseAdmin
      .from("withdrawals")
      .select("address, user_id, created_at, status")
      .in("user_id", ids)
      .gte("created_at", since)
      .limit(30);
    const otherAddrs = new Set(
      (wds ?? [])
        .map((w) => String((w as { address?: string }).address || "").trim().toLowerCase())
        .filter((a) => a && a !== addr.toLowerCase()),
    );
    if (otherAddrs.size > 0) {
      const { data: mine } = await supabaseAdmin
        .from("withdrawals")
        .select("id")
        .eq("user_id", opts.userId)
        .eq("address", addr)
        .in("status", ["paid", "completed", "processing", "pending"])
        .limit(1);
      if (!mine?.length) {
        throw new Error(
          "This device already used a different payout address recently. Wait 24h or use the same address.",
        );
      }
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("device") || e.message.includes("address") || e.message.includes("blocked")))
      throw e;
  }
}

export async function runStuckTaskSla(opts?: {
  hours?: number;
  autoPause?: boolean;
}): Promise<{ checked: number; stuck: number; paused: number; titles: string[] }> {
  const hours = Math.max(6, Math.min(168, Number(opts?.hours ?? 48)));
  const autoPause = opts?.autoPause !== false;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  let checked = 0, stuck = 0, paused = 0;
  const titles: string[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, title, status, is_active, created_at")
      .eq("status", "active")
      .eq("is_active", true)
      .lte("created_at", cutoff)
      .limit(100);
    checked = (tasks ?? []).length;
    for (const t of tasks ?? []) {
      const { count } = await supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("task_id", t.id)
        .in("status", ["verified", "approved", "auto_approved"]);
      if ((count ?? 0) > 0) continue;
      stuck += 1;
      titles.push(String((t as { title?: string }).title ?? t.id).slice(0, 40));
      if (autoPause) {
        await supabaseAdmin.from("tasks").update({ status: "paused", is_active: false }).eq("id", t.id);
        paused += 1;
      }
    }
    if (stuck > 0) {
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(
          `⏱ <b>Stuck task SLA</b> (${hours}h)\nChecked: ${checked} · Stuck: <b>${stuck}</b> · Auto-paused: ${paused}\n` +
            titles.slice(0, 8).map((x) => `· ${x}`).join("\n") +
            `\nTime: ${new Date().toISOString()}`,
        );
      } catch {}
    }
  } catch (e) {
    console.warn("[stuck-sla]", e);
  }
  return { checked, stuck, paused, titles };
}

export const ownerRunStuckTaskSla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { hours?: number; autoPause?: boolean }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    return runStuckTaskSla({
      hours: Number((data as { hours?: number })?.hours ?? 48),
      autoPause: (data as { autoPause?: boolean })?.autoPause !== false,
    });
  });

export const ownerGetCompletionsHeatMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("submissions")
      .select("user_id, status, created_at")
      .in("status", ["verified", "approved", "auto_approved"])
      .order("created_at", { ascending: false })
      .limit(3000);
    const userIds = [...new Set((subs ?? []).map((s) => String((s as { user_id: string }).user_id)))];
    const countryMap = new Map<string, number>();
    if (userIds.length) {
      for (let i = 0; i < userIds.length; i += 100) {
        const chunk = userIds.slice(i, i + 100);
        const { data: profiles } = await supabaseAdmin.from("profiles").select("id, country_code, country").in("id", chunk);
        const byId = new Map(
          (profiles ?? []).map((p) => [
            p.id,
            String((p as { country_code?: string }).country_code ?? (p as { country?: string }).country ?? "Unknown").trim().toUpperCase() || "UNKNOWN",
          ]),
        );
        for (const s of subs ?? []) {
          const uid = String((s as { user_id: string }).user_id);
          if (!chunk.includes(uid)) continue;
          const cc = byId.get(uid) ?? "UNKNOWN";
          countryMap.set(cc, (countryMap.get(cc) ?? 0) + 1);
        }
      }
    }
    const rows = [...countryMap.entries()].map(([country, completions]) => ({ country, completions })).sort((a, b) => b.completions - a.completions).slice(0, 40);
    return { total: rows.reduce((s, r) => s + r.completions, 0), rows };
  });

/** 4 · Advertiser reputation */
export async function scoreAdvertiserReputation(advertiserId: string): Promise<{
  score: number; rejected: number; approved: number; pending: number; shouldPause: boolean; reason?: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tasks } = await supabaseAdmin.from("tasks").select("id").eq("created_by", advertiserId).limit(80);
  const taskIds = (tasks ?? []).map((t) => t.id);
  if (!taskIds.length) return { score: 100, rejected: 0, approved: 0, pending: 0, shouldPause: false };
  const { data: subs } = await supabaseAdmin.from("submissions").select("status").in("task_id", taskIds).limit(500);
  let rejected = 0, approved = 0, pending = 0;
  for (const s of subs ?? []) {
    const st = String((s as { status?: string }).status ?? "").toLowerCase();
    if (st === "rejected" || st === "denied") rejected += 1;
    else if (st === "verified" || st === "approved" || st === "auto_approved") approved += 1;
    else if (st === "pending" || st === "submitted") pending += 1;
  }
  const total = rejected + approved;
  const rejectRate = total > 0 ? rejected / total : 0;
  const score = Math.max(0, Math.round(100 - rejectRate * 100));
  const shouldPause = total >= 8 && rejectRate >= 0.45;
  return {
    score, rejected, approved, pending, shouldPause,
    reason: shouldPause ? `High rejection rate (${Math.round(rejectRate * 100)}%). Pause campaigns and review proof quality.` : undefined,
  };
}

export const ownerRunAdvertiserReputation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { advertiserId?: string; autoPause?: boolean }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const autoPause = (data as { autoPause?: boolean })?.autoPause !== false;
    const advertiserId = (data as { advertiserId?: string })?.advertiserId;
    const results: Array<{ id: string; score: number; paused: number; reason?: string }> = [];
    if (advertiserId) {
      const rep = await scoreAdvertiserReputation(advertiserId);
      let paused = 0;
      if (rep.shouldPause && autoPause) {
        const { data: updated } = await supabaseAdmin.from("tasks").update({ status: "paused", is_active: false }).eq("created_by", advertiserId).eq("is_active", true).select("id");
        paused = (updated ?? []).length;
        try {
          const { sendOwnerHtml } = await import("@/lib/notify-owner");
          await sendOwnerHtml(`📉 <b>Advertiser reputation pause</b>\nUser: <code>${advertiserId.slice(0, 8)}</code>\nScore: ${rep.score} · Rejected: ${rep.rejected}/${rep.rejected + rep.approved}\nPaused: ${paused}`);
        } catch {}
      }
      results.push({ id: advertiserId, score: rep.score, paused, reason: rep.reason });
      return { scanned: 1, results };
    }
    const { data: activeTasks } = await supabaseAdmin.from("tasks").select("created_by").eq("is_active", true).eq("status", "active").limit(200);
    const ids = [...new Set((activeTasks ?? []).map((t) => String((t as { created_by?: string }).created_by ?? "")).filter(Boolean))];
    for (const id of ids.slice(0, 40)) {
      const rep = await scoreAdvertiserReputation(id);
      let paused = 0;
      if (rep.shouldPause && autoPause) {
        const { data: updated } = await supabaseAdmin.from("tasks").update({ status: "paused", is_active: false }).eq("created_by", id).eq("is_active", true).select("id");
        paused = (updated ?? []).length;
      }
      if (rep.shouldPause || rep.score < 60) results.push({ id, score: rep.score, paused, reason: rep.reason });
    }
    if (results.some((r) => r.paused > 0)) {
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(`📉 <b>Advertiser reputation sweep</b>\nFlagged: ${results.length}\nPaused: ${results.reduce((s, r) => s + r.paused, 0)}`);
      } catch {}
    }
    return { scanned: ids.length, results };
  });

/** 8 · Batch receipt hash */
export function mintBatchReceiptHash(opts: {
  withdrawalIds: string[];
  operatorId: string;
  txPrefix?: string;
}): string {
  const payload = [
    opts.operatorId,
    (opts.withdrawalIds || []).slice().sort().join(","),
    opts.txPrefix ?? "",
    new Date().toISOString().slice(0, 13),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
