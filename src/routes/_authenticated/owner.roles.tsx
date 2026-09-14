import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ownerListStaffPermissions } from "@/lib/owner-more.functions";

export const Route = createFileRoute("/_authenticated/owner/roles")({
  component: OwnerRolesPage,
});

function OwnerRolesPage() {
  const [roles, setRoles] = useState<Array<{ user_id: string; role: string }>>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void ownerListStaffPermissions()
      .then((r) => {
        setRoles(r.roles as never);
        setCatalog(r.catalog);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Roles & Permissions</h1>
          <p className="text-xs text-white/45">Owner · Finance · Moderation · Support · Analyst</p>
        </div>
      </div>
      {msg ? <p className="mb-2 text-xs text-white/50">{msg}</p> : null}

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Assigned roles</p>
      <div className="mb-5 space-y-2">
        {roles.length === 0 ? (
          <p className="text-sm text-white/40">No staff roles yet. Owner Telegram ID auto-grants admin.</p>
        ) : (
          roles.map((r) => (
            <div
              key={`${r.user_id}-${r.role}`}
              className="rounded-xl border border-white/8 bg-[#12141c] px-3 py-2 text-xs"
            >
              <span className="font-semibold text-amber-300">{r.role}</span>
              <span className="ml-2 text-white/40">{r.user_id.slice(0, 8)}…</span>
            </div>
          ))
        )}
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Permission catalog</p>
      <div className="flex flex-wrap gap-1.5">
        {catalog.map((p) => (
          <span key={p} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/60">
            {p}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-white/35">
        Granular grant UI + dual-approval for high-risk actions is a remaining item. Owner identity remains the
        superuser via TASKORA_OWNER_TELEGRAM_IDS.
      </p>
    </main>
  );
}
