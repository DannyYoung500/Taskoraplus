import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { listMyPosted } from "@/lib/advertise.functions";
import { formatUsd } from "@/lib/taskora-display";
import { TASKORA_LOGO } from "@/lib/brand";
import { AppLink } from "@/components/AppLink";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  loader: async () => {
    const posted = await listMyPosted().catch(() => null);
    const all = Array.isArray(posted)
      ? posted
      : Array.isArray((posted as any)?.all)
        ? (posted as any).all
        : [];
    return { posted: all };
  },
  head: () => ({ meta: [{ title: "My Orders — TASKORA" }] }),
  component: MyOrders,
});

type Filter = "all" | "active" | "completed" | "cancelled";

function statusKey(raw: string): Filter {
  const s = String(raw || "").toLowerCase();
  if (["completed", "done", "finished"].includes(s)) return "completed";
  if (["cancelled", "canceled", "paused", "rejected"].includes(s)) return "cancelled";
  if (["active", "in_progress", "running", "funded", "live", "open", "draft"].includes(s)) return "active";
  return "active";
}

function statusBadge(raw: string) {
  const k = statusKey(raw);
  if (k === "completed")
    return { label: "Completed", className: "bg-emerald-500/15 text-emerald-400" };
  if (k === "cancelled")
    return { label: "Cancelled", className: "bg-red-500/15 text-red-400" };
  return { label: "In Progress", className: "bg-sky-500/15 text-sky-400" };
}

function MyOrders() {
  const { posted } = Route.useLoaderData();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo(() => {
    return (posted as any[]).filter((row) => {
      if (filter === "all") return true;
      return statusKey(String(row.status ?? "")) === filter;
    });
  }, [posted, filter]);

  function refresh() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <header className="mb-4 flex items-center gap-2.5">
        <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full object-cover" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium text-neutral-50">My Boost Orders</p>
          <p className="text-[11px] text-neutral-500">Track your social media boost orders</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex size-9 items-center justify-center rounded-xl bg-[#121212] text-neutral-400"
          aria-label="Refresh"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.75} />
        </button>
      </header>

      <AppLink
        to="/advertise"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[14px] font-medium text-[#0a0a0a]"
      >
        <Plus className="size-4" strokeWidth={2} />
        New Order
      </AppLink>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["all", "All"],
            ["active", "Active"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
          ] as const
        ).map(([key, label]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium ${
                active ? "bg-orange-500 text-[#0a0a0a]" : "bg-[#121212] text-neutral-400"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-[#121212] px-4 py-12 text-center">
          <p className="text-[14px] font-medium text-neutral-300">No orders yet</p>
          <p className="mt-1 text-[12px] text-neutral-600">
            Publish a campaign from Advertise to track delivery here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row: any) => {
            const delivered = Number(row.submissions ?? row.completed_count ?? 0);
            const total = Math.max(1, Number(row.slotsTotal ?? row.slots_total ?? 1));
            const pct = Math.min(100, Math.round((delivered / total) * 100));
            const statusRaw = row.isActive === false ? "cancelled" : String(row.status ?? "");
            const badge = statusBadge(statusRaw);
            const platform = String(row.platform || "other").toLowerCase() as Platform;
            const title = String(row.title || "Campaign");
            const link = String(row.link || "");
            const spent = Number(row.reward || 0) * total;
            const date = String(row.createdAt || row.created_at || "").slice(0, 10);

            return (
              <article key={String(row.id)} className="rounded-2xl bg-[#121212] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1a1a1a]">
                    <PlatformLogo platform={platform} size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-neutral-50">{title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                          {link || platformLabel(platform)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-300">
                          Custom
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>
                          {delivered} / {total} delivered
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 100 ? "bg-emerald-500" : "bg-sky-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-[12px]">
                        <span className="font-semibold text-emerald-400">{formatUsd(spent)}</span>
                        {date ? <span className="ml-2 text-neutral-600">{date}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <AppLink
                          to="/advertise"
                          className="rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[11px] font-medium text-neutral-300"
                        >
                          Duplicate
                        </AppLink>
                        {pct >= 100 ? (
                          <AppLink
                            to="/advertise"
                            className="rounded-lg bg-orange-500/15 px-2.5 py-1.5 text-[11px] font-medium text-orange-400"
                          >
                            Run again
                          </AppLink>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
