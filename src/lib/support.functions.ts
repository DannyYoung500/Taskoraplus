import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (error.message.includes("does not exist")) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  });

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject: string; body: string; attachmentUrl?: string }) => d)
  .handler(async ({ data, context }) => {
    const subject = data.subject.trim();
    const body = data.body.trim();
    if (!subject || !body) throw new Error("Subject and message are required.");
    let attachmentUrl: string | null = null;
    const rawAtt = String(data.attachmentUrl || "").trim();
    if (rawAtt) {
      if (!/^https?:\/\//i.test(rawAtt)) {
        throw new Error("Attachment must be a public https image/link URL.");
      }
      if (rawAtt.length > 500) throw new Error("Attachment URL is too long.");
      attachmentUrl = rawAtt.slice(0, 500);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const insertRow: Record<string, unknown> = {
      user_id: context.userId,
      subject,
      body,
      status: "open",
    };
    if (attachmentUrl) insertRow.attachment_url = attachmentUrl;
    const { data: row, error } = await supabaseAdmin
      .from("support_tickets")
      .insert(insertRow as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(
        `🎫 <b>New support ticket</b>\n<code>${String((row as { id?: string }).id || "").slice(0, 8)}</code>\n${subject.slice(0, 80)}\n${body.slice(0, 120)}` +
          (attachmentUrl ? `\n📎 ${attachmentUrl.slice(0, 80)}` : ""),
      );
    } catch {
      /* soft */
    }
    return row;
  });

export const createSubmissionAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    const reason = data.reason.trim();
    if (reason.length < 12) throw new Error("Explain why this should be reconsidered (min 12 characters).");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id, status, task_id")
      .eq("id", data.submissionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Submission not found.");
    if (String((sub as { status?: string }).status) !== "rejected") {
      throw new Error("Only rejected submissions can be appealed.");
    }
    const { data: existing } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "open")
      .ilike("subject", `%appeal:${data.submissionId}%`)
      .maybeSingle();
    if (existing) throw new Error("You already have an open appeal for this submission.");

    const { data: row, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: context.userId,
        subject: `appeal:${data.submissionId}`,
        body: reason,
        status: "open",
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.from("verification_cases").insert({
        subject_type: "submission",
        subject_id: data.submissionId,
        verification_type: "submission_appeal",
        status: "pending",
        evidence: {
          user_id: context.userId,
          task_id: (sub as { task_id?: string }).task_id,
          reason,
          ticket_id: (row as { id?: string })?.id,
          at: new Date().toISOString(),
        },
      } as never);
    } catch {
      /* soft */
    }
    return row;
  });

export const listMyAppeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("user_id", context.userId)
      .ilike("subject", "appeal:%")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      if (error.message.includes("does not exist")) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  });

export const ownerListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner, admin } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (error.message.includes("does not exist")) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  });

export const ownerCloseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner, admin } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const db = await admin();
    const { error } = await db
      .from("support_tickets")
      .update({ status: "closed" } as never)
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { ownerReplyTicket } from "@/lib/premium-product.functions";
