import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  getTelegramGateSettings,
  saveTelegramGateSettings,
  previewTelegramGateChats,
  testTelegramGateConnection,
  getTelegramGateAnalytics,
  type TelegramGateSettings,
  type TelegramGateChat,
} from "@/lib/telegram-gate.functions";

export const Route = createFileRoute("/_authenticated/owner/settings")({
  component: OwnerSettings,
});

function blankChat(type: "channel" | "group"): TelegramGateChat {
  return {
    id: "",
    type,
    url: "",
    name: type === "channel" ? "Telegram Channel" : "Telegram Group",
    verified: false,
    photoUrl: null,
    botIsAdmin: null,
    username: null,
    memberCount: null,
    description: null,
    error: null,
  };
}

function OwnerSettings() {
  const [gate, setGate] = useState<TelegramGateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [analytics, setAnalytics] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      try {
        const g = await getTelegramGateSettings();
        setGate({
          ...g,
          revokeOnLeave: true,
          requiredChats: Array.isArray(g.requiredChats) ? g.requiredChats : [],
        });
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not load settings.");
      } finally {
        setLoading(false);
      }
      try {
        setAnalytics(await getTelegramGateAnalytics());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function updateChat(index: number, patch: Partial<TelegramGateChat>) {
    setGate((g) => {
      if (!g) return g;
      const next = g.requiredChats.map((c, n) =>
        n === index ? { ...c, ...patch, verified: patch.verified ?? false } : c,
      );
      return { ...g, requiredChats: next };
    });
  }

  function addChat(type: "channel" | "group") {
    setGate((g) => {
      if (!g) {
        return {
          enabled: false,
          chatType: type,
          channelId: "",
          channelUrl: "",
          channelName: "TASKORA Community",
          title: "JOIN OUR CHANNELS",
          description: "Join every required TASKORA Telegram community to unlock the Mini App.",
          joinButtonText: "JOIN",
          checkButtonText: "CONTINUE",
          successMessage: "Your TASKORA access has been unlocked.",
          failureMessage: "Join every required community and try again.",
          checkIntervalSeconds: 30,
          revokeOnLeave: true,
          allowAdmins: true,
          allowCreators: true,
          allowMembers: true,
          allowRestricted: false,
          requiredChats: [blankChat(type)],
        };
      }
      return {
        ...g,
        requiredChats: [...(g.requiredChats ?? []), blankChat(type)],
      };
    });
    setMessage("");
  }

  function removeChat(index: number) {
    if (!window.confirm("Remove this community from the gate?")) return;
    setGate((g) => {
      if (!g) return g;
      return {
        ...g,
        requiredChats: g.requiredChats.filter((_, n) => n !== index),
      };
    });
  }

  async function preview() {
    if (!gate) return;
    const filled = gate.requiredChats.filter((c) => String(c.id ?? "").trim());
    if (!filled.length) {
      setMessage("Enter at least one Chat ID or @username before verifying.");
      return;
    }
    setPreviewing(true);
    setMessage("");
    try {
      const chats = await previewTelegramGateChats({
        data: { chats: gate.requiredChats },
      });
      setGate((g) => (g ? { ...g, requiredChats: chats } : g));
      const ok = chats.every((c) => c.verified && c.botIsAdmin !== false);
      const partial = chats.some((c) => c.verified);
      if (ok) {
        setMessage("✓ All chats verified. Real photos, names and member counts loaded.");
      } else if (partial) {
        setMessage(
          "Some chats verified. Fix any that show errors (bot must be admin, correct ID).",
        );
      } else {
        setMessage(
          "Could not verify chats. Check bot token, chat IDs, and that the bot is an administrator.",
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setMessage("");
    try {
      const r = await testTelegramGateConnection();
      setTestResult(r);
      setMessage(r.ok ? "✓ All gates healthy." : r.error ?? "One or more checks failed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!gate) return;
    if (gate.enabled && !gate.requiredChats.filter((c) => c.id.trim()).length) {
      setMessage("Add at least one required Telegram channel/group before enabling the gate.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveTelegramGateSettings({
        data: {
          ...gate,
          revokeOnLeave: true,
          allowAdmins: true,
          allowCreators: true,
          allowMembers: true,
          allowRestricted: false,
        },
      });
      setGate(saved);
      setMessage(
        "✓ Saved. Every listed Telegram chat is required — leaving any one locks TASKORA.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  const statusLabel = !gate
    ? "LOADING"
    : !gate.enabled
      ? "DISABLED"
      : gate.requiredChats.some((c) => c.verified && c.botIsAdmin === false)
        ? "NEEDS ATTENTION"
        : gate.requiredChats.length && gate.requiredChats.every((c) => c.verified)
          ? "ACTIVE"
          : "NEEDS SETUP";

  const statusColor =
    statusLabel === "ACTIVE"
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
      : statusLabel === "DISABLED"
        ? "text-white/50 border-white/10 bg-white/5"
        : "text-amber-300 border-amber-400/30 bg-amber-400/10";

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="size-6 animate-spin text-sky-300" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">System</p>
          <h1 className="text-xl font-bold">Telegram Gate</h1>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <section className="rounded-3xl border border-blue-400/15 bg-[#12141c] p-4">
        <div className="flex gap-3">
          <ShieldCheck className="size-5 shrink-0 text-emerald-300" />
          <div>
            <p className="text-sm font-bold">Strict multi-community gate</p>
            <p className="mt-1 text-[11px] leading-5 text-white/45">
              Users must be members of every listed channel/group. Real Telegram photos and
              usernames load via Bot API. No whitelist or bypass.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-amber-300/15 bg-[#12141c] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Gate enforcement</h2>
            <p className="mt-1 text-[11px] text-white/40">Leave one required chat → access locks.</p>
          </div>
          <button
            type="button"
            disabled={!gate}
            onClick={() => gate && setGate({ ...gate, enabled: !gate.enabled })}
            className={`relative h-7 w-12 rounded-full transition ${
              gate?.enabled ? "bg-amber-400" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-1 size-5 rounded-full bg-white transition ${
                gate?.enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-[#12141c] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Required communities</h2>
            <p className="mt-1 text-[11px] text-white/40">
              Add channel, group, or both. Real photos after Verify.
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => addChat("channel")}
              className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-2.5 py-2 text-[10px] font-bold text-sky-200"
            >
              <Plus className="mr-0.5 inline size-3" />
              Channel
            </button>
            <button
              type="button"
              onClick={() => addChat("group")}
              className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-2.5 py-2 text-[10px] font-bold text-sky-200"
            >
              <Plus className="mr-0.5 inline size-3" />
              Group
            </button>
          </div>
        </div>

        {(gate?.requiredChats ?? []).length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-5 text-center text-[11px] text-white/35">
            No required chat yet. Tap Channel or Group to add one.
          </div>
        ) : (
          (gate?.requiredChats ?? []).map((c, i) => (
            <div
              key={`chat-${i}`}
              className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3"
            >
              <div className="flex items-start gap-3">
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-full object-cover ring-2 ring-sky-400/30"
                  />
                ) : (
                  <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-300">
                    {c.type === "channel" ? "📢" : "👥"}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-white/50">
                      {c.type === "channel" ? "Channel" : "Group"} #{i + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeChat(i)}
                      className="rounded-lg p-1.5 text-red-300/70 hover:bg-red-500/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {c.verified ? (
                    <div className="mt-1">
                      <p className="truncate text-sm font-bold">{c.name}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {c.username ? `@${String(c.username).replace(/^@/, "")}` : c.id}
                        {c.memberCount != null
                          ? ` · ${Number(c.memberCount).toLocaleString()} members`
                          : ""}
                      </p>
                      {c.botIsAdmin === false ? (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-300">
                          <AlertTriangle className="size-3" />
                          Bot is not admin — membership checks will fail
                        </p>
                      ) : c.botIsAdmin ? (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-300">
                          <CheckCircle2 className="size-3" />
                          Verified · bot is admin
                        </p>
                      ) : null}
                      {c.description ? (
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/35">
                          {c.description}
                        </p>
                      ) : null}
                      {c.error ? (
                        <p className="mt-1 text-[10px] text-red-300">{c.error}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-white/35">
                      Enter ID below, then press Verify
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Field
                  label="Chat ID or @username"
                  value={c.id}
                  onChange={(v) => updateChat(i, { id: v, verified: false, photoUrl: null })}
                  placeholder="@taskora_official or -100…"
                />
                <Field
                  label="Join URL (optional)"
                  value={c.url}
                  onChange={(v) => updateChat(i, { url: v })}
                  placeholder="https://t.me/…"
                />
              </div>
            </div>
          ))
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={previewing || !(gate?.requiredChats?.length)}
            onClick={() => void preview()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-blue-400/25 bg-blue-400/10 px-3 py-3 text-xs font-bold text-blue-200 disabled:opacity-40"
          >
            <RefreshCw className={`size-4 ${previewing ? "animate-spin" : ""}`} />
            {previewing ? "Loading…" : "VERIFY & LOAD PREVIEW"}
          </button>
          <button
            type="button"
            disabled={testing}
            onClick={() => void runTest()}
            className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-xs font-bold text-white/70 disabled:opacity-40"
          >
            {testing ? "…" : "TEST ALL"}
          </button>
        </div>

        {testResult?.checks ? (
          <div className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-black/20 p-3">
            {testResult.checks.map((ch: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-[11px]">
                {ch.ok ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="size-3.5 text-amber-300" />
                )}
                <span className="font-semibold">{ch.name}</span>
                <span className="text-white/40">— {ch.detail}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-[#12141c] p-4">
        <h2 className="text-base font-bold">Gate screen copy</h2>
        {gate ? (
          <div className="mt-3 space-y-3">
            <Field
              label="Title"
              value={gate.title}
              onChange={(v) => setGate({ ...gate, title: v })}
              placeholder="JOIN OUR CHANNELS"
            />
            <Field
              label="Description"
              value={gate.description}
              onChange={(v) => setGate({ ...gate, description: v })}
              multiline
            />
            <Field
              label="Join button"
              value={gate.joinButtonText}
              onChange={(v) => setGate({ ...gate, joinButtonText: v })}
            />
            <Field
              label="Continue / Check button"
              value={gate.checkButtonText}
              onChange={(v) => setGate({ ...gate, checkButtonText: v })}
            />
          </div>
        ) : null}
      </section>

      {analytics ? (
        <section className="mt-4 grid grid-cols-4 gap-1.5 text-center">
          {(
            [
              ["Checks", analytics.total],
              ["OK", analytics.verified],
              ["Denied", analytics.notMember],
              ["Rate", `${analytics.successRate}%`],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="rounded-xl border border-white/8 bg-[#12141c] px-1 py-2">
              <p className="text-[9px] uppercase text-white/40">{l}</p>
              <p className="text-sm font-bold text-amber-300">{v}</p>
            </div>
          ))}
        </section>
      ) : null}

      <button
        type="button"
        disabled={saving || !gate}
        onClick={() => void save()}
        className="mt-4 w-full rounded-2xl bg-sky-400 px-4 py-3.5 text-sm font-extrabold text-[#05070c] disabled:opacity-50"
      >
        {saving ? "SAVING…" : "SAVE TELEGRAM GATE"}
      </button>

      {message ? (
        <p className="mt-3 text-center text-xs leading-relaxed text-white/60">{message}</p>
      ) : null}

      <Link
        to="/owner/monetization"
        className="mt-4 block rounded-2xl border border-blue-400/15 bg-blue-400/5 p-4"
      >
        <p className="text-sm font-bold text-blue-200">Provider Control Center →</p>
        <p className="mt-1 text-[10px] text-white/40">
          API keys, webhooks, reward shares for every provider.
        </p>
      </Link>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40";
  return (
    <label className="block text-xs text-white/55">
      {label}
      {multiline ? (
        <textarea
          className={cls}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={cls}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
