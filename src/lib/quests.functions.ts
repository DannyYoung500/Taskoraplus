/**
 * Daily quest claim — awards Task Points once per quest per UTC day.
 * Idempotent via award_task_points reference key.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const claimDailyQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { questId: string }) => d)
  .handler(async ({ data, context }) => {
    const questId = String(data.questId || "").trim();
    if (!questId) throw new Error("Quest id required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const today = new Date().toISOString().slice(0, 10);
    const dayStart = `${today}T00:00:00.000Z`;

    const { data: econ } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "economy")
      .maybeSingle();
    const v = (econ?.value ?? {}) as Record<string, unknown>;
    const daily = Array.isArray(v.daily_tasks)
      ? (v.daily_tasks as Array<Record<string, unknown>>)
      : [];

    const list =
      daily.length > 0
        ? daily.filter((d) => d.enabled !== false)
        : [
            {
              id: "default_tasks",
              title: "Complete 3 Tasks",
              action: "tasks",
              target_count: 3,
              task_points: 100,
              reward_usdt: 0,
              enabled: true,
            },
            {
              id: "default_watch",
              title: "Watch 5 Videos",
              action: "watch",
              target_count: 5,
              task_points: 50,
              reward_usdt: 0,
              enabled: true,
            },
            {
              id: "default_invite",
              title: "Invite 1 Friend",
              action: "invite",
              target_count: 1,
              task_points: 200,
              reward_usdt: 0,
              enabled: true,
            },
          ];

    const quest = list.find((d) => String(d.id) === questId);
    if (!quest) throw new Error("Quest not found or disabled.");

    const action = String(quest.action ?? "tasks");
    const target = Math.max(1, Math.floor(Number(quest.target_count ?? 1)));
    const points = Math.max(0, Math.floor(Number(quest.task_points ?? 0)));
    const usdt = Math.max(0, Number(quest.reward_usdt ?? 0));

    if (points <= 0 && usdt <= 0) {
      throw new Error("This quest has no reward configured.");
    }

    const [{ count: taskCount }, { count: watchCount }, { count: inviteCount }] = await Promise.all([
      supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", dayStart),
      supabaseAdmin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", "watch")
        .gte("created_at", dayStart),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", userId)
        .gte("created_at", dayStart),
    ]);

    const counts: Record<string, number> = {
      tasks: Number(taskCount ?? 0),
      watch: Number(watchCount ?? 0),
      invite: Number(inviteCount ?? 0),
      custom: 0,
    };
    const done = counts[action] ?? 0;
    if (done < target) {
      throw new Error(`Progress ${done}/${target} — finish the quest first.`);
    }

    const reference = `quest_claim:${userId}:${questId}:${today}`;
    let taskPointTotal = 0;
    let already = false;

    if (points > 0) {
      const { data: total, error: pointsError } = await (supabaseAdmin as any).rpc(
        "award_task_points",
        {
          _user_id: userId,
          _amount: points,
          _kind: "daily_quest",
          _label: `Daily quest — ${String(quest.title ?? questId).slice(0, 60)}`,
          _reference: reference,
        },
      );
      if (pointsError) {
        const msg = String(pointsError.message || "");
        if (/duplicate|unique|already/i.test(msg)) {
          already = true;
        } else {
          throw new Error(pointsError.message);
        }
      } else {
        taskPointTotal = Number(total ?? 0);
      }
    }

    if (already) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("task_points")
        .eq("id", userId)
        .maybeSingle();
      return {
        ok: true as const,
        already: true as const,
        taskPoints: 0,
        usdt: 0,
        taskPointTotal: Number((prof as { task_points?: number } | null)?.task_points ?? 0),
      };
    }

    if (usdt > 0) {
      const { data: existingTx } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("label", `Quest — ${questId} — ${today}`)
        .maybeSingle();
      if (!existingTx) {
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          label: `Quest — ${questId} — ${today}`,
          amount: usdt,
          kind: "bonus",
        } as never);
      }
    }

    return {
      ok: true as const,
      already: false as const,
      taskPoints: points,
      usdt,
      taskPointTotal,
    };
  });
