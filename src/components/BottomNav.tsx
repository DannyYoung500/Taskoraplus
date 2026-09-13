import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListChecks, PlayCircle, Wallet, User } from "lucide-react";

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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-[#0e1118]/95 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {ITEMS.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
