import { Clock3 } from "lucide-react";
import { PlatformLogo, type Platform } from "@/components/PlatformIcon";
import { AppLink } from "@/components/AppLink";

export type TaskCardTask = {
  id: string;
  platform: string;
  title: string;
  advertiser?: string;
  reward: number | string;
  /** Optional task points (defaults to reward × 8 like EarnIT) */
  points?: number | string | null;
  seconds?: number;
  slots_left?: number | null;
  slots_total?: number | null;
  featured?: boolean;
};

function formatUsdt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.1) return n.toFixed(2);
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

function shortId(id: string): string {
  const s = String(id || "");
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-5);
  return s.slice(0, 6);
}

/** EarnIT-style solid orange pill CTA */
const START_PILL =
  "linear-gradient(180deg, #ffb347 0%, #ff8c1a 45%, #ff6b00 100%)";
const RETRY_PILL =
  "linear-gradient(180deg, #ffc266 0%, #ff9f1a 45%, #ff8500 100%)";

/**
 * EarnIT-style horizontal task row:
 * [icon] title
 *        ₮ +0.xx  🪙 +0.xx  ──progress── slots  ⏱ mins  #id     [START]
 */
export function TaskCard({
  task,
  status,
  ctaLabel,
}: {
  task: TaskCardTask;
  status?: "pending" | "verified" | "rejected" | "started" | null;
  ctaLabel?: string;
}) {
  const reward = Number(task.reward ?? 0);
  const points = Number(task.points ?? reward * 8);
  const slotsLeft = Math.max(0, Number(task.slots_left ?? 0));
  const slotsTotal = Math.max(0, Number(task.slots_total ?? 0));
  const filled =
    slotsTotal > 0
      ? Math.min(1, Math.max(0, (slotsTotal - slotsLeft) / slotsTotal))
      : 0.35;
  const secs = Math.max(0, Number(task.seconds ?? 0));
  const mins = secs > 0 ? Math.max(1, Math.round(secs / 60)) : 0;

  const isRetry = status === "started" || status === "pending";
  const label =
    ctaLabel ??
    (isRetry ? "RETRY" : status === "verified" ? "DONE" : "START");
  const disabled = status === "verified";

  return (
    <div className="relative flex items-center gap-2.5 rounded-2xl bg-[#121212] px-3 py-3">
      {/* Platform icon */}
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1a1a1a]">
        <PlatformLogo platform={task.platform as Platform} size={26} />
      </div>

      {/* Title + rewards row */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight text-neutral-50">
          {task.title}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* USDT */}
          <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-emerald-400">
            <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-emerald-500/25 text-[9px] font-black text-emerald-400">
              ₮
            </span>
            +{formatUsdt(reward)}
          </span>

          {/* Coins / points */}
          <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-amber-400">
            <span className="text-[12px] leading-none">🪙</span>
            +{formatUsdt(points)}
          </span>

          {/* Progress bar + slots left */}
          <span className="inline-flex min-w-[48px] max-w-[64px] flex-1 items-center gap-1.5">
            <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-neutral-800">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.round(filled * 100)}%`,
                  background: "linear-gradient(90deg, #ff6b00, #ffb347)",
                }}
              />
            </span>
            <span className="text-[11px] font-medium tabular-nums text-neutral-400">
              {slotsLeft || "—"}
            </span>
          </span>

          {/* Estimated minutes */}
          {mins > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-neutral-500">
              <Clock3 className="size-3" strokeWidth={1.75} />
              {mins}
            </span>
          ) : null}

          {/* Short task id */}
          <span className="text-[10px] text-neutral-600">#{shortId(task.id)}</span>
        </div>
      </div>

      {/* START / RETRY / DONE pill — EarnIT style */}
      {disabled ? (
        <span
          className="shrink-0 rounded-full px-5 py-2.5 text-[13px] font-extrabold tracking-wide text-neutral-500"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {label}
        </span>
      ) : (
        <AppLink
          to="/tasks/$taskId"
          params={{ taskId: String(task.id) }}
          className="shrink-0 rounded-full px-5 py-2.5 text-[13px] font-extrabold tracking-wide text-white shadow-lg active:scale-[0.97] active:opacity-95"
          style={{
            background: isRetry ? RETRY_PILL : START_PILL,
            boxShadow: "0 4px 14px rgba(255, 107, 0, 0.45)",
          }}
        >
          {label}
        </AppLink>
      )}
    </div>
  );
}
