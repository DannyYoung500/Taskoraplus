import type { ReactNode } from "react";

const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">{children}</main>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <img src={LOGO} alt="" className="size-8 rounded-full object-cover" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
          TASKORA
        </span>
      </div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}
