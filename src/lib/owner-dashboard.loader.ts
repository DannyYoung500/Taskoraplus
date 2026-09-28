/** Load the owner command center without letting one probe take the whole dashboard down. */
import { ownerListSubmissions, ownerOverview, ownerWithdrawals } from "@/lib/owner.functions";
import { getSystemHealth } from "@/lib/owner-ops.functions";

export async function loadOwnerDashboard() {
  const errors: string[] = [];
  const [overview, submissions, withdrawals, health] = await Promise.all([
    ownerOverview().catch((e) => {
      errors.push(e instanceof Error ? e.message : "Overview failed");
      return null;
    }),
    ownerListSubmissions({ data: { status: "pending" } }).catch((e) => {
      errors.push(e instanceof Error ? e.message : "Submissions failed");
      return [];
    }),
    ownerWithdrawals({ data: { status: "pending" } }).catch((e) => {
      errors.push(e instanceof Error ? e.message : "Withdrawals failed");
      return [];
    }),
    getSystemHealth().catch((e) => {
      errors.push(e instanceof Error ? e.message : "Health check failed");
      return null;
    }),
  ]);

  return { overview, submissions: submissions ?? [], withdrawals: withdrawals ?? [], health, error: errors.length ? errors.join(" · ") : null };
}
