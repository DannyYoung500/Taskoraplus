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
  component: () => (\n    <>\n      <style>{".taskora-advertise-theme,.taskora-advertise-theme :where(main,section,header,nav,article,aside){--taskora-page:#05070c;--taskora-surface:#12141c;--taskora-surface-2:#0b0d14;--taskora-border:rgba(255,255,255,.10);--taskora-accent:#38bdf8;--taskora-accent-strong:#0ea5e9}.taskora-advertise-theme{min-height:100dvh;background:radial-gradient(circle at 88% 0%,rgba(14,165,233,.13),transparent 32%),radial-gradient(circle at 0% 24%,rgba(56,189,248,.07),transparent 28%),#05070c;color:#fff}.taskora-advertise-theme [class*=\"bg-[#030814]\"],.taskora-advertise-theme [class*=\"bg-[#06152d]\"],.taskora-advertise-theme [class*=\"bg-[#071a36]\"],.taskora-advertise-theme [class*=\"bg-[#0b1424]\"],.taskora-advertise-theme [class*=\"bg-[#0a1423]\"],.taskora-advertise-theme [class*=\"bg-[#0b1628\"]{background-color:#05070c!important;background-image:none!important}.taskora-advertise-theme [class*=\"bg-[#121f33]\"],.taskora-advertise-theme [class*=\"bg-[#0b2040]\"],.taskora-advertise-theme [class*=\"bg-[#0a1423]\"],.taskora-advertise-theme [class*=\"bg-[#0b1628]\"],.taskora-advertise-theme [class*=\"bg-[#0b1c31]\"]{background-color:#12141c!important}.taskora-advertise-theme [class*=\"bg-[#07111f]\"]{background-color:#0b0d14!important}.taskora-advertise-theme [class*=\"border-cyan-\"],.taskora-advertise-theme [class*=\"border-blue-\"]{border-color:rgba(56,189,248,.18)!important}.taskora-advertise-theme [class*=\"text-cyan-\"],.taskora-advertise-theme [class*=\"text-blue-\"]{color:#38bdf8!important}.taskora-advertise-theme [class*=\"bg-cyan-\"],.taskora-advertise-theme [class*=\"bg-blue-\"]{background-color:rgba(56,189,248,.07)!important}.taskora-advertise-theme [class*=\"text-slate-\"]{color:#94a3b8!important}.taskora-advertise-theme [class*=\"border-white/\"]{border-color:rgba(255,255,255,.10)!important}.taskora-advertise-theme input,.taskora-advertise-theme textarea,.taskora-advertise-theme select{border-color:rgba(255,255,255,.10)!important;background-color:rgba(0,0,0,.30)!important}.taskora-advertise-theme a,.taskora-advertise-theme button{-webkit-tap-highlight-color:transparent}"}</style>\n      <div className="taskora-advertise-theme taskora-owner-aware-shell"><Outlet /></div>\n    </>\n  ),
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
