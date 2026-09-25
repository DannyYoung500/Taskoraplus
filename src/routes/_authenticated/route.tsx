import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";
import { getAccountAccess } from "@/lib/account-access.functions";
import { touchPresence } from "@/lib/presence.functions";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) throw redirect({ to: "/" });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw redirect({ to: "/" });
    }

    const path = location.pathname || "";

    // Presence heartbeat on every authenticated navigation (non-blocking)
    void touchPresence().catch(() => undefined);

    // Ban / suspend / maintenance (owners still reach /owner during maintenance)
    try {
      const access = await getAccountAccess();
      if (access.state === "banned") throw redirect({ to: "/banned" });
      if (access.state === "suspended") throw redirect({ to: "/suspended" });
      if (access.state === "maintenance" && !path.startsWith("/owner")) {
        throw redirect({ to: "/maintenance" });
      }
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
    }

    // Owner console and gate screen themselves are exempt from membership gate
    if (path.startsWith("/owner") || path === "/telegram-gate") {
      return { user: { id: data.user.id } };
    }

    const initData =
      typeof window !== "undefined" ? (window.Telegram?.WebApp?.initData ?? "") : "";

    if (!initData) {
      return { user: { id: data.user.id } };
    }

    try {
      const status = await getTelegramGateStatus({ data: { initData, force: false } });
      if (status.allowed) {
        return { user: { id: data.user.id } };
      }
      throw redirect({ to: "/telegram-gate" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
      throw redirect({ to: "/telegram-gate" });
    }
  },
  pendingComponent: AuthenticatedPending,
  errorComponent: AuthenticatedError,
  component: () => <div className="taskora-blue-shell taskora-owner-aware-shell"><Outlet /></div>,
});


function AuthenticatedPending() {
  return (
    <main className="min-h-screen bg-[#030814] px-5 pb-28 pt-16 text-white">
      <div className="mx-auto w-full max-w-md animate-pulse">
        <div className="mb-5 h-8 w-32 rounded-xl bg-white/[0.08]" />
        <div className="mb-3 h-32 rounded-[22px] bg-white/[0.06]" />
        <div className="mb-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
        <div className="h-40 rounded-[22px] bg-white/[0.06]" />
      </div>
    </main>
  );
}

function AuthenticatedError({ error }: { error: Error }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030814] px-5 pb-28 text-white">
      <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-white/[0.04] p-6 text-center">
        <p className="text-lg font-black">TASKORA couldn&apos;t load this page</p>
        <p className="mt-2 break-words text-sm text-slate-400">
          {error.message || "Something went wrong while opening the page."}
        </p>
      </div>
    </main>
  );
}
