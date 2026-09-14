import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

/**
 * In-app notification center surface.
 * Bot push delivery is a separate remaining work item (Telegram Bot API sendMessage).
 */
function NotificationsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Bell className="size-5 text-amber-300" /> Notifications
      </h1>
      <p className="mt-1 text-xs text-white/45">Task reviews · rewards · withdrawals · announcements</p>

      <div className="mt-6 rounded-2xl border border-white/8 bg-[#12141c] p-5 text-center">
        <p className="text-sm text-white/55">No notifications yet.</p>
        <p className="mt-2 text-[11px] text-white/35">
          When owner reviews a task or processes a withdrawal, updates will appear here. Telegram bot
          push is coming next.
        </p>
      </div>
    </main>
  );
}
