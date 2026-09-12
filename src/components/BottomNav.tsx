import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListChecks, PlayCircle, Wallet, User } from "lucide-react";

/** Spec nav: HOME · TASKS · WATCH & EARN · WALLET · PROFILE */
const ITEMS = [
  { to: "/home", label: "Home", Icon: Home },
  { to: "/tasks", label: "Tasks", Icon: ListChecks },
  { to: "/watch-earn", label: "Watch", Icon: PlayCircle },
  { to: "/wallet", label: "Wallet", Icon: Wallet },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/" || pathname.startsWith("/auth")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {ITEMS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="group flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-5" strokeWidth={2.1} />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
