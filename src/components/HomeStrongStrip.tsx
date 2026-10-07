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

/** Live availability strip + open-amendments banner for home. */
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
    <div className="mb-3.5 space-y-2">
      {amends.length > 0 ? (
        <AppLink
          to="/amendments"
          className="flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 active:scale-[0.99]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-amber-100">
              {amends.length} proof{amends.length > 1 ? "s" : ""} need a small fix
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-amber-200/80">
              {amends[0]?.reason ?? "Campaign owner asked you to update your proof."}
            </p>
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-amber-300" />
        </AppLink>
      ) : null}

      {meta ? (
        <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/15 bg-[#0b1628] px-3 py-2">
          <Flame className="size-4 shrink-0 text-orange-300" />
          <p className="min-w-0 flex-1 text-[11px] text-slate-300">
            <span className="font-bold text-cyan-200">{meta.available}</span> live tasks
            {meta.availableRewardsUsd > 0 ? (
              <>
                {" · "}
                <span className="font-bold text-cyan-200">{formatUsd(meta.availableRewardsUsd)}</span> available
              </>
            ) : null}
            {meta.newToday > 0 ? (
              <span className="text-slate-500"> · {meta.newToday} new today</span>
            ) : null}
          </p>
          <AppLink to="/tasks" className="text-[10px] font-bold text-cyan-300">
            Browse →
          </AppLink>
        </div>
      ) : null}
    </div>
  );
}
