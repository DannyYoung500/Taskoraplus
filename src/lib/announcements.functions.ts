import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listActiveAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .select("id, title, body, created_at, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) {
        if (error.message.includes("does not exist")) return [];
        return [];
      }
      return data ?? [];
    } catch {
      return [];
    }
  });

/** Count of active announcements — header badge only when > 0. */
export const countActiveAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count, error } = await supabaseAdmin
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  });

/** Owner broadcast — creates an active in-app announcement for all users. */
export const ownerCreateAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title || !body) throw new Error("Title and message are required.");

    const { assertOwner, admin, audit } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const db = await admin();

    const { data: row, error } = await db
      .from("announcements")
      .insert({
        title,
        body,
        is_active: true,
        created_by: context.userId,
      } as never)
      .select("id, title, body, created_at, is_active")
      .single();

    if (error) {
      if (error.message.includes("does not exist")) {
        throw new Error("Announcements table missing. Run supabase/RUN_ALL_OWNER_SQL.sql");
      }
      throw new Error(error.message);
    }

    await audit({
      adminId: context.userId,
      action: "announcement.create",
      targetType: "announcement",
      targetId: row?.id,
      next: { title, body },
    });

    return row;
  });
