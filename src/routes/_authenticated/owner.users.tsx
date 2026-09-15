import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  Ban,
  ShieldOff,
  CheckCircle2,
  MinusCircle,
  PlusCircle,
  Loader2,
  User,
  ExternalLink,
} from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "banned">("all");
  const [msg, setMsg] = useState(initial.error);
  const [busy, setBusy] = useState<string | null>(null);
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjMode, setAdjMode] = useState<"add" | "deduct">("deduct");

  async function refresh(q?: string, st?: string) {
    setMsg(null);
    try {
      const next = await ownerListUsers({
        data: { search: q ?? search, status: (st ?? statusFilter) === "all" ? undefined : (st ?? statusFilter) },
      });
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
      setMsg(`User set to ${status}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitAdjust(userId: string) {
    const raw = Number(adjAmount);
    if (!Number.isFinite(raw) || raw <= 0) {
      setMsg("Enter a positive amount.");
      return;
    }
    if (!adjReason.trim()) {
      setMsg("Reason is required for ledger adjustments.");
      return;
    }
    const amount = adjMode === "deduct" ? -Math.abs(raw) : Math.abs(raw);
    setBusy(userId);
    try {
      await ownerAdjustWallet({ data: { userId, amount, reason: adjReason.trim() } });
      setAdjustFor(null);
      setAdjAmount("");
      setAdjReason("");
      await refresh();
      setMsg(
        amount < 0
          ? `Deducted $${Math.abs(amount).toFixed(2)} from user.`
          : `Added $${amount.toFixed(2)} to user.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const photoOf = (u: any) => u.photo_url || u.avatar_url || null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Users & wallets</h1>
      <p className="mt-1 text-xs text-white/45">
        Real Telegram photos · search · suspend · ban · adjust balance
      </p>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void refresh()}
            placeholder="Name, @username, TG id, referral"
            className="w-full rounded-xl border border-white/10 bg-[#12141c] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-400/40"
          />
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl bg-sky-400 px-4 text-sm font-bold text-[#0a0c12]"
        >
          Search
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(["all", "active", "suspended", "banned"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatusFilter(s);
              void refresh(search, s);
            }}
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
              statusFilter === s
                ? "bg-sky-400 text-[#0a0c12]"
                : "border border-white/10 bg-white/5 text-white/50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {msg ? (
        <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          {msg}
        </p>
      ) : null}

      <div className="mt-4 space-y-2.5">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-5 text-center text-sm text-white/50">
            No users found.
          </p>
        ) : (
          rows.map((u: any) => {
            const tgHandle = u.username ? `@${String(u.username).replace(/^@/, "")}` : null;
            const status = String(u.status ?? "active");
            const statusColor =
              status === "banned"
                ? "text-red-300 bg-red-500/15"
                : status === "suspended"
                  ? "text-amber-300 bg-amber-500/15"
                  : "text-emerald-300 bg-emerald-500/15";
            const photo = photoOf(u);
            const tgLink = u.username
              ? `https://t.me/${String(u.username).replace(/^@/, "")}`
              : u.telegram_id
                ? `tg://user?id=${u.telegram_id}`
                : null;

            return (
              <div key={u.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
                <div className="flex items-start gap-3">
                  {photo ? (
                    <img
                      src={String(photo)}
                      alt=""
                      className="size-12 shrink-0 rounded-full object-cover ring-2 ring-sky-400/25"
                    />
                  ) : (
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
                      <User className="size-5" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{u.display_name || "Tasker"}</p>
                        <p className="mt-0.5 truncate text-[11px] text-white/40">
                          {tgHandle ?? u.id.slice(0, 8)}
                          {u.telegram_id != null ? ` · TG ${u.telegram_id}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-300">
                          ${Number(u.balance ?? 0).toFixed(2)}
                        </p>
                        <span
                          className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusColor}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" disabled={busy === u.id} onClick={() => setStatus(u.id, "active")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-200">
                    <CheckCircle2 className="size-3" /> Active
                  </button>
                  <button type="button" disabled={busy === u.id} onClick={() => setStatus(u.id, "suspended")} className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/5 px-2.5 py-1.5 text-[10px] font-semibold text-amber-200">
                    <ShieldOff className="size-3" /> Suspend
                  </button>
                  <button type="button" disabled={busy === u.id} onClick={() => setStatus(u.id, "banned")} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-[10px] font-semibold text-red-300">
                    <Ban className="size-3" /> Ban
                  </button>
                  <button
                    type="button"
                    disabled={busy === u.id}
                    onClick={() => {
                      setAdjustFor(adjustFor === u.id ? null : u.id);
                      setAdjMode("deduct");
                      setAdjAmount("");
                      setAdjReason("");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-400/30 bg-sky-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-sky-200"
                  >
                    {adjustFor === u.id ? "Cancel" : "Adjust $"}
                  </button>
                  {tgLink ? (
                    <a href={tgLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-white/70">
                      <ExternalLink className="size-3" /> Telegram
                    </a>
                  ) : null}
                </div>

                {adjustFor === u.id ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAdjMode("deduct")} className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold ${adjMode === "deduct" ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/40" : "bg-white/5 text-white/50"}`}>
                        <MinusCircle className="size-3.5" /> Deduct
                      </button>
                      <button type="button" onClick={() => setAdjMode("add")} className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold ${adjMode === "add" ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40" : "bg-white/5 text-white/50"}`}>
                        <PlusCircle className="size-3.5" /> Add
                      </button>
                    </div>
                    <input type="number" min="0" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="Amount (USD)" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-400/40" />
                    <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason (required, audited)" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-400/40" />
                    <button type="button" disabled={busy === u.id} onClick={() => void submitAdjust(u.id)} className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold ${adjMode === "deduct" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
                      {busy === u.id ? <Loader2 className="size-4 animate-spin" /> : adjMode === "deduct" ? `Deduct $${Number(adjAmount || 0).toFixed(2)}` : `Add $${Number(adjAmount || 0).toFixed(2)}`}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
