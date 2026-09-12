import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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
  .inputValidator((d: { taskId: string; proofText?: string }) => d)
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

    const autoVerified = task.proof === "auto";
    const { error } = await supabaseAdmin.from("submissions").insert({
      user_id: userId,
      task_id: task.id,
      status: autoVerified ? "verified" : "pending",
      proof_text: data.proofText ?? null,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("tasks")
      .update({ slots_left: Math.max(0, task.slots_left - 1) })
      .eq("id", task.id);

    if (autoVerified) {
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        label: `Verified — ${task.advertiser}`,
        amount: task.reward,
        kind: "reward",
      });
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("referred_by")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.referred_by) {
        await supabaseAdmin.from("transactions").insert({
          user_id: profile.referred_by,
          label: "Referral share",
          amount: Number((Number(task.reward) * 0.08).toFixed(2)),
          kind: "referral",
        });
      }
    }

    return { status: autoVerified ? "verified" : "pending" };
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
