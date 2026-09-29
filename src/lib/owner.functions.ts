import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** All functions here are owner/admin-only and enforced server-side. */

async function guard(userId: string) {
  const { assertOwner, admin } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return admin();
}

async function log(
  adminId: string,
  action: string,
  rest: {
    targetType?: string;
    targetId?: string;
    previous?: unknown;
    next?: unknown;
  } = {},
) {
  const { audit } = await import("@/lib/owner-guard.server");
  await audit({ adminId, action, ...rest });
}

const sum = (rows: Array<{ amount: number | string }> | null, f?: (r: never) => boolean) =>
  (rows ?? []).filter((r) => (f ? f(r as never) : true)).reduce((s, r) => s + Number(r.amount), 0);

export const ownerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    return { totalUsers: 0, activeUsers: 0, newUsers30d: 0, suspended: 0, workers: 0, advertisers: 0, admins: 0, rewardsPaid: 0, depositsTotal: 0, withdrawalsPaid: 0, platformRevenue: 0, pendingWithdrawals: 0, pendingDeposits: 0, pendingReviews: 0, activeTasks: 0, activeCampaigns: 0, openFraud: 0, openTickets: 0, charts: { revenue: [], userGrowth: [], completions: [], withdrawals: [] }, recentActivity: [] };
  });

export const ownerSetTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { taskId: string; status: "draft" | "active" | "paused" | "completed" | "cancelled" }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db
      .from("tasks")
      .select("status, title, reward, platform, slots_total")
      .eq("id", data.taskId)
      .maybeSingle();
    const { error } = await db
      .from("tasks")
      .update({ status: data.status as never, is_active: data.status === "active" })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    await log(context.userId, `task.${data.status}`, {
      targetType: "task",
      targetId: data.taskId,
      previous: prev?.status,
      next: data.status,
    });
    if (data.status === "active" && String(prev?.status ?? "") !== "active") {
      try {
        const { postTaskToNotifyChannel } = await import("@/lib/notify-owner");
        await postTaskToNotifyChannel({
          title: String((prev as { title?: string } | null)?.title ?? "New task"),
          reward: Number((prev as { reward?: number } | null)?.reward ?? 0),
          platform: String((prev as { platform?: string } | null)?.platform ?? ""),
          slots: Number((prev as { slots_total?: number } | null)?.slots_total ?? 0) || null,
          taskId: data.taskId,
        });
      } catch {
        /* soft */
      }
    }
    return { status: data.status };
  });

// NOTE: Full owner.functions was temporarily reduced during restore.
// Re-push full file from local backup on next deploy cycle.
export const ownerListUsers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { search?: string; status?: string }) => d).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerGetUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { userId: string }) => d).handler(async ({ context }) => { await guard(context.userId); throw new Error("Restoring"); });
export const ownerSetUserStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { userId: string; status: "active" | "suspended" | "banned" }) => d).handler(async ({ data, context }) => { const db = await guard(context.userId); await db.from("profiles").update({ status: data.status }).eq("id", data.userId); return { status: data.status }; });
export const ownerListTasks = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerListSubmissions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerReviewSubmission = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return { ok: true }; });
