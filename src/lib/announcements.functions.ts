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
