import { useRouter, useRouterState } from "@tanstack/react-router";
import { Home, ListChecks, PlayCircle, Wallet, User } from "lucide-react";

const ITEMS = [
  { to: "/home", label: "Home", Icon: Home },
  { to: "/tasks", label: "Tasks", Icon: ListChecks },
  { to: "/watch-earn", label: "Watch", Icon: PlayCircle },
  { to: "/wallet", label: "Wallet", Icon: Wallet },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

const HIDE_EXACT = new Set([
  "/",
  "/banned",
  "/suspended",
  "/maintenance",
  "/telegram-gate",
]);

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  if (HIDE_EXACT.has(pathname) || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {ITEMS.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="flex-1">
              <button
                type="button"
                onClick={() => {
                  void router.navigate({ to });
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${
                  active ? "text-orange-400" : "text-neutral-500"
                }`}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                <Icon className="pointer-events-none size-5" strokeWidth={active ? 2.2 : 1.75} />
                <span className="pointer-events-none text-[10px] font-normal leading-none">
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
