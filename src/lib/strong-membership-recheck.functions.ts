/**
 * Membership re-check (24h) — re-verify Telegram joins and flag leavers.
 * Owner/cron can call ownerRunMembershipRecheck.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

async function botToken(): Promise<string | null> {
  const t =
    process.env["BOT_TOKEN"] ||
    process.env["TELEGRAM_BOT_TOKEN"] ||
    process.env["TG_BOT_TOKEN"] ||
    "";
  return t.trim() || null;
}

async function tgGetChatMember(
  token: string,
  chatId: string,
  userId: number,
): Promise<"member" | "left" | "unknown"> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await r.json()) as any;
    if (!json.ok) return "unknown";
    const status = String(json.result?.status || "").toLowerCase();
    if (["creator", "administrator", "member", "restricted"].includes(status)) return "member";
    if (["left", "kicked"].includes(status)) return "left";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Re-check verified Telegram join submissions older than minAgeHours
 * and younger than maxAgeHours. Marks leavers as rejected + logs audit.
 */
export const ownerRunMembershipRecheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { minAgeHours?: number; maxAgeHours?: number; limit?: number }) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = await botToken();
    if (!token) throw new Error("BOT_TOKEN not configured");

    const minH = Math.max(1, Number((data as any)?.minAgeHours ?? 20));
    const maxH = Math.max(minH + 1, Number((data as any)?.maxAgeHours ?? 48));
    const limit = Math.min(200, Math.max(1, Number((data as any)?.limit ?? 50)));

    const now = Date.now();
    const olderThan = new Date(now - minH * 3600_000).toISOString();
    const newerThan = new Date(now - maxH * 3600_000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id, task_id, status, created_at, tasks!inner(platform, link, task_type, proof)")
      .eq("status", "verified")
      .gte("created_at", newerThan)
      .lte("created_at", olderThan)
      .limit(limit);

    if (error) throw new Error(error.message);

    let checked = 0;
    let left = 0;
    let still = 0;
    let skipped = 0;

    for (const row of rows ?? []) {
      const task = (row as any).tasks;
      const platform = String(task?.platform || "").toLowerCase();
      const proof = String(task?.proof || "").toLowerCase();
      const type = String(task?.task_type || "").toLowerCase();
      const isTgJoin =
        platform === "telegram" &&
        (proof === "auto" || type.includes("join") || type.includes("subscribe") || /t\.me\//i.test(String(task?.link || "")));
      if (!isTgJoin) {
        skipped += 1;
        continue;
      }

      const link = String(task?.link || "");
      const chatRef = link.match(/t\.me\/([A-Za-z0-9_]+)/)?.[1];
      if (!chatRef) {
        skipped += 1;
        continue;
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id")
        .eq("id", row.user_id)
        .maybeSingle();
      const tgId = Number((profile as any)?.telegram_id || 0);
      if (!tgId) {
        skipped += 1;
        continue;
      }

      checked += 1;
      const status = await tgGetChatMember(token, `@${chatRef}`, tgId);
      if (status === "left") {
        left += 1;
        await supabaseAdmin
          .from("submissions")
          .update({
            status: "rejected",
            review_note: "Membership re-check: user left channel/group within 24–48h",
          })
          .eq("id", row.id);
        try {
          await supabaseAdmin.from("audit_log").insert({
            actor_id: context.userId,
            action: "membership_recheck_reject",
            target_id: row.id,
            meta: { user_id: row.user_id, task_id: row.task_id, chat: chatRef },
          });
        } catch {
          /* soft */
        }
      } else if (status === "member") {
        still += 1;
      } else {
        skipped += 1;
      }
    }

    return { checked, left, still, skipped, minH, maxH };
  });
