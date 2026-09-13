import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listActiveAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      if (error.message.includes("does not exist")) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  });

export const ownerCreateAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner, admin, audit } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const db = await admin();
    const { data: row, error } = await db
      .from("announcements")
      .insert({
        title: data.title.trim(),
        body: data.body.trim(),
        is_active: true,
        created_by: context.userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await audit({
      adminId: context.userId,
      action: "announcement.create",
      targetType: "announcement",
      targetId: row.id,
    });
    return row;
  });
