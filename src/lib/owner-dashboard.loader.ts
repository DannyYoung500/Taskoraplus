/** Soft-fail owner dashboard data load — never crash Command Center on one bad query. */
import { ownerListSubmissions, ownerOverview, ownerWithdrawals } from "@/lib/owner.functions";

export async function loadOwnerDashboard() {
  const errors: string[] = [];
  const overview = await ownerOverview().catch((e) => {
    errors.push(e instanceof Error ? e.message : "Overview failed");
    return null;
  });
  const submissions = await ownerListSubmissions({ data: { status: "pending" } }).catch((e) => {
    errors.push(e instanceof Error ? e.message : "Submissions failed");
    return [];
  });
  const withdrawals = await ownerWithdrawals({ data: { status: "pending" } }).catch((e) => {
    errors.push(e instanceof Error ? e.message : "Withdrawals failed");
    return [];
  });
  return {
    overview,
    submissions: submissions ?? [],
    withdrawals: withdrawals ?? [],
    error: errors.length ? errors.join(" · ") : null,
  };
}
