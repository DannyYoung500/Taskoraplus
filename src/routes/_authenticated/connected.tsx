import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, ChevronRight, Link2, Shield, CheckCircle2 } from "lucide-react";
import { listConnectedAccounts, requestConnectAccount } from "@/lib/connected-accounts.functions";
import { CONNECTABLE_PLATFORMS } from "@/lib/taskora-data";
import {
  PlatformLogo,
  platformLabel,
  type Platform,
} from "@/components/PlatformIcon";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/connected")({
  loader: async () => {
    const accounts = await listConnectedAccounts().catch(() => []);
    return { accounts };
  },
  head: () => ({ meta: [{ title: "Connected — TASKORA" }] }),
  component: ConnectedPage,
});

function ConnectedPage() {
  const { accounts } = Route.useLoaderData();
  const [platform, setPlatform] = useState<Platform>(CONNECTABLE_PLATFORMS[0]!);
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(
    (accounts as Array<{ id: string; platform: string; handle: string; status: string }>).filter(
      (a) => a.platform !== "telegram",
    ),
  );

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const row = await requestConnectAccount({ data: { platform, handle } });
      setMsg("Saved · pending verification. Owner reviews before tasks unlock for this platform.");
      setHandle("");
      if (row && typeof row === "object" && "id" in row) {
        const r = row as { id: string; platform: string; handle: string; status: string };
        setList((prev) => {
          const rest = prev.filter((a) => a.platform !== r.platform);
          return [{ id: r.id, platform: r.platform, handle: r.handle, status: r.status }, ...rest];
        });
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <Link to="/profile" className="rounded-full border border-white/10 p-2 text-slate-400">
          <ChevronRight className="size-4 rotate-180" />
        </Link>
        <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full ring-2 ring-cyan-400/40" />
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-black tracking-[0.06em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Connected
          </p>
          <p className="text-[10px] text-slate-500">Real platform logos · Telegram is your identity</p>
        </div>
        <Link to="/notifications" className="rounded-full border border-white/10 bg-[#0b1628] p-2.5">
          <Bell className="size-4 text-slate-300" />
        </Link>
      </header>

      <section
        className="mb-3.5 overflow-hidden rounded-[22px] border border-cyan-400/25 p-4"
        style={{
          background:
            "radial-gradient(circle at 88% 12%,rgba(56,189,248,0.18),transparent 42%), linear-gradient(145deg,#0a1a33,#060f1c)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
            <Link2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Connect socials</p>
            <p className="text-[11px] text-slate-400">
              Link the accounts you use for tasks. Handles stay pending until verified.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-3.5 space-y-3 rounded-[20px] border border-cyan-400/15 bg-[#0b1628] p-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Platform
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CONNECTABLE_PLATFORMS.map((p) => {
              const active = platform === p;
              const name = platformLabel(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-cyan-400/45 bg-cyan-500/15 shadow-[0_0_20px_rgba(56,189,248,0.12)]"
                      : "border-white/8 bg-black/25 hover:border-white/15"
                  }`}
                >
                  <PlatformLogo platform={p} size={36} />
                  <span className={`text-[12px] font-bold ${active ? "text-cyan-50" : "text-slate-300"}`}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {platformLabel(platform)} handle
          </p>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder={`@username on ${platformLabel(platform)}`}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
          />
        </div>

        <button
          type="button"
          disabled={busy || !handle.trim()}
          onClick={() => void submit()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-50"
          style={{ background: BLUE_GRAD }}
        >
          {busy ? "Saving…" : `Save ${platformLabel(platform)} · pending verification`}
        </button>
        {msg ? (
          <p className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-100/90">
            {msg}
          </p>
        ) : null}
      </section>

      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black">Linked accounts</p>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200">
            {list.length}
          </span>
        </div>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-[#0b1628] p-6 text-center">
            <Link2 className="mx-auto size-7 text-slate-600" />
            <p className="mt-2 text-sm font-bold text-slate-300">No platforms linked</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Pick a platform above and add your handle.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((a) => {
              const name = platformLabel(a.platform as Platform);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#0b1628] px-3.5 py-3"
                >
                  <PlatformLogo platform={a.platform as Platform} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{a.handle}</p>
                    <p className="text-[11px] font-medium text-slate-400">{name}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      a.status === "verified"
                        ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : "border border-amber-400/25 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {a.status === "verified" ? <CheckCircle2 className="size-3" /> : null}
                    {a.status === "verified" ? "Verified" : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/15 bg-cyan-500/5 px-3.5 py-2.5 text-[11px] text-cyan-100/90">
        <Shield className="size-4 shrink-0 text-cyan-300" />
        Telegram remains your primary identity. Linked handles never auto-verify.
      </div>
    </main>
  );
}
