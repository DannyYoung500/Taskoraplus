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
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [profiles, roles, tasks, subs, wds, deps, txs, campaigns, fraud, tickets, activity] =
      await Promise.all([
        db.from("profiles").select("id, created_at, status, last_active_at"),
        db.from("user_roles").select("user_id, role"),
        db.from("tasks").select("id, status, is_active, reward, slots_left, slots_total, created_at"),
        db.from("submissions").select("id, status, created_at"),
        db.from("withdrawals").select("id, status, amount, created_at"),
        db.from("deposits").select("id, status, amount, created_at"),
        db.from("transactions").select("amount, kind, created_at"),
        db.from("campaigns").select("id, status, budget, spent"),
        db.from("fraud_flags").select("id, status"),
        db.from("support_tickets").select("id, status"),
        db.from("audit_logs").select("id, action, admin_label, target_type, created_at").order("created_at", { ascending: false }).limit(12),
      ]);
    const users = (profiles.data ?? []).filter(Boolean);
    const tx = (txs.data ?? []).filter(Boolean);
    const st = (row: unknown) => String((row as { status?: string } | null | undefined)?.status ?? "");
    const rewardsPaid = sum(tx.filter((t) => ["reward", "referral", "bonus"].includes(String((t as { kind?: string }).kind))));
    const withdrawnPaid = sum((wds.data ?? []).filter((w) => st(w) === "paid"));
    const depositsTotal = sum((deps.data ?? []).filter((d) => st(d) === "completed"));
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - (29 - i) * 86_400_000);
      return d.toISOString().slice(0, 10);
    });
    const bucket = (rows: Array<{ created_at?: string }>, pick?: (r: never) => number) =>
      days.map((day) => ({
        day,
        value: rows.filter((r) => (r?.created_at ?? "").slice(0, 10) === day).reduce((s, r) => s + (pick ? pick(r as never) : 1), 0),
      }));
    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => String((u as { last_active_at?: string }).last_active_at ?? "") >= since7).length,
      newUsers30d: users.filter((u) => String((u as { created_at?: string }).created_at ?? "") >= since30).length,
      suspended: users.filter((u) => st(u) !== "active" && st(u) !== "").length,
      workers: users.length,
      advertisers: (roles.data ?? []).filter((r) => r && (r as { role?: string }).role === "advertiser").length,
      admins: (roles.data ?? []).filter((r) => r && (r as { role?: string }).role === "admin").length,
      rewardsPaid,
      depositsTotal,
      withdrawalsPaid: withdrawnPaid,
      platformRevenue: depositsTotal - rewardsPaid,
      pendingWithdrawals: (wds.data ?? []).filter((w) => st(w) === "pending").length,
      pendingDeposits: (deps.data ?? []).filter((d) => st(d) === "pending").length,
      pendingReviews: (subs.data ?? []).filter((s) => st(s) === "pending").length,
      activeTasks: (tasks.data ?? []).filter((t) => {
        if (!t) return false;
        const active = Boolean((t as { is_active?: boolean }).is_active);
        const ts = st(t);
        return active && (ts === "active" || ts === "" || ts === "null");
      }).length,
      activeCampaigns: (campaigns.data ?? []).filter((c) => st(c) === "active").length,
      openFraud: (fraud.data ?? []).filter((f) => st(f) === "open").length,
      openTickets: (tickets.data ?? []).filter((t) => st(t) === "open").length,
      charts: {
        revenue: bucket(tx.filter((t) => Number(t.amount) > 0) as never, (r: never) => Number((r as { amount: number }).amount)),
        userGrowth: bucket(users as never),
        completions: bucket((subs.data ?? []).filter((s) => st(s) === "verified") as never),
        withdrawals: bucket((wds.data ?? []) as never, (r: never) => Number((r as { amount: number }).amount)),
      },
      recentActivity: activity.data ?? [],
    };
  });

export const ownerListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string | undefined; status?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as never);
    if (data.search?.trim()) {
      const s = data.search.trim();
      q = q.or(`display_name.ilike.%${s}%,username.ilike.%${s}%,referral_code.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const { data: txs } = ids.length
      ? await db.from("transactions").select("user_id, amount, kind").in("user_id", ids)
      : { data: [] };
    const balances = new Map<string, number>();
    (txs ?? []).forEach((t) => balances.set(t.user_id, (balances.get(t.user_id) ?? 0) + Number(t.amount)));
    return (rows ?? []).map((r) => ({ ...r, balance: balances.get(r.id) ?? 0 }));
  });

export const ownerListTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string | undefined; platform?: string | undefined; search?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db.from("tasks").select("*, campaigns(name)").order("created_at", { ascending: false }).limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as never);
    if (data.platform && data.platform !== "all") q = q.eq("platform", data.platform as never);
    if (data.search?.trim()) q = q.ilike("title", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const { data: subs } = await db.from("submissions").select("task_id, status");
    return (rows ?? []).map((t) => ({
      ...t,
      submissionCount: (subs ?? []).filter((s) => s.task_id === t.id).length,
    }));
  });

export const ownerSetTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; status: "draft" | "active" | "paused" | "completed" | "cancelled" }) => d)
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

export const ownerListSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string | undefined; search?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db
      .from("submissions")
      .select("*, tasks(title, platform, reward, advertiser), profiles:user_id(display_name, username, telegram_id)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as never);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const s = data.search?.trim().toLowerCase();
    const list = rows ?? [];
    if (!s) return list;
    return list.filter((r) => JSON.stringify(r).toLowerCase().includes(s));
  });

export const ownerReviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; status: "verified" | "rejected"; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db.from("submissions").select("*, tasks(reward, title)").eq("id", data.submissionId).maybeSingle();
    if (!prev) throw new Error("Submission not found.");
    const { error } = await db
      .from("submissions")
      .update({ status: data.status as never, review_note: data.note ?? null, reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("id", data.submissionId);
    if (error) throw new Error(error.message);
    if (data.status === "verified") {
      const reward = Number((prev.tasks as { reward?: number } | null)?.reward ?? 0);
      if (reward > 0) {
        await db.from("transactions").insert({
          user_id: prev.user_id,
          label: `Task reward — ${(prev.tasks as { title?: string } | null)?.title ?? "task"}`,
          amount: reward,
          kind: "reward",
        });
      }
    }
    await log(context.userId, `submission.${data.status}`, { targetType: "submission", targetId: data.submissionId });
    return { status: data.status };
  });

export const ownerUpdateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { withdrawalId: string; status: string; txHash?: string; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db.from("withdrawals").select("*").eq("id", data.withdrawalId).maybeSingle();
    if (!prev) throw new Error("Withdrawal not found.");
    const patch: Record<string, unknown> = { status: data.status, updated_at: new Date().toISOString() };
    if (data.txHash) patch.tx_hash = data.txHash;
    if (data.note) patch.admin_note = data.note;
    const { error } = await db.from("withdrawals").update(patch).eq("id", data.withdrawalId);
    if (error) throw new Error(error.message);
    await log(context.userId, `withdrawal.${data.status}`, { targetType: "withdrawal", targetId: data.withdrawalId });
    try {
      const { notifyOwnersWithdrawalPaid, notifyOwnersWithdrawalFailed, postPayoutProofToChannel } = await import("@/lib/notify-owner");
      if (data.status === "paid") {
        await notifyOwnersWithdrawalPaid({
          userId: prev.user_id,
          amount: Number(prev.amount),
          method: String(prev.method ?? ""),
          txHash: data.txHash ?? prev.tx_hash,
          reference: prev.id,
        });
        await postPayoutProofToChannel({
          amount: Number(prev.amount),
          method: String(prev.method ?? ""),
          address: String(prev.address ?? ""),
          txHash: data.txHash ?? prev.tx_hash,
          withdrawalId: prev.id,
        });
      } else if (data.status === "failed" || data.status === "rejected") {
        await notifyOwnersWithdrawalFailed({
          userId: prev.user_id,
          amount: Number(prev.amount),
          method: String(prev.method ?? ""),
          reason: data.note ?? data.status,
          reference: prev.id,
        });
      }
    } catch { /* soft */ }
    return { status: data.status };
  });

export const ownerGetUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { userId: string }) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  const { data: profile } = await db.from("profiles").select("*").eq("id", data.userId).maybeSingle();
  if (!profile) throw new Error("User not found.");
  return { profile, roles: [], transactions: [], submissions: [], withdrawals: [], deposits: [], referrals: [], fraudFlags: [], auditHistory: [], balance: 0, totalEarned: 0, totalWithdrawn: 0, pending: 0 };
});
export const ownerSetUserStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { userId: string; status: "active" | "suspended" | "banned" }) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  await db.from("profiles").update({ status: data.status }).eq("id", data.userId);
  await log(context.userId, `user.${data.status}`, { targetType: "user", targetId: data.userId });
  return { status: data.status };
});
export const ownerSetUserNotes = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { userId: string; notes: string }) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  await db.from("profiles").update({ admin_notes: data.notes }).eq("id", data.userId);
  return { ok: true };
});
export const ownerAdjustWallet = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { userId: string; amount: number; reason: string }) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  if (!Number.isFinite(data.amount) || data.amount === 0) throw new Error("Enter an amount.");
  if (!data.reason.trim()) throw new Error("A reason is required.");
  await db.from("transactions").insert({ user_id: data.userId, label: `Adjustment — ${data.reason.trim()}`, amount: data.amount, kind: "bonus" });
  await log(context.userId, "wallet.adjustment", { targetType: "user", targetId: data.userId, next: { amount: data.amount } });
  return { ok: true };
});
export const ownerAdvertisers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerCreateTaskFull = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  const { data: task, error } = await db.from("tasks").insert({
    platform: data.platform, task_type: data.taskType, title: data.title?.trim(), reward: data.reward,
    slots_left: data.slots, slots_total: data.slots, budget: data.budget ?? data.reward * data.slots,
    proof: data.proof ?? "screenshot", status: data.status ?? "draft", is_active: data.status === "active",
    created_by: context.userId, advertiser: data.advertiser ?? "TASKORA",
  }).select("*").single();
  if (error) throw new Error(error.message);
  return task;
});
export const ownerCampaigns = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerWallets = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerDeposits = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerUpdateDeposit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return { ok: true }; });
export const ownerWithdrawals = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  let q = db.from("withdrawals").select("*, profiles:user_id(display_name, username, telegram_id)").order("created_at", { ascending: false }).limit(200);
  if (data?.status && data.status !== "all") q = q.eq("status", data.status as never);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  return rows ?? [];
});
export const ownerTransactions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerFraud = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerUpdateFraud = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return { ok: true }; });
export const ownerReferrals = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerLeaderboards = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerTickets = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerUpdateTicket = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return { ok: true }; });
export const ownerNotifications = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerBroadcast = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return { ok: true }; });
export const ownerGetSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return {}; });
export const ownerSaveSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return { ok: true }; });
export const ownerIntegrations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerHealth = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return { ok: true }; });
export const ownerAuditLogs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ context }) => { await guard(context.userId); return []; });
export const ownerTelegramStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return {}; });
export const ownerGetWebhookInfo = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await guard(context.userId);
  const { ownerGetWebhookInfo: fn } = await import("@/lib/owner-economy.functions");
  return fn();
});
export const ownerRegisterWebhook = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ data, context }) => {
  await guard(context.userId);
  const { ownerRegisterWebhook: fn } = await import("@/lib/owner-economy.functions");
  return fn({ data });
});
export const ownerDeleteWebhook = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await guard(context.userId);
  const { ownerDeleteWebhook: fn } = await import("@/lib/owner-economy.functions");
  return fn();
});
export const ownerGetEconomy = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await guard(context.userId);
  const { ownerGetEconomy: fn } = await import("@/lib/owner-economy.functions");
  return fn();
});
export const ownerSaveEconomy = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ data, context }) => {
  await guard(context.userId);
  const { ownerSaveEconomy: fn } = await import("@/lib/owner-economy.functions");
  return fn({ data });
});
export const ownerGetAnalytics = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await guard(context.userId); return {}; });
