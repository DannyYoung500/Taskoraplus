import { useEffect, useState } from "react";
import { AppLink } from "@/components/AppLink";
import { listSmartTasksEnhanced } from "@/lib/strong-feed-enhanced.functions";
import { listOpenAmendments } from "@/lib/strong-tier-b.functions";
import { formatUsd } from "@/lib/taskora-display";
import { AlertCircle, Flame, ChevronRight } from "lucide-react";

type FeedMeta = {
  available: number;
  availableRewardsUsd: number;
  newToday: number;
  trustBand: string;
};

type OpenAmend = {
  id: string;
  submission_id: string;
  reason: string;
  deadline: string | null;
  task_id?: string | null;
};

export function HomeStrongStrip() {
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [amends, setAmends] = useState<OpenAmend[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [feed, open] = await Promise.all([
          listSmartTasksEnhanced().catch(() => null),
          listOpenAmendments().catch(() => ({ open: [] as OpenAmend[] })),
        ]);
        if (cancelled) return;
        if (feed?.meta) setMeta(feed.meta as FeedMeta);
        setAmends((open?.open ?? []) as OpenAmend[]);
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-4 space-y-2">
      {amends.length > 0 ? (
        <AppLink
          to="/amendments"
          className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 px-3.5 py-2.5 active:opacity-90"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-amber-100">
              {amends.length} proof{amends.length > 1 ? "s" : ""} need a small fix
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] font-normal text-amber-200/70">
              {amends[0]?.reason ?? "Campaign owner asked you to update your proof."}
            </p>
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-amber-400" strokeWidth={1.75} />
        </AppLink>
      ) : null}

      {meta ? (
        <div className="flex items-center gap-2 rounded-2xl bg-[#121212] px-3 py-2.5">
          <Flame className="size-4 shrink-0 text-orange-400" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-[12px] font-normal text-neutral-400">
            <span className="font-medium text-neutral-100">{meta.available}</span> live tasks
            {meta.availableRewardsUsd > 0 ? (
              <>
                {" · "}
                <span className="font-medium text-orange-400">{formatUsd(meta.availableRewardsUsd)}</span> available
              </>
            ) : null}
            {meta.newToday > 0 ? (
              <span className="text-neutral-600"> · {meta.newToday} new today</span>
            ) : null}
          </p>
          <AppLink to="/tasks" className="text-[11px] font-medium text-orange-400">
            Browse
          </AppLink>
        </div>
      ) : null}
    </div>
  );
}
