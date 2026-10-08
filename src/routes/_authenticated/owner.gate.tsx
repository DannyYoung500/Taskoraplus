import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2, Shield } from "lucide-react";
import {
  getTelegramGateSettings,
  saveTelegramGateSettings,
  testTelegramGateConnection,
  type TelegramGateSettings,
  type TelegramGateChat,
} from "@/lib/telegram-gate.functions";
import {
  ownerTestWithdrawalNotify,
  ownerTestNewUserNotify,
} from "@/lib/owner-notify-tests";

export const Route = createFileRoute("/_authenticated/owner/gate")({
  component: OwnerGate,
});

function OwnerGate() {
  const [gate, setGate] = useState<TelegramGateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [gateTest, setGateTest] = useState<{ ok: boolean; detail: string } | null>(null);
  const [chatIdInput, setChatIdInput] = useState("");
  const [chatUrlInput, setChatUrlInput] = useState("");
  const [chatNameInput, setChatNameInput] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const g = await getTelegramGateSettings().catch(() => null);
        if (g) {
          setGate({
            ...g,
            revokeOnLeave: g.revokeOnLeave ?? true,
            allowAdmins: g.allowAdmins ?? true,
            allowCreators: g.allowCreators ?? true,
            allowMembers: g.allowMembers ?? true,
            allowRestricted: g.allowRestricted ?? false,
            requiredChats: Array.isArray(g.requiredChats) ? g.requiredChats : [],
          });
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not load gate.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveGate() {
    if (!gate) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...gate,
        allowAdmins: gate.allowAdmins ?? true,
        allowCreators: gate.allowCreators ?? true,
        allowMembers: gate.allowMembers ?? true,
        allowRestricted: gate.allowRestricted ?? false,
        revokeOnLeave: gate.revokeOnLeave ?? true,
        requiredChats: Array.isArray(gate.requiredChats) ? gate.requiredChats : [],
      };
      const saved = await saveTelegramGateSettings({ data: payload });
      setGate({
        ...(saved as TelegramGateSettings),
        allowAdmins: (saved as any).allowAdmins ?? true,
        allowCreators: (saved as any).allowCreators ?? true,
        allowMembers: (saved as any).allowMembers ?? true,
        allowRestricted: (saved as any).allowRestricted ?? false,
        revokeOnLeave: true,
        requiredChats: Array.isArray((saved as any).requiredChats)
          ? (saved as any).requiredChats
          : payload.requiredChats,
      });
      setMessage(
        payload.enabled
          ? "✓ Gate saved & enabled — live for new sessions now."
          : "✓ Gate saved (disabled). Changes apply instantly.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save gate.");
    } finally {
      setSaving(false);
    }
  }

  async function runGateTest() {
    setSaving(true);
    setGateTest(null);
    try {
      const r = await testTelegramGateConnection();
      const detail = (r as any).checks
        ? ((r as any).checks as Array<{ name: string; ok: boolean; detail: string }>)
            .map((c) => `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`)
            .join(" · ")
        : (r as any).error || "Done";
      setGateTest({ ok: Boolean((r as any).ok), detail });
      setMessage((r as any).ok ? "Gate connection OK." : ((r as any).error || "Gate test failed."));
    } catch (e) {
      setGateTest({ ok: false, detail: e instanceof Error ? e.message : "Test failed" });
      setMessage(e instanceof Error ? e.message : "Gate test failed.");
    } finally {
      setSaving(false);
    }
  }

  function addRequiredChat() {
    if (!gate) return;
    const id = chatIdInput.trim();
    if (!id) {
      setMessage("Enter a channel/group ID or @username.");
      return;
    }
    const chat: TelegramGateChat = {
      id,
      type: gate.chatType || "channel",
      url: chatUrlInput.trim() || (id.startsWith("@") ? `https://t.me/${id.slice(1)}` : ""),
      name: chatNameInput.trim() || id,
    };
    setGate({ ...gate, requiredChats: [...(gate.requiredChats || []), chat] });
    setChatIdInput("");
    setChatUrlInput("");
    setChatNameInput("");
  }

  function removeRequiredChat(i: number) {
    if (!gate) return;
    setGate({ ...gate, requiredChats: gate.requiredChats.filter((_, idx) => idx !== i) });
  }

  async function testWithdrawNotify() {
    setNotifyBusy(true);
    setMessage("");
    try {
      await ownerTestWithdrawalNotify();
      setMessage("Test withdrawal notification sent (ops channel + owner DMs).");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Notify failed.");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function testNewUserNotify() {
    setNotifyBusy(true);
    setMessage("");
    try {
      await ownerTestNewUserNotify();
      setMessage("Test new-user notification sent (ops channel + owner DMs).");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Notify failed.");
    } finally {
      setNotifyBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="size-6 animate-spin text-sky-300" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[640px] bg-[#07152b] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner/settings" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">Owner</p>
          <h1 className="text-xl font-bold">Telegram Gate</h1>
          <p className="text-[11px] text-white/45">Require channel join before Mini App access</p>
        </div>
        {gate ? (
          <button
            type="button"
            onClick={() => setGate({ ...gate, enabled: !gate.enabled })}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${gate.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"}`}
          >
            {gate.enabled ? "ENABLED" : "DISABLED"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/70">{message}</p>
      ) : null}

      {!gate ? (
        <p className="rounded-2xl bg-amber-500/10 px-3 py-3 text-center text-xs text-amber-200">Could not load gate settings.</p>
      ) : (
        <section className="space-y-3">
          <div className="space-y-2.5 rounded-3xl border border-white/8 bg-[#12141c] p-4">
            <Toggle label="Enable gate (block non-members)" on={gate.enabled} onChange={(v) => setGate({ ...gate, enabled: v })} />
            <Toggle label="Revoke access if user leaves" on={!!gate.revokeOnLeave} onChange={(v) => setGate({ ...gate, revokeOnLeave: v })} />
            <Toggle label="Allow channel admins" on={!!gate.allowAdmins} onChange={(v) => setGate({ ...gate, allowAdmins: v })} />
            <Toggle label="Allow creators" on={!!gate.allowCreators} onChange={(v) => setGate({ ...gate, allowCreators: v })} />
            <Toggle label="Allow members" on={!!gate.allowMembers} onChange={(v) => setGate({ ...gate, allowMembers: v })} />
            <Toggle label="Allow restricted" on={!!gate.allowRestricted} onChange={(v) => setGate({ ...gate, allowRestricted: v })} danger />
            <NumField label="Re-check interval (seconds)" value={gate.checkIntervalSeconds || 30} onChange={(v) => setGate({ ...gate, checkIntervalSeconds: Math.max(10, Math.floor(v)) })} />
          </div>

          <div className="space-y-2 rounded-3xl border border-white/8 bg-[#12141c] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Screen copy</p>
            <label className="block text-[11px] text-white/50">Title
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none" value={gate.title} onChange={(e) => setGate({ ...gate, title: e.target.value })} />
            </label>
            <label className="block text-[11px] text-white/50">Description
              <textarea className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none" rows={2} value={gate.description} onChange={(e) => setGate({ ...gate, description: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-white/50">Join button
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none" value={gate.joinButtonText} onChange={(e) => setGate({ ...gate, joinButtonText: e.target.value })} />
              </label>
              <label className="block text-[11px] text-white/50">Continue button
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none" value={gate.checkButtonText} onChange={(e) => setGate({ ...gate, checkButtonText: e.target.value })} />
              </label>
            </div>
            <label className="block text-[11px] text-white/50">Success message
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none" value={gate.successMessage} onChange={(e) => setGate({ ...gate, successMessage: e.target.value })} />
            </label>
            <label className="block text-[11px] text-white/50">Failure message
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none" value={gate.failureMessage} onChange={(e) => setGate({ ...gate, failureMessage: e.target.value })} />
            </label>
          </div>

          <div className="space-y-2 rounded-3xl border border-white/8 bg-[#12141c] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Required chats ({gate.requiredChats?.length ?? 0})</p>
            {(gate.requiredChats ?? []).length === 0 ? (
              <p className="text-[11px] text-white/40">No chats yet. Add a channel/group below.</p>
            ) : (
              <ul className="space-y-2">
                {gate.requiredChats.map((c, i) => (
                  <li key={`${c.id}-${i}`} className="flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{c.name || c.id}</p>
                      <p className="truncate text-[10px] text-white/40">{c.id} · {c.type}</p>
                    </div>
                    <button type="button" onClick={() => removeRequiredChat(i)} className="text-[11px] font-bold text-red-300">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 space-y-2 border-t border-white/8 pt-3">
              <input placeholder="@channel or -100… ID" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none" value={chatIdInput} onChange={(e) => setChatIdInput(e.target.value)} />
              <input placeholder="https://t.me/…" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none" value={chatUrlInput} onChange={(e) => setChatUrlInput(e.target.value)} />
              <input placeholder="Display name" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none" value={chatNameInput} onChange={(e) => setChatNameInput(e.target.value)} />
              <button type="button" onClick={addRequiredChat} className="w-full rounded-xl border border-sky-400/30 bg-sky-500/10 py-2.5 text-xs font-bold text-sky-200">Add required chat</button>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => void saveGate()} className="flex-1 rounded-xl bg-sky-400 py-3 text-xs font-bold text-[#05070c] disabled:opacity-50">
              {saving ? "Saving…" : "Save gate"}
            </button>
            <button type="button" disabled={saving} onClick={() => void runGateTest()} className="rounded-xl border border-white/15 px-4 py-3 text-xs font-bold text-white/80 disabled:opacity-50">
              Test
            </button>
          </div>
          {gateTest ? (
            <p className={`rounded-xl px-3 py-2 text-[11px] ${gateTest.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>{gateTest.detail}</p>
          ) : null}

          <div className="space-y-2 rounded-3xl border border-amber-400/20 bg-[#12141c] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200/80">Notification tests</p>
            <p className="text-[11px] text-white/40">Sends to private ops channel + owner Telegram IDs.</p>
            <button type="button" disabled={notifyBusy} onClick={() => void testWithdrawNotify()} className="w-full rounded-xl border border-amber-400/30 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-100 disabled:opacity-50">
              {notifyBusy ? "Sending…" : "Test withdrawal notification"}
            </button>
            <button type="button" disabled={notifyBusy} onClick={() => void testNewUserNotify()} className="w-full rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-100 disabled:opacity-50">
              {notifyBusy ? "Sending…" : "Test new-user notification"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-white/55">
      <span className="min-w-0 flex-1">{label}</span>
      <input type="number" step="any" className="w-24 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-right text-sm font-semibold text-white outline-none focus:border-sky-400/40" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Toggle({ label, on, onChange, danger }: { label: string; on: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 py-1.5 text-left">
      <span className={`text-xs ${danger && on ? "text-red-300" : "text-white/80"}`}>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? (danger ? "bg-red-500" : "bg-sky-500") : "bg-white/15"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
