import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isOwnerTelegramId } from "@/lib/owner";
import { isTaskEligibleForUser } from "@/lib/task-country";

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

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data, error }] = await Promise.all([
      supabaseAdmin.from("profiles").select("country_code,status").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("tasks").select("*").eq("is_active", true).order("reward", { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const targets=[...new Set(rows.map((task:any)=>String(task.target_country_code??"").trim().toUpperCase()).filter(Boolean))];
    const availableTargets=new Set<string>();
    if (targets.length) {
      const {data:users}=await supabaseAdmin.from("profiles").select("country_code").in("country_code",targets).eq("status","active");
      for(const user of users??[]) availableTargets.add(String(user.country_code??"").toUpperCase());
    }
    const userCountry=String(profile?.country_code??"").trim().toUpperCase();
    return rows.filter((task:any)=>{
      if (task.created_by && String(task.created_by) === String(context.userId)) return false;
      const target=String(task.target_country_code??"").trim().toUpperCase();
      if(!target || target===userCountry) return true;
      if(task.allow_other_countries_if_unavailable===false) return false;
      return !availableTargets.has(target);
    });
  });

export const getTask = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error } = await supabaseAdmin.from("tasks").select("*").eq("id", data.taskId).eq("is_active", true).maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) return null;
    if (task.created_by && String(task.created_by) === String(context.userId)) return null;
    if (!(await isTaskEligibleForUser({supabaseAdmin,task,userId:context.userId}))) return null;
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
    if (task.created_by && String(task.created_by) === String(userId)) {
      throw new Error("You cannot complete your own posted task.");
    }
    if (!(await isTaskEligibleForUser({ supabaseAdmin, task, userId }))) throw new Error("This task is currently reserved for another country.");
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

    const { data: maintRow } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "maintenance_switches").maybeSingle();
    const v = (maintRow?.value ?? {}) as Record<string, unknown>;
    if (Boolean(v.verification_paused) || Boolean(v.read_only)) {
      throw new Error("Verification is temporarily paused by the owner.");
    }

    const { data: result, error } = await supabaseAdmin.rpc("review_task_submission", {
      p_submission_id: data.submissionId,
      p_decision: data.decision,
      p_reason: data.reason ?? null,
    } as never);
    if (error) throw new Error(error.message);

    const reviewResult = (result as { status?: string; reward?: number; customer_cost?: number; customer_cost_released?: number } | null) ?? {};
    const status = String(reviewResult.status ?? data.decision);
    try {
      const { data: submission } = await supabaseAdmin
        .from("submissions")
        .select("user_id, tasks(reward, advertiser, title)")
        .eq("id", data.submissionId).maybeSingle();
      if (submission) {
        if (status === "rejected") {
          const { notifyTaskRejected } = await import("@/lib/notify-user");
          await notifyTaskRejected(submission.user_id, submission.tasks, data.reason ?? "Requirements were not met.");
        } else {
          const { notifyTaskCompleted } = await import("@/lib/notify-user");
          await notifyTaskCompleted(submission.user_id, submission.tasks, Number(reviewResult.reward ?? 0));
        }
      }
    } catch {}
    return { status: status === "rejected" ? ("rejected" as const) : ("verified" as const), reward: Number(reviewResult.reward ?? 0) };
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


export const listMyPostedTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tasks, error } = await (supabaseAdmin as any)
      .from("tasks")
      .select("id,platform,title,advertiser,reward,seconds,slots_left,slots_total,steps,proof,link,is_active,created_at,updated_at,campaign_id,task_type,description,instructions,target,status,budget,completion_limit,requires_review,starts_at,ends_at,featured,target_country_name,target_country_code,campaign_status,target_url,youtube_video_id,youtube_view_count,youtube_view_count_updated_at,watch_completion_count,watch_reward_paid")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    const rows = (tasks ?? []) as any[];
    if (!rows.length) return [];

    const ids = rows.map((task) => String(task.id));
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("id,task_id,status")
      .in("task_id", ids);
    if (submissionsError) throw new Error(submissionsError.message);

    const byTask = new Map<string, { total: number; pending: number; verified: number; rejected: number }>();
    for (const row of submissions ?? []) {
      const key = String(row.task_id);
      const current = byTask.get(key) ?? { total: 0, pending: 0, verified: 0, rejected: 0 };
      current.total += 1;
      if (row.status === "pending") current.pending += 1;
      if (row.status === "verified") current.verified += 1;
      if (row.status === "rejected") current.rejected += 1;
      byTask.set(key, current);
    }

    function youtubeId(raw: string): string {
      try {
        const u = new URL(raw);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        if (host === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] ?? "";
        if (host === "youtube.com" || host === "m.youtube.com") {
          if (u.pathname === "/watch") return u.searchParams.get("v") ?? "";
          const parts = u.pathname.split("/").filter(Boolean);
          const i = parts.findIndex((p) => ["embed", "shorts", "live"].includes(p));
          return i >= 0 ? parts[i + 1] ?? "" : "";
        }
      } catch {}
      return "";
    }

    async function fetchYoutubeViews(id: string): Promise<number | null> {
      if (!id) return null;
      try {
        const key = process.env["YOUTUBE_API_KEY"]?.trim();
        if (key) {
          const response = await fetch(
            "https://www.googleapis.com/youtube/v3/videos?part=statistics&id=" +
              encodeURIComponent(id) + "&key=" + encodeURIComponent(key),
            { headers: { accept: "application/json" } },
          );
          if (response.ok) {
            const json = (await response.json()) as { items?: Array<{ statistics?: { viewCount?: string } }> };
            const count = Number(json.items?.[0]?.statistics?.viewCount ?? "");
            if (Number.isFinite(count) && count >= 0) return Math.floor(count);
          }
        }

        const response = await fetch(
          "https://www.youtube.com/watch?v=" + encodeURIComponent(id),
          { headers: { accept: "text/html", "user-agent": "Mozilla/5.0 TASKORA/1.0" } },
        );
        if (!response.ok) return null;
        const html = await response.text();
        const match = html.match(/"viewCount":"(\d+)"/) || html.match(/"viewCount":(\d+)/);
        const count = Number(match?.[1] ?? "");
        return Number.isFinite(count) ? Math.floor(count) : null;
      } catch {
        return null;
      }
    }

    const enriched = await Promise.all(rows.map(async (task) => {
      const stats = byTask.get(String(task.id)) ?? { total: 0, pending: 0, verified: 0, rejected: 0 };
      const isWatch = String(task.task_type ?? "") === "video_watch";
      let youtubeVideoId = String(task.youtube_video_id ?? "");
      let youtubeViews = task.youtube_view_count == null ? 0 : Number(task.youtube_view_count ?? 0);
      const currentUpdated = task.youtube_view_count_updated_at
        ? new Date(String(task.youtube_view_count_updated_at)).getTime()
        : 0;

      if (isWatch && !youtubeVideoId) youtubeVideoId = youtubeId(String(task.target_url ?? task.link ?? ""));
      if (isWatch && youtubeVideoId && Date.now() - currentUpdated > 10 * 60_000) {
        const fresh = await fetchYoutubeViews(youtubeVideoId);
        if (fresh != null) {
          youtubeViews = fresh;
          await (supabaseAdmin as any).from("tasks").update({
            youtube_video_id: youtubeVideoId,
            youtube_view_count: fresh,
            youtube_view_count_updated_at: new Date().toISOString(),
          }).eq("id", task.id).eq("created_by", context.userId);
        }
      }

      const verified = Number(task.watch_completion_count ?? stats.verified ?? 0);
      return {
        ...task,
        submissions: stats,
        postedVideo: isWatch,
        youtubeVideoId: youtubeVideoId || null,
        youtubeViewsCount: youtubeViews,
        watchCompletionCount: verified,
        watchRewardPaid: Number(task.watch_reward_paid ?? (verified * Number(task.reward ?? 0))),
        remainingSlots: Number(task.slots_left ?? 0),
        targetUrl: String(task.target_url ?? task.link ?? ""),
      };
    }));

    return enriched;
  });\n