import { createServerFn } from "@tanstack/react-start";

/**
 * Public ledger statistics are exposed through a dedicated server function.
 * Keep this module isolated from other server-only helpers so the route's
 * client bundle never traverses into a module containing server-only imports.
 */
export const getPublicPlatformStats = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const day = new Date(Date.now() - 86400_000).toISOString();
      const [verifiedToday, paidWeek] = await Promise.all([
        supabaseAdmin
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .gte("updated_at", day),
        supabaseAdmin
          .from("withdrawals")
          .select("amount")
          .eq("status", "paid")
          .gte("processed_at", since),
      ]);
      const paidUsd = (paidWeek.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
      return {
        verifiedToday: verifiedToday.count ?? 0,
        paidWeekUsd: Math.round(paidUsd * 100) / 100,
      };
    } catch {
      return { verifiedToday: 0, paidWeekUsd: 0 };
    }
  },
);
