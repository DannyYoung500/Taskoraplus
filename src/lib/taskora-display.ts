export const DEMO_TASK_TITLES = new Set([
  "Join the Alpha Signals channel",
  "Watch & like the launch video",
  "Follow @taskora and repost the pinned post",
  "Join the merchant community group",
  "Follow the creator account",
  "Join the community server",
  "Follow and save the brand post",
]);

export const DEMO_TRANSACTION_LABELS = new Set([
  "Referral bonus",
  "Welcome invite bonus",
  "Verified — Alpha Signals",
  "Verified — Nova Wallet",
  "Verified — TASKORA",
  "Verified — PayLink Africa",
  "Verified — Loop Studio",
  "Verified — Zenith Labs",
  "Verified — Aurum Wear",
]);

export function isDemoTaskTitle(title: string | null | undefined) {
  return Boolean(title && DEMO_TASK_TITLES.has(title));
}

export function isDemoTransactionLabel(label: string | null | undefined) {
  return Boolean(
    label &&
      (DEMO_TRANSACTION_LABELS.has(label) || label.startsWith("Daily check-in — day ")),
  );
}

export function formatUsd(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(3)}`;
}
