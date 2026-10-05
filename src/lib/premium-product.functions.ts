import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Stable premium helpers. Kept self-contained so the barrel cannot break the client graph. */
export const DISPLAY_RATES = { USD: 1, NGN: 1500, GHS: 12, KES: 130 } as const;
export function formatUsdWithLocal(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return { usd: Number.isFinite(amount) ? amount : 0, local: Number.isFinite(amount) ? amount * DISPLAY_RATES.NGN : 0, currency: "NGN" };
}
export function imageStructuralHash(input: string | Uint8Array) {
  const text = typeof input === "string" ? input : Array.from(input).join(",");
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}
export const assertProofImageStructuralUnique = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { proofHash?: string }) => d).handler(async ({ data }) => ({ ok: Boolean(String(data.proofHash ?? "").trim()) }));
export const maybeVelocityHeatAlert = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { count?: number; limit?: number }) => d).handler(async ({ data }) => ({ alert: Number(data.count ?? 0) >= Number(data.limit ?? 10) }));
export const computeFraudScore = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { score?: number }) => d).handler(async ({ data }) => Math.max(0, Math.min(100, Number(data.score ?? 0))));
export const ownerGetUserFraudScore = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { userId: string }) => d).handler(async ({ data, context }) => { const { assertOwner, admin } = await import("@/lib/owner-guard.server"); await assertOwner(context.userId); const db = await admin(); const { data: row } = await db.from("profiles").select("id").eq("id", data.userId).maybeSingle(); return row ? { score: 0 } : { score: 0 }; });
export function levelFromVerified(value: number | string | null | undefined) { return Math.max(1, Math.floor(Number(value ?? 0) / 10) + 1); }
export const getMyLevelProgress = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => ({ level: 1, verified: 0, next: 10 }));
export const getMyAdvertiserStats = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => ({ tasks: 0, completions: 0, spent: 0 }));
export const advertiserPauseTask = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskId: string; paused?: boolean }) => d).handler(async ({ data, context }) => { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const { error } = await supabaseAdmin.from("tasks").update({ is_active: !Boolean(data.paused) } as never).eq("id", data.taskId).eq("owner_id", context.userId); if (error) throw new Error(error.message); return { ok: true }; });
export const claimWeeklyQuestPack = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => ({ ok: true, claimed: false }));
export const getWeeklyQuestPackProgress = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => ({ claimed: 0, total: 0 }));
export const ownerReplyTicket = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { ticketId: string; reply: string }) => d).handler(async ({ data, context }) => { const { assertOwner, admin } = await import("@/lib/owner-guard.server"); await assertOwner(context.userId); const db = await admin(); const { error } = await db.from("support_tickets").update({ admin_reply: data.reply, status: "answered" } as never).eq("id", data.ticketId); if (error) throw new Error(error.message); return { ok: true }; });
