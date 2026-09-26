import type { ReactNode } from "react";
import { TASKORA_LOGO } from "@/lib/brand";

/** Consistent page shell — max-w-md, navy bg, bottom-nav clearance */
export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`tk-page ${className}`.trim()}>{children}</main>
  );
}

/** Shared page header with logo + title */
export function ScreenTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-center gap-2.5">
      <img
        src={TASKORA_LOGO}
        alt=""
        className="size-10 rounded-full object-cover ring-2 ring-cyan-400/40"
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-lg font-black tracking-[0.06em]"
          style={{
            background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          {title}
        </p>
        {subtitle ? <p className="text-[10px] text-slate-500">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}
