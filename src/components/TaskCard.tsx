import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, ChevronRight } from "lucide-react";
import { PlatformBadge, type Platform } from "@/components/PlatformIcon";

export type TaskCardTask = {
  id: string;
  platform: string;
  title: string;
  advertiser: string;
  reward: number | string;
  seconds: number;
};

export function TaskCard({
  task,
  status,
}: {
  task: TaskCardTask;
  status?: "pending" | "verified" | "rejected" | null;
}) {
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className="card-surface flex items-center gap-3 p-3 transition-transform active:scale-[0.98]"
    >
      <PlatformBadge platform={task.platform as Platform} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{task.title}</p>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{task.advertiser}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3" />
            {task.seconds}s
          </span>
          {status === "verified" ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="size-3" /> Verified
            </span>
          ) : status === "pending" ? (
            <span className="text-warning">In review</span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
          ${Number(task.reward).toFixed(2)}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
