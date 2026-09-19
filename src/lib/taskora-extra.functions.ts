import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isOwnerTelegramId } from "@/lib/owner";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

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
          amount: Number((reward * 0.10).toFixed(2)),
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

export const dailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("streak, last_checkin")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile not found.");

    const today = new Date().toISOString().slice(0, 10);
    if (profile.last_checkin === today) return { already: true, streak: profile.streak };

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const streak = profile.last_checkin === yesterday ? profile.streak + 1 : 1;

    await supabaseAdmin.from("profiles").update({ streak, last_checkin: today }).eq("id", userId);
    const { data: settingsRow } = await supabaseAdmin.from("app_settings").select("value").eq("key", "economy").maybeSingle();
    const dailyPoints = Math.max(0, Math.floor(Number((settingsRow?.value as { daily_checkin_points?: number } | null)?.daily_checkin_points ?? 25)));
    const { data: taskPointTotal, error: pointsError } = await (supabaseAdmin as any).rpc("award_task_points", {
      _user_id: userId, _amount: dailyPoints, _kind: "daily_checkin",
      _label: `Daily check-in — day ${streak}`, _reference: `checkin:${userId}:${today}`,
    });
    if (pointsError) throw new Error(pointsError.message);
    return { already: false, streak, taskPoints: dailyPoints, taskPointTotal: Number(taskPointTotal ?? 0) };
  });

export const listPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select("*, profiles:user_id(display_name, username, telegram_id, photo_url)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      ...row,
      photo_url: row.profiles?.photo_url ?? null,
      display_name: row.profiles?.display_name ?? null,
      username: row.profiles?.username ?? null,
    }));
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { withdrawalId: string; decision: "paid" | "rejected"; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (!row) throw new Error("Withdrawal not found.");
    if (row.status === "paid") throw new Error("Withdrawal is already paid.");
    if (row.status !== "pending" && row.status !== "processing") {
      throw new Error(`Cannot review withdrawal in status: ${row.status}`);
    }

    const nextStatus = data.decision === "paid" ? "paid" : "rejected";
    const { error } = await supabaseAdmin
      .from("withdrawals")
      .update({
        status: nextStatus as never,
        rejection_reason: data.decision === "rejected" ? (data.reason ?? "Rejected by owner") : null,
        processed_at: new Date().toISOString(),
        processed_by: context.userId,
      })
      .eq("id", data.withdrawalId)
      .neq("status", "paid");
    if (error) throw new Error(error.message);

    if (data.decision === "rejected") {
      const label = `Withdrawal rejected — refund ${data.withdrawalId.slice(0, 8)}`;
      const { data: existing } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("user_id", row.user_id)
        .eq("label", label)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("transactions").insert({
          user_id: row.user_id,
          label,
          amount: Math.abs(Number(row.amount)),
          kind: "bonus",
        });
      }
    }

    return { status: nextStatus };
  });
