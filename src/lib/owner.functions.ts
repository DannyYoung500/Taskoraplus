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

/* ------------------------------------------------------------------ OVERVIEW */

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
        db
          .from("audit_logs")
          .select("id, action, admin_label, target_type, created_at")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

    const users = profiles.data ?? [];
    const tx = txs.data ?? [];
    const rewardsPaid = sum(
      tx.filter((t) => ["reward", "referral", "bonus"].includes(String(t.kind))),
    );
    const withdrawnPaid = sum((wds.data ?? []).filter((w) => w.status === "paid"));
    const depositsTotal = sum((deps.data ?? []).filter((d) => d.status === "completed"));

    // daily series (30d)
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - (29 - i) * 86_400_000);
      return d.toISOString().slice(0, 10);
    });
    const bucket = (rows: Array<{ created_at: string }>, pick?: (r: never) => number) =>
      days.map((day) => ({
        day,
        value: rows
          .filter((r) => r.created_at?.slice(0, 10) === day)
          .reduce((s, r) => s + (pick ? pick(r as never) : 1), 0),
      }));

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => (u.last_active_at ?? "") >= since7).length,
      newUsers30d: users.filter((u) => u.created_at >= since30).length,
      suspended: users.filter((u) => u.status !== "active").length,
      workers: users.length,
      advertisers: (roles.data ?? []).filter((r) => r.role === "advertiser").length,
      admins: (roles.data ?? []).filter((r) => r.role === "admin").length,
      rewardsPaid,
      depositsTotal,
      withdrawalsPaid: withdrawnPaid,
      platformRevenue: depositsTotal - rewardsPaid,
      pendingWithdrawals: (wds.data ?? []).filter((w) => w.status === "pending").length,
      pendingDeposits: (deps.data ?? []).filter((d) => d.status === "pending").length,
      pendingReviews: (subs.data ?? []).filter((s) => s.status === "pending").length,
      activeTasks: (tasks.data ?? []).filter((t) => t.is_active && t.status === "active").length,
      activeCampaigns: (campaigns.data ?? []).filter((c) => c.status === "active").length,
      openFraud: (fraud.data ?? []).filter((f) => f.status === "open").length,
      openTickets: (tickets.data ?? []).filter((t) => t.status === "open").length,
      charts: {
        revenue: bucket(
          tx.filter((t) => Number(t.amount) > 0) as never,
          (r: never) => Number((r as { amount: number }).amount),
        ),
        userGrowth: bucket(users as never),
        completions: bucket((subs.data ?? []).filter((s) => s.status === "verified") as never),
        withdrawals: bucket(
          (wds.data ?? []) as never,
          (r: never) => Number((r as { amount: number }).amount),
        ),
      },
      recentActivity: activity.data ?? [],
    };
  });

/* --------------------------------------------------------------------- USERS */

export const ownerListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string | undefined; status?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
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
    (txs ?? []).forEach((t) =>
      balances.set(t.user_id, (balances.get(t.user_id) ?? 0) + Number(t.amount)),
    );
    return (rows ?? []).map((r) => ({ ...r, balance: balances.get(r.id) ?? 0 }));
  });

export const ownerGetUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const [profile, txs, subs, wds, deps, refs, roles, flags, logs] = await Promise.all([
      db.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      db
        .from("transactions")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("submissions")
        .select("*, tasks(title, platform, reward)")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("withdrawals").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      db.from("deposits").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      db.from("profiles").select("id, display_name, created_at").eq("referred_by", data.userId),
      db.from("user_roles").select("role").eq("user_id", data.userId),
      db.from("fraud_flags").select("*").eq("user_id", data.userId),
      db
        .from("audit_logs")
        .select("*")
        .eq("target_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (!profile.data) throw new Error("User not found.");
    const transactions = txs.data ?? [];
    const submissions = subs.data ?? [];
    return {
      profile: profile.data,
      roles: (roles.data ?? []).map((r) => r.role),
      transactions,
      submissions,
      withdrawals: wds.data ?? [],
      deposits: deps.data ?? [],
      referrals: refs.data ?? [],
      fraudFlags: flags.data ?? [],
      auditHistory: logs.data ?? [],
      balance: sum(transactions),
      totalEarned: sum(transactions.filter((t) => Number(t.amount) > 0)),
      totalWithdrawn: sum((wds.data ?? []).filter((w) => w.status === "paid")),
      pending: submissions
        .filter((s) => s.status === "pending")
        .reduce((s, r) => s + Number((r.tasks as { reward?: number } | null)?.reward ?? 0), 0),
    };
  });

export const ownerSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "active" | "suspended" | "banned" }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db
      .from("profiles")
      .select("status")
      .eq("id", data.userId)
      .maybeSingle();
    const { error } = await db
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await log(context.userId, `user.${data.status}`, {
      targetType: "user",
      targetId: data.userId,
      previous: prev?.status,
      next: data.status,
    });
    return { status: data.status };
  });

export const ownerSetUserNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; notes: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { error } = await db
      .from("profiles")
      .update({ admin_notes: data.notes })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await log(context.userId, "user.notes", { targetType: "user", targetId: data.userId });
    return { ok: true };
  });

export const ownerAdjustWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; amount: number; reason: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    if (!Number.isFinite(data.amount) || data.amount === 0) throw new Error("Enter an amount.");
    if (!data.reason.trim()) throw new Error("A reason is required for adjustments.");
    const { error } = await db.from("transactions").insert({
      user_id: data.userId,
      label: `Adjustment — ${data.reason.trim()}`,
      amount: data.amount,
      kind: "bonus",
    });
    if (error) throw new Error(error.message);
    await log(context.userId, "wallet.adjustment", {
      targetType: "user",
      targetId: data.userId,
      next: { amount: data.amount, reason: data.reason },
    });
    return { ok: true };
  });

/* --------------------------------------------------------------- ADVERTISERS */

export const ownerAdvertisers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "advertiser");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const [profiles, campaigns] = await Promise.all([
      db.from("profiles").select("*").in("id", ids),
      db.from("campaigns").select("*").in("advertiser_id", ids),
    ]);
    return (profiles.data ?? []).map((p) => {
      const mine = (campaigns.data ?? []).filter((c) => c.advertiser_id === p.id);
      return {
        ...p,
        campaigns: mine.length,
        active: mine.filter((c) => c.status === "active").length,
        completed: mine.filter((c) => c.status === "completed").length,
        pending: mine.filter((c) => String(c.status).startsWith("pending")).length,
        spend: mine.reduce((s, c) => s + Number(c.spent), 0),
        budget: mine.reduce((s, c) => s + Number(c.budget), 0),
      };
    });
  });

/* --------------------------------------------------------------------- TASKS */

export const ownerListTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { status?: string | undefined; platform?: string | undefined; search?: string | undefined }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db
      .from("tasks")
      .select("*, campaigns(name)")
      .order("created_at", { ascending: false })
      .limit(300);
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

export const ownerCreateTaskFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      platform: string;
      taskType: string;
      target?: string | undefined;
      targetUrl?: string | undefined;
      title: string;
      description?: string | undefined;
      instructions?: string | undefined;
      advertiser?: string | undefined;
      reward: number;
      slots: number;
      budget?: number | undefined;
      eligibility?: string | undefined;
      proof: "auto" | "screenshot" | "username";
      completionLimit?: number | undefined;
      startsAt?: string | undefined;
      endsAt?: string | undefined;
      requiresReview: boolean;
      status: "draft" | "active" | "paused";
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const platforms = [
      "telegram",
      "youtube",
      "whatsapp",
      "x",
      "instagram",
      "tiktok",
      "discord",
      "facebook",
    ];
    if (!platforms.includes(data.platform)) throw new Error("Choose a valid platform.");
    if (!data.title.trim()) throw new Error("Title is required.");
    if (!(Number(data.reward) > 0)) throw new Error("Reward must be greater than 0.");
    if (!(Number.isInteger(data.slots) && data.slots > 0)) throw new Error("Slots must be a positive whole number.");
    const budget = Number(data.budget ?? data.reward * data.slots);
    if (budget < data.reward * data.slots) throw new Error("Budget is lower than reward × slots.");
    if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
      throw new Error("End date must be after the start date.");
    }

    const { data: task, error } = await db
      .from("tasks")
      .insert({
        platform: data.platform as never,
        task_type: data.taskType,
        target: data.target ?? null,
        link: data.targetUrl ?? null,
        title: data.title.trim(),
        description: data.description ?? null,
        instructions: data.instructions ?? null,
        advertiser: (data.advertiser ?? "TASKORA").trim() || "TASKORA",
        reward: data.reward,
        slots_left: data.slots,
        slots_total: data.slots,
        budget,
        eligibility: data.eligibility ?? null,
        proof: data.proof,
        completion_limit: data.completionLimit ?? 1,
        requires_review: data.requiresReview,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        status: data.status as never,
        is_active: data.status === "active",
        steps: [data.instructions?.trim() || "Complete the required action", "Return and submit proof"],
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await log(context.userId, "task.create", { targetType: "task", targetId: task.id, next: task });
    return task;
  });

export const ownerSetTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { taskId: string; status: "draft" | "active" | "paused" | "completed" | "cancelled" }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db.from("tasks").select("status").eq("id", data.taskId).maybeSingle();
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
    return { status: data.status };
  });

/* ---------------------------------------------------------------- SUBMISSIONS */

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
  .inputValidator(
    (d: { submissionId: string; decision: "verified" | "rejected"; reason?: string | undefined }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: submission } = await db
      .from("submissions")
      .select("*, tasks(id, reward, advertiser, title)")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "pending") throw new Error(`Already ${submission.status}.`);

    const { data: updated, error } = await db
      .from("submissions")
      .update({
        status: data.decision,
        rejection_reason: data.decision === "rejected" ? (data.reason ?? null) : null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.submissionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Submission was already processed.");

    if (data.decision === "verified") {
      const task = submission.tasks as { reward: number; advertiser: string } | null;
      const reward = Number(task?.reward ?? 0);
      if (reward > 0) {
        await db.from("transactions").insert({
          user_id: submission.user_id,
          label: `Verified — ${task?.advertiser ?? "task"}`,
          amount: reward,
          kind: "reward",
        });
        const { data: profile } = await db
          .from("profiles")
          .select("referred_by")
          .eq("id", submission.user_id)
          .maybeSingle();
        if (profile?.referred_by) {
          await db.from("transactions").insert({
            user_id: profile.referred_by,
            label: "Referral share",
            amount: Number((reward * 0.10).toFixed(2)),
            kind: "referral",
          });
        }
      }
    }

    await log(context.userId, `submission.${data.decision}`, {
      targetType: "submission",
      targetId: data.submissionId,
      next: { decision: data.decision, reason: data.reason ?? null },
    });
    return { status: data.decision };
  });

/* ----------------------------------------------------------------- CAMPAIGNS */

export const ownerCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data, error } = await db
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ------------------------------------------------------------------- WALLETS */

export const ownerWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const [txs, wds, deps, subs, roles, profiles] = await Promise.all([
      db.from("transactions").select("*").order("created_at", { ascending: false }).limit(300),
      db.from("withdrawals").select("user_id, amount, status"),
      db.from("deposits").select("user_id, amount, status"),
      db.from("submissions").select("user_id, status, tasks(reward)"),
      db.from("user_roles").select("user_id, role"),
      db.from("profiles").select("id, display_name, username"),
    ]);
    const all = txs.data ?? [];
    const { data: allTx } = await db.from("transactions").select("user_id, amount");
    const balances = new Map<string, number>();
    (allTx ?? []).forEach((t) =>
      balances.set(t.user_id, (balances.get(t.user_id) ?? 0) + Number(t.amount)),
    );
    const advertiserIds = new Set(
      (roles.data ?? []).filter((r) => r.role === "advertiser").map((r) => r.user_id),
    );
    const pendingByUser = new Map<string, number>();
    (subs.data ?? [])
      .filter((s) => s.status === "pending")
      .forEach((s) =>
        pendingByUser.set(
          s.user_id,
          (pendingByUser.get(s.user_id) ?? 0) +
            Number((s.tasks as { reward?: number } | null)?.reward ?? 0),
        ),
      );
    const lockedByUser = new Map<string, number>();
    (wds.data ?? [])
      .filter((w) => w.status === "pending" || w.status === "processing")
      .forEach((w) =>
        lockedByUser.set(w.user_id, (lockedByUser.get(w.user_id) ?? 0) + Number(w.amount)),
      );

    const rows = (profiles.data ?? []).map((p) => ({
      id: p.id,
      name: p.username ?? p.display_name,
      available: balances.get(p.id) ?? 0,
      pending: pendingByUser.get(p.id) ?? 0,
      locked: lockedByUser.get(p.id) ?? 0,
      isAdvertiser: advertiserIds.has(p.id),
    }));

    const depositsCompleted = sum((deps.data ?? []).filter((d) => d.status === "completed"));
    const paidOut = sum((wds.data ?? []).filter((w) => w.status === "paid"));
    return {
      userWallets: rows.filter((r) => !r.isAdvertiser),
      advertiserWallets: rows.filter((r) => r.isAdvertiser),
      platform: {
        deposits: depositsCompleted,
        rewardsPaid: sum(all.filter((t) => Number(t.amount) > 0)),
        withdrawalsPaid: paidOut,
        net: depositsCompleted - paidOut,
      },
      ledger: all,
    };
  });

/* ------------------------------------------------------------------ DEPOSITS */

export const ownerDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data, error } = await db
      .from("deposits")
      .select("*, profiles:user_id(display_name, username)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const ownerUpdateDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      depositId: string;
      status: "pending" | "processing" | "completed" | "failed" | "cancelled";
      notes?: string | undefined;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db
      .from("deposits")
      .select("*")
      .eq("id", data.depositId)
      .maybeSingle();
    if (!prev) throw new Error("Deposit not found.");
    if (prev.status === "completed") throw new Error("Deposit is already completed.");

    const { error } = await db
      .from("deposits")
      .update({
        status: data.status,
        notes: data.notes ?? prev.notes,
        verified_at: data.status === "completed" ? new Date().toISOString() : null,
        verified_by: data.status === "completed" ? context.userId : null,
      })
      .eq("id", data.depositId);
    if (error) throw new Error(error.message);

    if (data.status === "completed") {
      await db.from("transactions").insert({
        user_id: prev.user_id,
        label: `Deposit verified — ${prev.method}`,
        amount: Math.abs(Number(prev.amount)),
        kind: "bonus",
      });
    }
    await log(context.userId, `deposit.${data.status}`, {
      targetType: "deposit",
      targetId: data.depositId,
      previous: prev.status,
      next: data.status,
    });
    return { status: data.status };
  });

/* --------------------------------------------------------------- WITHDRAWALS */

export const ownerWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db
      .from("withdrawals")
      .select("*, profiles:user_id(display_name, username, telegram_id)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as never);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const ownerUpdateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      withdrawalId: string;
      status: "processing" | "paid" | "rejected" | "failed" | "manual_review";
      reference?: string | undefined;
      reason?: string | undefined;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: row } = await db
      .from("withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (!row) throw new Error("Withdrawal not found.");
    if (row.status === "paid") throw new Error("Withdrawal is already paid.");
    if (data.status === "rejected" && !data.reason?.trim()) {
      throw new Error("A rejection reason is required.");
    }

    const { error } = await db
      .from("withdrawals")
      .update({
        status: data.status as never,
        reference: data.reference ?? row.reference,
        rejection_reason: data.status === "rejected" ? (data.reason ?? null) : row.rejection_reason,
        failure_reason: data.status === "failed" ? (data.reason ?? null) : row.failure_reason,
        processed_at: new Date().toISOString(),
        processed_by: context.userId,
      })
      .eq("id", data.withdrawalId)
      .neq("status", "paid");
    if (error) throw new Error(error.message);

    // refund once on rejection/failure (the request already debited the ledger)
    if (data.status === "rejected" || data.status === "failed") {
      const label = `Withdrawal ${data.status} — refund ${data.withdrawalId.slice(0, 8)}`;
      const { data: existing } = await db
        .from("transactions")
        .select("id")
        .eq("user_id", row.user_id)
        .eq("label", label)
        .maybeSingle();
      if (!existing) {
        await db.from("transactions").insert({
          user_id: row.user_id,
          label,
          amount: Math.abs(Number(row.amount)),
          kind: "bonus",
        });
      }
    }

    await log(context.userId, `withdrawal.${data.status}`, {
      targetType: "withdrawal",
      targetId: data.withdrawalId,
      previous: row.status,
      next: { status: data.status, reference: data.reference ?? null, reason: data.reason ?? null },
    });
    return { status: data.status };
  });

/* -------------------------------------------------------------- TRANSACTIONS */

export const ownerTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind?: string | undefined; search?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db
      .from("transactions")
      .select("*, profiles:user_id(display_name, username)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind as never);
    if (data.search?.trim()) q = q.ilike("label", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* --------------------------------------------------------------- FRAUD & RISK */

export const ownerFraud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const [flags, subs, wds, profiles] = await Promise.all([
      db.from("fraud_flags").select("*, profiles:user_id(display_name, username)").order("created_at", { ascending: false }),
      db.from("submissions").select("user_id, task_id, status, created_at, proof_text"),
      db.from("withdrawals").select("*").order("created_at", { ascending: false }),
      db.from("profiles").select("id, display_name, username, created_at, status, telegram_id"),
    ]);

    const submissions = subs.data ?? [];
    const dupKey = new Map<string, number>();
    submissions.forEach((s) => {
      const k = `${s.user_id}:${s.task_id}`;
      dupKey.set(k, (dupKey.get(k) ?? 0) + 1);
    });
    const duplicates = [...dupKey.entries()].filter(([, n]) => n > 1);

    const dayCount = new Map<string, number>();
    submissions.forEach((s) => {
      const k = `${s.user_id}:${s.created_at.slice(0, 10)}`;
      dayCount.set(k, (dayCount.get(k) ?? 0) + 1);
    });
    const abnormal = [...dayCount.entries()].filter(([, n]) => n >= 25);

    const suspiciousWithdrawals = (wds.data ?? []).filter(
      (w) => w.risk_status !== "normal" || Number(w.amount) >= 500,
    );

    return {
      flags: flags.data ?? [],
      duplicates: duplicates.map(([k, n]) => ({ key: k, count: n })),
      abnormal: abnormal.map(([k, n]) => ({ key: k, count: n })),
      suspiciousWithdrawals,
      suspendedUsers: (profiles.data ?? []).filter((p) => p.status !== "active"),
    };
  });

export const ownerUpdateFraud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      flagId: string;
      status: "open" | "investigating" | "cleared" | "actioned";
      note?: string | undefined;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { error } = await db
      .from("fraud_flags")
      .update({ status: data.status, investigation_note: data.note ?? null })
      .eq("id", data.flagId);
    if (error) throw new Error(error.message);
    await log(context.userId, `fraud.${data.status}`, {
      targetType: "fraud_flag",
      targetId: data.flagId,
      next: data,
    });
    return { ok: true };
  });

/* ---------------------------------------------- REFERRALS / TASK POINTS / RANKS */

export const ownerReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const [profiles, txs] = await Promise.all([
      db.from("profiles").select("id, display_name, username, referral_code, referred_by, created_at"),
      db.from("transactions").select("user_id, amount, created_at, label").eq("kind", "referral"),
    ]);
    const all = profiles.data ?? [];
    const counts = new Map<string, number>();
    all.forEach((p) => {
      if (p.referred_by) counts.set(p.referred_by, (counts.get(p.referred_by) ?? 0) + 1);
    });
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([id, count]) => {
        const p = all.find((x) => x.id === id);
        return { id, name: p?.username ?? p?.display_name ?? id, count };
      });
    return {
      totalReferred: all.filter((p) => p.referred_by).length,
      rewardTotal: sum(txs.data ?? []),
      transactions: txs.data ?? [],
      top,
    };
  });

export const ownerLeaderboards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const [profiles, txs, subs] = await Promise.all([
      db.from("profiles").select("id, display_name, username, task_points, level"),
      db.from("transactions").select("user_id, amount, created_at").gt("amount", 0),
      db.from("submissions").select("user_id, created_at").eq("status", "verified"),
    ]);
    const people = profiles.data ?? [];
    const name = (id: string) => {
      const p = people.find((x) => x.id === id);
      return p?.username ?? p?.display_name ?? id.slice(0, 8);
    };
    const build = (sinceMs: number | null) => {
      const cutoff = sinceMs ? new Date(Date.now() - sinceMs).toISOString() : "";
      const earn = new Map<string, number>();
      (txs.data ?? [])
        .filter((t) => t.created_at >= cutoff)
        .forEach((t) => earn.set(t.user_id, (earn.get(t.user_id) ?? 0) + Number(t.amount)));
      const done = new Map<string, number>();
      (subs.data ?? [])
        .filter((s) => s.created_at >= cutoff)
        .forEach((s) => done.set(s.user_id, (done.get(s.user_id) ?? 0) + 1));
      return [...new Set([...earn.keys(), ...done.keys()])]
        .map((id) => ({
          id,
          name: name(id),
          earnings: earn.get(id) ?? 0,
          completions: done.get(id) ?? 0,
          task_points: Number((people.find((p) => p.id === id) as { task_points?: number } | undefined)?.task_points ?? 0),
        }))
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 25);
    };
    return {
      daily: build(86_400_000),
      weekly: build(7 * 86_400_000),
      monthly: build(30 * 86_400_000),
      allTime: build(null),
    };
  });

/* ------------------------------------------------------- TICKETS / NOTIFIERS */

export const ownerTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data, error } = await db
      .from("support_tickets")
      .select("*, profiles:user_id(display_name, username)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const ownerUpdateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      ticketId: string;
      status: "open" | "pending" | "resolved" | "closed";
      resolution?: string | undefined;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { error } = await db
      .from("support_tickets")
      .update({
        status: data.status,
        resolution_notes: data.resolution ?? null,
        assigned_to: context.userId,
      })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    await log(context.userId, `ticket.${data.status}`, {
      targetType: "ticket",
      targetId: data.ticketId,
      next: data,
    });
    return { ok: true };
  });

export const ownerNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data, error } = await db
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const ownerBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body: string; category: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    if (!data.title.trim()) throw new Error("Title is required.");
    const { error } = await db.from("notifications").insert({
      title: data.title.trim(),
      body: data.body,
      category: data.category,
      is_broadcast: true,
    });
    if (error) throw new Error(error.message);
    await log(context.userId, "notification.broadcast", { next: data });
    return { ok: true };
  });

/* ------------------------------------------------------------------ SETTINGS */

export const ownerGetSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { keys: string[] }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: rows, error } = await db.from("app_settings").select("*").in("key", data.keys);
    if (error) throw new Error(error.message);
    const out: Record<string, Record<string, unknown>> = {};
    data.keys.forEach((k) => {
      out[k] = ((rows ?? []).find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
    });
    return out;
  });

export const ownerSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; value: Record<string, unknown>; isPublic?: boolean | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await db
      .from("app_settings")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    const { error } = await db.from("app_settings").upsert(
      {
        key: data.key,
        value: data.value as never,
        is_public: data.isPublic ?? true,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await log(context.userId, "settings.update", {
      targetType: "settings",
      targetId: data.key,
      previous: prev?.value,
      next: data.value,
    });
    return { ok: true };
  });

/* ------------------------------------------- INTEGRATIONS / HEALTH / AUDIT */

export const ownerIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const has = (name: string) => Boolean(process.env[name]);
    return [
      {
        name: "Telegram Bot",
        connected: has("TELEGRAM_BOT_TOKEN"),
        detail: has("TELEGRAM_BOT_TOKEN") ? "Bot token configured" : "Not configured",
      },
      {
        name: "Owner allow-list",
        connected: has("TASKORA_OWNER_TELEGRAM_IDS"),
        detail: has("TASKORA_OWNER_TELEGRAM_IDS") ? "Owner IDs configured" : "Not configured",
      },
      { name: "Payment provider", connected: false, detail: "Not configured" },
      { name: "Rewarded-video provider", connected: false, detail: "Not configured" },
      { name: "Webhooks", connected: false, detail: "Not configured" },
      { name: "Database", connected: true, detail: "Connected" },
    ];
  });

export const ownerHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const started = Date.now();
    const { error } = await db.from("profiles").select("id", { head: true, count: "exact" });
    const dbMs = Date.now() - started;
    return {
      checkedAt: new Date().toISOString(),
      services: [
        { name: "Database", ok: !error, detail: error ? error.message : `${dbMs}ms` },
        { name: "Authentication", ok: true, detail: "Session validated server-side" },
        { name: "Server functions", ok: true, detail: "Responding" },
        {
          name: "Telegram",
          ok: Boolean(process.env["TELEGRAM_BOT_TOKEN"]),
          detail: process.env["TELEGRAM_BOT_TOKEN"] ? "Bot token present" : "Not configured",
        },
        { name: "Payment services", ok: false, detail: "Not configured" },
        { name: "Rewarded-video provider", ok: false, detail: "Not configured" },
        { name: "Webhooks", ok: false, detail: "Not configured" },
      ],
    };
  });

export const ownerAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    let q = db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.search?.trim()) q = q.ilike("action", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const ownerTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) {
      return { configured: false as const, username: null, webhook: null, error: null };
    }
    try {
      const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
      const hook = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) =>
        r.json(),
      );
      return {
        configured: true as const,
        username: me?.result?.username ?? null,
        webhook: hook?.result?.url || null,
        error: me?.ok ? null : (me?.description ?? "Telegram API error"),
      };
    } catch (e) {
      return {
        configured: true as const,
        username: null,
        webhook: null,
        error: e instanceof Error ? e.message : "Telegram unreachable",
      };
    }
  });
