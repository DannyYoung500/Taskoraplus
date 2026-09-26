/**
 * Public payout proof archive — last paid withdrawals (redacted addresses).
 */
import { createServerFn } from "@tanstack/react-start";

export type PublicPayoutProof = {
  id: string;
  amount: number;
  method: string;
  address_short: string;
  tx_hash: string | null;
  display_name: string | null;
  processed_at: string | null;
  created_at: string | null;
};

function shortAddr(addr: string): string {
  const a = (addr || "").trim();
  if (a.length <= 12) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Public list of recent paid withdrawals for trust / transparency. */
export const listPublicPayoutProofs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rows: PublicPayoutProof[]; total: number }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error, count } = await supabaseAdmin
        .from("withdrawals")
        .select(
          "id, amount, method, address, tx_hash, processed_at, created_at, profiles:user_id(display_name)",
          { count: "exact" },
        )
        .eq("status", "paid")
        .order("processed_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);

      const rows: PublicPayoutProof[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        amount: Number(r.amount ?? 0),
        method: String(r.method ?? "USDT"),
        address_short: shortAddr(String(r.address ?? "")),
        tx_hash: r.tx_hash ? String(r.tx_hash).slice(0, 80) : null,
        display_name: r.profiles?.display_name
          ? String(r.profiles.display_name).slice(0, 24)
          : null,
        processed_at: r.processed_at ? String(r.processed_at) : null,
        created_at: r.created_at ? String(r.created_at) : null,
      }));

      return { rows, total: count ?? rows.length };
    } catch {
      return { rows: [], total: 0 };
    }
  },
);
