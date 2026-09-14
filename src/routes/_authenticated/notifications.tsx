import { createFileRoute } from "@tanstack/react-router";
import { Bell, Megaphone } from "lucide-react";
import { Screen, ScreenTitle, Card } from "@/components/Screen";
import { listActiveAnnouncements } from "@/lib/announcements.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  loader: async () => {
    const items = await listActiveAnnouncements().catch(() => []);
    return { items };
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { items } = Route.useLoaderData();

  return (
    <Screen>
      <ScreenTitle title="Notifications" subtitle="Announcements · reviews · rewards" />

      {items.length === 0 ? (
        <Card className="p-5 text-center">
          <Bell className="mx-auto size-8 text-amber-300/50" />
          <p className="mt-3 text-sm text-white/55">No notifications yet.</p>
          <p className="mt-2 text-[11px] text-white/35">
            Owner broadcasts and system updates appear here. Telegram bot push is still remaining.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n: { id: string; title: string; body: string; created_at: string }) => (
            <Card key={n.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
                  <Megaphone className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{n.body}</p>
                  <p className="mt-2 text-[10px] text-white/30">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
