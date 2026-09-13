import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Connected accounts — store handles as pending until real verification exists.
 * Never mark verified without a real adapter (Telegram membership needs bot admin, etc.).
 */
export const listConnectedAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("connected_accounts")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) {
      // Table may not exist until SQL is applied
      if (error.message.includes("does not exist")) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  });

export const requestConnectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { platform: string; handle: string; profileUrl?: string }) => d)
  .handler(async ({ data, context }) => {
    const handle = data.handle.trim();
    if (!handle) throw new Error("Enter a username or handle.");
    const platform = data.platform.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("connected_accounts")
      .upsert(
        {
          user_id: context.userId,
          platform: platform as never,
          handle,
          profile_url: data.profileUrl?.trim() || null,
          status: "pending",
        } as never,
        { onConflict: "user_id,platform" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
