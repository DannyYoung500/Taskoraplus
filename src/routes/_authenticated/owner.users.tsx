import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
  Filter,
  Wallet,
  MessageCircle,
} from "lucide-react";
import { ownerListUsers, ownerAdjustWallet } from "@/lib/owner.functions";
import { ownerSetUserStatus } from "@/lib/owner-user-status.functions";

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

type UserRow = Awaited<ReturnType<typeof ownerListUsers>>[number];

function photoOf(u: UserRow): string | null {
  const p = (u as { photo_url?: string | null }).photo_url;
  if (p && typeof p === "string" && p.length > 4) return p;
  const a = (u as { avatar_url?: string | null }).avatar_url;
  return a && typeof a === "string" ? a : null;
}

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

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => String(r.status ?? "active") === "active").length;
    const suspended = rows.filter((r) => String(r.status) === "suspended").length;
    const banned = rows.filter((r) => String(r.status) === "banned").length;
    const totalBal = rows.reduce((s, r) => s + Number(r.balance ?? 0), 0);
    return { total, active, suspended, banned, totalBal };
  }, [rows]);

  async function refresh(q?: string, status?: string) {
    setMsg(null);
    try {
      const next = await ownerListUsers({
        data: {
          search: q ?? search,
          status: (status ?? statusFilter) === "all" ? undefined : (status ?? statusFilter),
        },
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
      const label =
        status === "active"
          ? "Unbanned / activated"
          : status === "suspended"
            ? "Suspended"
            : "Banned";
      setMsg(`User ${label}.`);
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
      setMsg("Reason required.");
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
      setMsg(amount < 0 ? `Deducted $${Math.abs(amount).toFixed(2)}.` : `Added $${amount.toFixed(2)}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Users & wallets</h1>
      <p className="mt-1 text-xs text-white/45">
        Real photos · Unban / Unsuspend · Ban · Adjust balance · Owners protected
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { label: "Users", value: stats.total, color: "text-white" },
          { label: "Active", value: stats.active, color: "text-emerald-300" },
          { label: "Suspended", value: stats.suspended, color: "text-amber-300" },
          { label: "Banned", value: stats.banned, color: "text-red-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/8 bg-[#12141c] px-2 py-2 text-center">
            <p className={`text-sm font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[9px] uppercase tracking-wide text-white/35">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void refresh()}
            placeholder="Name, @username, referral, TG id"
            className="w-full rounded-xl border border-white/10 bg-[#12141c] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-400/40"
          />
        </div>
        <button type="button" onClick={() => void refresh()} className="rounded-xl bg-sky-400 px-4 text-sm font-bold text-[#0a0c12]">
          Search
        </button>
      </div>

      <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
        {(["all", "active", "suspended", "banned"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatusFilter(key);
              void refresh(search, key);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              statusFilter === key ? "bg-sky-400 text-[#0a0c12]" : "border border-white/10 bg-white/5 text-white/55"
            }`}
          >
            <Filter className="mr-1 inline size-3" />
            {key}
          </button>
        ))}
      </div>

      {msg ? (
        <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">{msg}</p>
      ) : null}

      <div className="mt-4 space-y-2.5">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-5 text-center text-sm text-white/50">No users found.</p>
        ) : (
          rows.map((u) => {
            const photo = photoOf(u);
            const tgHandle = u.username ? `@${String(u.username).replace(/^@/, "")}` : null;
            const status = String(u.status ?? "active");
            const statusColor =
              status === "banned"
                ? "text-red-300 bg-red-500/15"
                : status === "suspended"
                  ? "text-amber-300 bg-amber-500/15"
                  : "text-emerald-300 bg-emerald-500/15";
            const tgId = u.telegram_id != null ? Number(u.telegram_id) : null;
            const tgLink =
              tgHandle != null
                ? `https://t.me/${String(u.username).replace(/^@/, "")}`
                : tgId != null
                  ? `tg://user?id=${tgId}`
                  : null;

            return (
              <div key={u.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
                <div className="flex items-start gap-3">
                  {photo ? (
                    <img src={photo} alt="" className="size-12 shrink-0 rounded-full object-cover ring-2 ring-sky-400/30" />
                  ) : (
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-300 ring-2 ring-sky-400/15">
                      <User className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{u.display_name || "Tasker"}</p>
                        <p className="mt-0.5 truncate text-[11px] text-white/40">
                          {tgHandle ?? u.id.slice(0, 8)}
                          {tgId != null ? ` · TG ${tgId}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="inline-flex items-center gap-1 text-sm font-bold text-amber-300">
                          <Wallet className="size-3.5 opacity-70" />
                          ${Number(u.balance ?? 0).toFixed(2)}
                        </p>
                        <span className={`mt-0.5 block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusColor}`}>{status}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy === u.id || status === "active"}
                    onClick={() => void setStatus(u.id, "active")}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-200 disabled:opacity-40"
                  >
                    <CheckCircle2 className="size-3" />
                    {status === "banned" ? "Unban" : status === "suspended" ? "Unsuspend" : "Active"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === u.id || status === "suspended"}
                    onClick={() => void setStatus(u.id, "suspended")}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/5 px-2.5 py-1.5 text-[10px] font-semibold text-amber-200 disabled:opacity-40"
                  >
                    <ShieldOff className="size-3" /> Suspend
                  </button>
                  <button
                    type="button"
                    disabled={busy === u.id || status === "banned"}
                    onClick={() => void setStatus(u.id, "banned")}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-[10px] font-semibold text-red-300 disabled:opacity-40"
                  >
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
                    <a href={tgLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-white/70">
                      <MessageCircle className="size-3" /> Telegram
                      <ExternalLink className="size-2.5 opacity-60" />
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
