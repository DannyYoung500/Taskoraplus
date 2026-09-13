import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ownerListUsers, ownerSetUserStatus, ownerAdjustWallet } from "@/lib/owner.functions";

export const Route = createFileRoute("/_authenticated/owner/users")({
  loader: async () => {
    try {
      const rows = await ownerListUsers({ data: {} });
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof ownerListUsers>>,
        error: e instanceof Error ? e.message : "Owner required",
      };
    }
  },
  component: OwnerUsers,
});

function OwnerUsers() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState(initial.error);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(q?: string) {
    setMsg(null);
    try {
      const next = await ownerListUsers({ data: { search: q ?? search } });
      setRows(next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function setStatus(userId: string, status: "active" | "suspended" | "banned") {
    setBusy(userId);
    try {
      await ownerSetUserStatus({ data: { userId, status } });
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function adjust(userId: string) {
    const amount = Number(prompt("Adjustment amount (use negative to deduct)") ?? "");
    const reason = prompt("Reason (required)") ?? "";
    if (!reason.trim() || !Number.isFinite(amount) || amount === 0) return;
    setBusy(userId);
    try {
      await ownerAdjustWallet({ data: { userId, amount, reason } });
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Users & wallets</h1>
      <p className="mt-1 text-xs text-white/45">Search · suspend · ledger adjustments</p>

      <div className="mt-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, @username, code"
          className="flex-1 rounded-xl border border-white/10 bg-[#12141c] px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-xl bg-amber-400 px-3 text-sm font-bold text-[#0a0c12]"
        >
          Search
        </button>
      </div>

      {msg ? <p className="mt-2 text-xs text-amber-200/80">{msg}</p> : null}

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/50">
            No users found.
          </p>
        ) : (
          rows.map((u) => (
            <div key={u.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.display_name ?? "Tasker"}</p>
                  <p className="text-[11px] text-white/40">
                    {u.username ? `@${u.username}` : u.id.slice(0, 8)}
                    {u.telegram_id != null ? ` · tg ${u.telegram_id}` : ""}
                  </p>
                </div>
                <span className="text-sm font-bold text-amber-300">
                  ${Number(u.balance ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy === u.id}
                  onClick={() => setStatus(u.id, "active")}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[10px]"
                >
                  Active
                </button>
                <button
                  type="button"
                  disabled={busy === u.id}
                  onClick={() => setStatus(u.id, "suspended")}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[10px]"
                >
                  Suspend
                </button>
                <button
                  type="button"
                  disabled={busy === u.id}
                  onClick={() => setStatus(u.id, "banned")}
                  className="rounded-lg border border-red-500/30 px-2 py-1 text-[10px] text-red-300"
                >
                  Ban
                </button>
                <button
                  type="button"
                  disabled={busy === u.id}
                  onClick={() => adjust(u.id)}
                  className="rounded-lg border border-amber-400/30 px-2 py-1 text-[10px] text-amber-300"
                >
                  Adjust $
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
