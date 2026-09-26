import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isOwnerTelegramId } from "@/lib/owner";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"] ?? "https://qvwetjpgplkhxuymsnyx.supabase.co";
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  const tg = (profile as { telegram_id?: number | string | null } | null)?.telegram_id;
  if (isOwnerTelegramId(tg ?? null)) {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "admin" } as never,
      { onConflict: "user_id,role" } as never,
    );
    return;
  }
  throw new Error("Owner/admin authorization required.");
}

export const listTasks = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("tasks")
    .select("*")
    .eq("is_active", true)
    .order("reward", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getTask = createServerFn({ method: "GET" })
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ data }) => {
    const { data: task, error } = await publicClient()
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return task;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profileRes, txRes, subsRes, refRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("submissions").select("id, task_id, status, created_at, tasks(reward, title)").eq("user_id", userId),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId),
      supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);

    const transactions = txRes.data ?? [];
    const submissions = (subsRes.data ?? []) as Array<{
      id: string;
      task_id: string;
      status: string;
      created_at: string;
      tasks: { reward: number; title: string } | null;
    }>;

    const balance = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const lifetime = transactions
      .filter((t) => Number(t.amount) > 0)
      .reduce((s, t) => s + Number(t.amount), 0);
    const pending = submissions
      .filter((s) => s.status === "pending")
      .reduce((s, row) => s + Number(row.tasks?.reward ?? 0), 0);

    const tg = (profileRes.data as { telegram_id?: number | string } | null)?.telegram_id;
    const isOwner = Boolean(roleRes.data) || isOwnerTelegramId(tg ?? null);

    if (isOwner && !roleRes.data) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: "admin" } as never,
        { onConflict: "user_id,role" } as never,
      );
    }

    return {
      profile: profileRes.data,
      transactions,
      submissions,
      balance,
      lifetime,
      pending,
      verifiedCount: submissions.filter((s) => s.status === "verified").length,
      referrals: refRes.count ?? 0,
      isOwner,
      telegramId: tg ?? null,
    };
  });

export const submitTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { taskId: string; proofText?: string | undefined; proofUrl?: string | undefined }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .eq("is_active", true)
      .maybeSingle();
    if (!task) throw new Error("This task is no longer available.");
    if (task.slots_left <= 0) throw new Error("All slots for this task are taken.");

    const { data: existing } = await supabaseAdmin
      .from("submissions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("task_id", data.taskId)
      .maybeSingle();
    if (existing) throw new Error("You already submitted this task.");

    const { error } = await supabaseAdmin.from("submissions").insert({
      user_id: userId,
      task_id: task.id,
      status: "pending",
      proof_text: data.proofText ?? null,
      proof_url: data.proofUrl ?? null,
    });
    if (error) throw new Error(error.message);
    try {
      const { notifyTaskSubmitted } = await import("@/lib/notify-user");
      await notifyTaskSubmitted(userId, task);
    } catch {}

    await supabaseAdmin
      .from("tasks")
      .update({ slots_left: Math.max(0, task.slots_left - 1) })
      .eq("id", task.id);

    return { status: "pending" as const };
  });

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; decision: "verified" | "rejected"; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const { data: maintRow } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_switches")
        .maybeSingle();
      const v = (maintRow?.value ?? {}) as Record<string, unknown>;
      if (Boolean(v.verification_paused) || Boolean(v.read_only)) {
        throw new Error("Verification is temporarily paused by the owner.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("paused")) throw e;
    }

    const { data: submission } = await supabaseAdmin
      .from("submissions")
      .select("*, tasks(id, reward, advertiser, title)")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "pending") {
      throw new Error(`Submission already ${submission.status}.`);
    }

    if (data.decision === "rejected") {
      const { error } = await supabaseAdmin
        .from("submissions")
        .update({ status: "rejected" })
        .eq("id", data.submissionId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return { status: "rejected" as const };
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("submissions")
      .update({ status: "verified" })
      .eq("id", data.submissionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updErr) throw new Error(updErr.message);
    if (!updated) throw new Error("Submission was already processed.");

    const task = submission.tasks as { reward: number; advertiser: string; title: string } | null;
    const reward = Number(task?.reward ?? 0);
    if (reward > 0) {
      await supabaseAdmin.from("transactions").insert({
        user_id: submission.user_id,
        label: `Verified — ${task?.advertiser ?? "task"}`,
        amount: reward,
        kind: "reward",
      });

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("referred_by")
        .eq("id", submission.user_id)
        .maybeSingle();
      if (profile?.referred_by) {
        await supabaseAdmin.from("transactions").insert({
          user_id: profile.referred_by,
          label: "Referral share",
          amount: Number((reward * 0.1).toFixed(2)),
          kind: "referral",
        });
      }
    }

    return { status: "verified" as const };
  });

export const listPendingSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select("*, tasks(title, platform, reward, advertiser)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOwnerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, tasks, pending, withdrawals, txs] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("transactions").select("amount, kind"),
    ]);

    const rows = txs.data ?? [];
    const rewardsPaid = rows
      .filter((t) => t.kind === "reward" || t.kind === "referral" || t.kind === "bonus")
      .reduce((s, t) => s + Number(t.amount), 0);

    return {
      totalUsers: users.count ?? 0,
      activeTasks: tasks.count ?? 0,
      pendingReviews: pending.count ?? 0,
      pendingWithdrawals: withdrawals.count ?? 0,
      rewardsPaid,
    };
  });
