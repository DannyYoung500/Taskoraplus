import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  ChevronRight,
  Shield,
  CheckCircle2,
  Copy,
  Gamepad2,
  X,
  ArrowRight,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  beginDiscordConnect,
  disconnectConnectedAccount,
  getConnectedVerificationInfo,
  listConnectedAccounts,
  reconnectPublicProfile,
  startPublicProfileVerification,
  verifyPublicProfile,
  verifyYouTubeChannel,
} from "@/lib/connected-accounts.functions";
import { CONNECTABLE_PLATFORMS } from "@/lib/taskora-data";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { TASKORA_LOGO, ACCENT_GRAD } from "@/lib/brand";

const BIO_LABEL: Record<string, string> = {
  instagram: "Bio",
  tiktok: "Bio",
  x: "Bio",
  facebook: "Bio",
  linkedin: "About",
  reddit: "Profile/About",
  twitch: "Bio",
  threads: "Bio",
  pinterest: "About",
  github: "Bio",
};
const BIO_PLATFORMS = new Set([
  "x",
  "tiktok",
  "instagram",
  "facebook",
  "reddit",
  "linkedin",
  "twitch",
  "threads",
  "pinterest",
  "github",
]);

export const Route = createFileRoute("/_authenticated/connected")({
  loader: async () => {
    const [accounts, verification] = await Promise.all([
      listConnectedAccounts().catch(() => []),
      getConnectedVerificationInfo().catch(() => ({ referralLink: "", message: "" })),
    ]);
    return { accounts, verification };
  },
  head: () => ({ meta: [{ title: "Connected — TASKORA" }] }),
  component: ConnectedPage,
});

function ConnectedPage() {
  const initial = Route.useLoaderData();
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accounts, setAccounts] = useState<any[]>(
    initial.accounts.filter((a: any) => a.platform !== "telegram"),
  );
  const [wizard, setWizard] = useState<{
    token: string;
    message: string;
    profileUrl: string;
    step: number;
  } | null>(null);

  const verify = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const row =
        platform === "youtube"
          ? await verifyYouTubeChannel({ data: { channelUrl: value } })
          : await verifyPublicProfile({
              data: { platform, profileUrl: value || wizard?.profileUrl || "", token: wizard?.token || "" },
            });
      setAccounts((p) => [row, ...p.filter((a) => a.platform !== platform)]);
      setValue("");
      setWizard(null);
      setMsg("Account verified and connected.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await startPublicProfileVerification({
        data: { platform, profileUrl: value.trim() },
      });
      setWizard({ token: r.token, message: r.message, profileUrl: r.profileUrl, step: 1 });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not generate verification message.");
    } finally {
      setBusy(false);
    }
  };

  const discord = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await beginDiscordConnect();
      window.location.assign(r.url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Discord connection failed.");
      setBusy(false);
    }
  };

  const onDelete = async (accountId: string, plat: string) => {
    if (!confirm(`Remove ${platformLabel(plat as Platform)} from connected accounts?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await disconnectConnectedAccount({ data: { accountId } });
      setAccounts((p) => p.filter((a) => a.id !== accountId));
      setMsg("Account removed. You can connect it again anytime.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not remove account.");
    } finally {
      setBusy(false);
    }
  };

  const onReconnect = async (a: any) => {
    setBusy(true);
    setMsg(null);
    setPlatform(a.platform as Platform);
    try {
      if (a.platform === "discord") {
        await discord();
        return;
      }
      if (a.platform === "youtube") {
        setValue(a.profile_url || "");
        setMsg("Paste or confirm your YouTube channel URL, then tap Verify.");
        setBusy(false);
        return;
      }
      if (BIO_PLATFORMS.has(String(a.platform))) {
        const r = await reconnectPublicProfile({
          data: { platform: a.platform, profileUrl: a.profile_url || undefined },
        });
        setValue(r.profileUrl);
        setWizard({ token: r.token, message: r.message, profileUrl: r.profileUrl, step: 1 });
        setMsg("New verification message generated. Complete the steps to reconnect.");
      } else {
        setMsg("Use the form below to reconnect this platform.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not start reconnect.");
    } finally {
      setBusy(false);
    }
  };

  const Wizard = wizard ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#121212] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[15px] font-medium text-neutral-50">Verify {platformLabel(platform)}</p>
            <p className="mt-0.5 text-[11px] font-normal text-neutral-500">
              Step {wizard.step} of 4 · paste message in {BIO_LABEL[platform] || "Bio / About"}
            </p>
          </div>
          <button type="button" onClick={() => setWizard(null)} className="p-2 text-neutral-400">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-5">
          <div className="mb-5 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: wizard.step * 25 + "%" }} />
          </div>
          {wizard.step === 1 ? (
            <div>
              <p className="text-[16px] font-medium text-neutral-50">1. Copy your message</p>
              <p className="mt-2 text-[13px] font-normal leading-relaxed text-neutral-400">
                Paste this exact message into your public {BIO_LABEL[platform] || "Bio"}. Do not edit the link.
              </p>
              <div className="mt-4 rounded-xl bg-[#0a0a0a] p-4 text-[12px] font-normal leading-relaxed text-neutral-200 whitespace-pre-wrap">{wizard.message}</div>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(wizard.message); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-medium text-white" style={{ background: ACCENT_GRAD }}>
                {copied ? (<><CheckCircle2 className="size-4" strokeWidth={1.75} /> Copied</>) : (<><Copy className="size-4" strokeWidth={1.75} /> Copy message</>)}
              </button>
            </div>
          ) : null}
          {wizard.step === 2 ? (
            <div>
              <p className="text-[16px] font-medium text-neutral-50">2. Open your profile</p>
              <p className="mt-2 text-[13px] font-normal leading-relaxed text-neutral-400">
                Open your public {platformLabel(platform)} profile and edit <span className="text-neutral-100">{BIO_LABEL[platform] || "Bio / About"}</span>.
              </p>
              <div className="mt-4 rounded-xl bg-[#0a0a0a] p-4">
                <p className="text-[12px] font-medium text-neutral-300">Same profile URL</p>
                <p className="mt-1 break-all text-[11px] font-normal text-neutral-500">{wizard.profileUrl}</p>
              </div>
            </div>
          ) : null}
          {wizard.step === 3 ? (
            <div>
              <p className="text-[16px] font-medium text-neutral-50">3. Paste it publicly</p>
              <p className="mt-2 text-[13px] font-normal leading-relaxed text-neutral-400">
                Paste the complete message into your public <span className="text-neutral-100">{BIO_LABEL[platform] || "Bio"}</span> and save.
              </p>
              <div className="mt-4 space-y-1.5 rounded-xl bg-amber-500/10 p-4 text-[12px] font-normal text-amber-100/90">
                <p>· Do not edit the verification link</p>
                <p>· Not private posts or DMs — public bio/about only</p>
                <p>· Profile must be publicly accessible</p>
              </div>
            </div>
          ) : null}
          {wizard.step === 4 ? (
            <div>
              <p className="text-[16px] font-medium text-neutral-50">4. Return and verify</p>
              <p className="mt-2 text-[13px] font-normal leading-relaxed text-neutral-400">
                Taskora checks your public page for the unique token and the required TASKORA phrase.
              </p>
            </div>
          ) : null}
          <div className="mt-5 flex gap-2">
            {wizard.step > 1 ? (
              <button type="button" onClick={() => setWizard((w) => (w ? { ...w, step: w.step - 1 } : w))} className="flex-1 rounded-2xl bg-[#1a1a1a] py-3.5 text-[13px] font-medium text-neutral-300">Back</button>
            ) : null}
            {wizard.step < 4 ? (
              <button type="button" onClick={() => setWizard((w) => (w ? { ...w, step: w.step + 1 } : w))} className="flex-1 rounded-2xl py-3.5 text-[13px] font-medium text-white" style={{ background: ACCENT_GRAD }}>Next <ArrowRight className="ml-1 inline size-3.5" strokeWidth={1.75} /></button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void verify()} className="flex-1 rounded-2xl py-3.5 text-[13px] font-medium text-white disabled:opacity-50" style={{ background: ACCENT_GRAD }}>{busy ? "Checking bio…" : "Verify my profile"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      {Wizard}
      <header className="mb-4 flex items-center gap-2.5">
        <Link to="/profile" className="p-2 text-neutral-400"><ChevronRight className="size-5 rotate-180" strokeWidth={1.75} /></Link>
        <img src={TASKORA_LOGO} alt="TASKORA" className="size-8 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-50">Connected accounts</p>
          <p className="text-[10px] font-normal text-neutral-500">Verify via public bio · required message</p>
        </div>
        <Link to="/notifications" className="p-2 text-neutral-400"><Bell className="size-5" strokeWidth={1.75} /></Link>
      </header>

      <section className="mb-3.5 rounded-2xl bg-[#121212] p-4">
        <p className="text-[13px] font-medium text-neutral-100">How verification works</p>
        <p className="mt-1 text-[12px] font-normal leading-relaxed text-neutral-500">
          Taskora creates a unique message. You paste it in your public bio/about. We check the live page for that message and token — then mark the account verified.
        </p>
      </section>

      <section className="mb-3.5 rounded-2xl bg-[#121212] p-4">
        <p className="mb-2 text-[11px] font-normal text-neutral-500">Platform</p>
        <div className="grid grid-cols-2 gap-2">
          {CONNECTABLE_PLATFORMS.map((p) => (
            <button key={p} type="button" onClick={() => { setPlatform(p); setValue(""); setWizard(null); setMsg(null); }} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${platform === p ? "bg-orange-500/15" : "bg-[#0a0a0a]"}`}>
              <PlatformLogo platform={p} size={32} />
              <span className="text-[12px] font-medium text-neutral-100">{platformLabel(p)}</span>
            </button>
          ))}
        </div>
      </section>

      {platform === "discord" ? (
        <section className="mb-3.5 rounded-2xl bg-[#121212] p-4">
          <p className="text-[14px] font-medium text-neutral-50">Connect Discord</p>
          <p className="mt-1 text-[12px] font-normal text-neutral-500">OAuth only — you do not type a username.</p>
          <button type="button" onClick={() => void discord()} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-medium text-white disabled:opacity-50" style={{ background: ACCENT_GRAD }}>
            <Gamepad2 className="size-4" strokeWidth={1.75} />{busy ? "Opening…" : "Connect Discord"}
          </button>
        </section>
      ) : platform === "youtube" ? (
        <section className="mb-3.5 rounded-2xl bg-[#121212] p-4">
          <p className="text-[14px] font-medium text-neutral-50">Connect YouTube</p>
          <p className="mt-1 text-[12px] font-normal text-neutral-500">Public channel URL. Verified via YouTube API.</p>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://youtube.com/@yourchannel" className="mt-3 w-full rounded-xl bg-[#0a0a0a] px-4 py-3 text-[13px] font-normal outline-none focus:ring-1 focus:ring-orange-400/30" />
          <button type="button" onClick={() => void verify()} disabled={busy || !value.trim()} className="mt-2.5 w-full rounded-2xl py-3.5 text-[13px] font-medium text-white disabled:opacity-50" style={{ background: ACCENT_GRAD }}>{busy ? "Verifying…" : "Verify YouTube channel"}</button>
        </section>
      ) : (
        <section className="mb-3.5 rounded-2xl bg-[#121212] p-4">
          <p className="text-[14px] font-medium text-neutral-50">Connect {platformLabel(platform)}</p>
          <p className="mt-1 text-[12px] font-normal leading-relaxed text-neutral-500">
            Public profile URL → generate message → paste in <span className="text-neutral-300">{BIO_LABEL[platform] || "Bio"}</span> → we verify.
          </p>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://github.com/username or https://pinterest.com/username" className="mt-3 w-full rounded-xl bg-[#0a0a0a] px-4 py-3 text-[13px] font-normal outline-none focus:ring-1 focus:ring-orange-400/30" />
          <button type="button" onClick={() => void generate()} disabled={busy || !value.trim()} className="mt-2.5 w-full rounded-2xl py-3.5 text-[13px] font-medium text-white disabled:opacity-50" style={{ background: ACCENT_GRAD }}>{busy ? "Generating…" : "Generate verification message"}</button>
        </section>
      )}

      {msg ? <p className="mb-3 rounded-2xl bg-orange-500/10 px-3.5 py-3 text-[12px] font-normal text-orange-200">{msg}</p> : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-neutral-200">Connected</p>
          <span className="text-[11px] font-normal text-neutral-500">{accounts.length}</span>
        </div>
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <div className="rounded-2xl bg-[#121212] p-6 text-center text-[13px] font-normal text-neutral-500">No accounts connected yet.</div>
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="rounded-2xl bg-[#121212] px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <PlatformLogo platform={a.platform as Platform} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-100">{a.handle || a.external_id}</p>
                    <p className="text-[11px] font-normal text-neutral-500">{platformLabel(a.platform as Platform)}{a.status === "verified" ? " · Verified" : " · Pending"}</p>
                  </div>
                  {a.status === "verified" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" strokeWidth={1.75} /> : null}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void onReconnect(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0a0a0a] py-2 text-[11px] font-medium text-orange-400 disabled:opacity-50"><RefreshCw className="size-3.5" strokeWidth={1.75} /> Reconnect</button>
                  <button type="button" disabled={busy} onClick={() => void onDelete(a.id, a.platform)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0a0a0a] py-2 text-[11px] font-medium text-red-400/90 disabled:opacity-50"><Trash2 className="size-3.5" strokeWidth={1.75} /> Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#121212] px-3.5 py-3 text-[11px] font-normal text-neutral-500">
        <Shield className="mt-0.5 size-4 shrink-0 text-orange-400" strokeWidth={1.75} />
        Telegram is your Taskora identity. Other accounts verify only after the bio/about message is found on a public profile.
      </div>
    </main>
  );
}
