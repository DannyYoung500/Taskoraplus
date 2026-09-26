import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ownerCreateTask } from "@/lib/taskora.functions";

const ALLOWED_ACTIONS: Record<string, string[]> = {
  telegram: ["join", "follow", "watch", "like", "comment"],
  youtube: ["watch", "subscribe", "like", "comment"],
  whatsapp: ["join", "follow", "watch"],
  x: ["follow", "like", "repost", "comment", "watch"],
  instagram: ["follow", "like", "comment", "watch"],
  tiktok: ["follow", "like", "comment", "watch"],
  discord: ["join", "follow", "watch"],
  facebook: ["follow", "like", "comment", "watch"],
  reddit: ["follow", "like", "comment", "watch"],
  linkedin: ["follow", "like", "comment", "watch"],
  twitch: ["follow", "watch", "comment"],
  threads: ["follow", "like", "repost", "comment", "watch"],
  spotify: ["play", "follow", "like", "watch"],
  soundcloud: ["play", "follow", "like", "watch"],
  audiomack: ["play", "follow", "like", "watch"],
  pinterest: ["follow", "like", "save", "watch"],
  google: ["review", "watch"],
  website: ["visit", "signup", "watch"],
  survey: ["vote", "signup", "watch"],
  app_review: ["review", "watch"],
};

export const createAdvertiseTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      platform: string;
      taskType: string;
      title: string;
      description: string;
      instructions: string;
      warningText: string;
      reward: number;
      slots: number;
      steps: string[];
      proof: "auto" | "screenshot" | "username";
      proofRequirements: string[];
      difficulty: "easy" | "medium" | "hard";
      screenshotsRequired: number;
      featured: boolean;
      link?: string | undefined;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    if (!context.userId) throw new Error("Owner/admin authorization required.");
    const allowed = ALLOWED_ACTIONS[data.platform] ?? [];
    if (!allowed.includes(data.taskType)) {
      throw new Error(`${data.taskType} is not available for ${data.platform}.`);
    }
    if (!data.title.trim() || !(data.reward > 0) || !(data.slots > 0)) {
      throw new Error("Complete the required task details first.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      platform: data.platform as never,
      title: data.title.trim(),
      advertiser: "TASKORA",
      reward: data.reward,
      slots_left: data.slots,
      steps: data.steps.filter(Boolean),
      proof: data.proof,
      link: data.link?.trim() || null,
      is_active: true,
      task_type: data.taskType,
      description: data.description.trim() || null,
      instructions: data.instructions.trim() || null,
      warning_text: data.warningText.trim() || null,
      target_url: data.link?.trim() || null,
      difficulty: data.difficulty,
      screenshots_required: data.screenshotsRequired,
      proof_requirements: data.proofRequirements,
      featured: data.featured,
      task_metadata: {
        created_from: "advertise",
        task_format: "standard-task-details",
      },
    };

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert(payload as never)
      .select("*")
      .single();

    if (!error && task) {\n      try { const { publishNewTaskNotification } = await import("@/lib/notify-user"); await publishNewTaskNotification(task); } catch {}\n      return task;\n    }

    // Keep the restored Advertise page usable if the optional task-detail migration
    // has not reached the database yet. The migration stores the full fields above.
    if (error && /column .*does not exist|could not find the .* column/i.test(error.message)) {
      return ownerCreateTask({
        data: {
          platform: data.platform,
          title: data.title,
          advertiser: "TASKORA",
          reward: data.reward,
          slots: data.slots,
          steps: data.steps,
          proof: data.proof,
          link: data.link?.trim() || undefined,
        },
      });
    }

    throw new Error(error?.message ?? "Could not create task.");
  });
