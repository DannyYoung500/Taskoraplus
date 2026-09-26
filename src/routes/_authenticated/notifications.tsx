import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ChevronRight, Megaphone } from "lucide-react";
import { listActiveAnnouncements } from "@/lib/announcements.functions";
import { BLUE_GRAD } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — TASKORA" }] }),
  loader: async () => {
    const items = await listActiveAnnouncements().catch(() => []);
    return { items };
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { items } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2">
        <Link to="/home" className="rounded-full border border-white/10 p-2 text-slate-400">
          <ChevronRight className="size-4 rotate-180" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black tracking-tight">Notifications</p>
          <p className="text-[10px] text-slate-500">Announcements · system updates</p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[#0b1628] p-8 text-center">
          <Bell className="mx-auto size-9 text-cyan-400/40" />
          <p className="mt-3 text-sm font-bold text-slate-300">No notifications yet</p>
          <p className="mt-1.5 text-[12px] text-slate-500">
            Owner broadcasts and system alerts will show here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n: { id: string; title: string; body: string; created_at: string }) => (
            <div
              key={n.id}
              className="rounded-2xl border border-cyan-400/15 bg-[#0b1628] p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: BLUE_GRAD }}
                >
                  <Megaphone className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{n.body}</p>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
