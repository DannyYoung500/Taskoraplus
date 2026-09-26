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
  .inputValidator((d: { subject: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    const subject = data.subject.trim();
    const body = data.body.trim();
    if (!subject || !body) throw new Error("Subject and message are required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: context.userId,
        subject,
        body,
        status: "open",
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
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
