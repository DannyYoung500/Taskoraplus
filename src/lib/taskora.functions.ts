import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { validateTelegramInitData } from "@/lib/telegram-initdata";
import {
  telegramDerivedPassword,
  telegramSyntheticEmail,
} from "@/lib/telegram-auth-bridge";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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

/**
 * Validate Telegram initData, ensure Auth user + profile, return session tokens.
 * Client must call supabase.auth.setSession with the returned tokens.
 */
export const loginWithTelegram = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data }) => {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    const validated = await validateTelegramInitData(data.initData, botToken);
    const telegramId = validated.user.id;
    const email = telegramSyntheticEmail(telegramId);
    const password = await telegramDerivedPassword(telegramId);
    const displayName =
      [validated.user.first_name, validated.user.last_name].filter(Boolean).join(" ") ||
      validated.user.username ||
      `User ${telegramId}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing by synthetic email
    const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let userId = listed?.users?.find((u) => u.email === email)?.id;

    if (!userId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramId,
          username: validated.user.username ?? null,
          display_name: displayName,
          photo_url: validated.user.photo_url ?? null,
          auth_provider: "telegram",
        },
      });
      if (createErr || !created.user) {
        // Race: user may already exist
        const { data: again } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        userId = again?.users?.find((u) => u.email === email)?.id;
        if (!userId) throw new Error(createErr?.message ?? "Could not create Telegram user.");
      } else {
        userId = created.user.id;
      }
    } else {
      // Keep password in sync for deterministic sign-in
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          telegram_id: telegramId,
          username: validated.user.username ?? null,
          display_name: displayName,
          photo_url: validated.user.photo_url ?? null,
          auth_provider: "telegram",
        },
      });
    }

    // Profile row (trigger may already create it)
    const referralCode = `TASKORA-${String(telegramId).slice(-6).toUpperCase()}`;
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        display_name: displayName,
        username: validated.user.username ?? null,
        referral_code: referralCode,
        // telegram_id column exists after master schema migration
        ...({
          telegram_id: telegramId,
          photo_url: validated.user.photo_url ?? null,
        } as Record<string, unknown>),
      } as never,
      { onConflict: "id" },
    );

    // Issue session via password grant (server-side)
    const url = process.env["SUPABASE_URL"]!;
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const authClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sessionData, error: signErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !sessionData.session) {
      throw new Error(signErr?.message ?? "Could not issue Telegram session.");
    }

    return {
      sessionReady: true as const,
      telegramId,
      userId,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at ?? null,
      username: validated.user.username ?? null,
      firstName: validated.user.first_name ?? null,
      startParam: validated.startParam ?? null,
    };
  });

/** @deprecated use loginWithTelegram */
export const validateTelegramSession = loginWithTelegram;

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

    const [profileRes, txRes, subsRes, refRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("submissions").select("id, task_id, status, created_at, tasks(reward, title)").eq("user_id", userId),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId),
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

    return {
      profile: profileRes.data,
      transactions,
      submissions,
      balance,
      lifetime,
      pending,
      verifiedCount: submissions.filter((s) => s.status === "verified").length,
      referrals: refRes.count ?? 0,
    };
  });

export const submitTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; proofText?: string; proofUrl?: string }) => d)
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Owner/admin authorization required.");

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
          amount: Number((reward * 0.08).toFixed(2)),
          kind: "referral",
        });
      }
    }

    return { status: "verified" as const };
  });

export const listPendingSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Owner/admin authorization required.");

    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select("*, tasks(title, platform, reward, advertiser)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
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
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      label: `Daily check-in — day ${streak}`,
      amount: 0.1,
      kind: "bonus",
    });
    return { already: false, streak };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: string; address: string; amount: number }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.address.trim()) throw new Error("Enter your wallet address.");
    if (!(data.amount >= 10)) throw new Error("Minimum withdrawal is $10.00.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .eq("user_id", userId);
    const balance = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
    if (balance < data.amount) throw new Error("Not enough balance for this withdrawal.");

    const { error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId,
      method: data.method,
      address: data.address.trim(),
      amount: data.amount,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      label: `Withdrawal — ${data.method}`,
      amount: -Math.abs(data.amount),
      kind: "withdrawal",
    });
    return { ok: true };
  });

export const applyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Enter an invite code.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("referred_by, referral_code")
      .eq("id", userId)
      .maybeSingle();
    if (me?.referred_by) throw new Error("You already used an invite code.");
    if (me?.referral_code === code) throw new Error("You cannot use your own code.");

    const { data: inviter } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!inviter) throw new Error("That invite code doesn't exist.");

    await supabaseAdmin.from("profiles").update({ referred_by: inviter.id }).eq("id", userId);
    await supabaseAdmin.from("transactions").insert([
      { user_id: inviter.id, label: "Referral bonus", amount: 0.25, kind: "referral" },
      { user_id: userId, label: "Welcome invite bonus", amount: 0.15, kind: "bonus" },
    ]);
    return { ok: true };
  });

/** Owner creates a publishable task (simple path until full Advertise flow ships). */
export const ownerCreateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      platform: string;
      title: string;
      advertiser: string;
      reward: number;
      slots: number;
      steps: string[];
      proof: "auto" | "screenshot" | "username";
      link?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Owner/admin authorization required.");
    if (!(data.reward > 0) || !(data.slots > 0) || !data.title.trim()) {
      throw new Error("Invalid task configuration.");
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        platform: data.platform as never,
        title: data.title.trim(),
        advertiser: data.advertiser.trim() || "TASKORA",
        reward: data.reward,
        slots_left: data.slots,
        steps: data.steps.length ? data.steps : ["Complete the required action", "Return and submit proof"],
        proof: data.proof,
        link: data.link ?? null,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return task;
  });
