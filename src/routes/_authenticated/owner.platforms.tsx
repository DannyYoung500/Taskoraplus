import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, Loader2, Shield } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import {
  ownerGetPlatformTokenStatus,
  ownerSetPlatformToken,
  ownerTestDiscordToken,
  ownerTestTelegramToken,
} from "@/lib/platform-tokens";

export const Route = createFileRoute("/_authenticated/owner/platforms")({
  component: OwnerPlatformsPage,
});

function OwnerPlatformsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tokenProbe, setTokenProbe] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<{
    discord: { configured: boolean; source: string; masked: string | null };
    telegram: { configured: boolean; source: string; masked: string | null };
  } | null>(null);
  const [discordTokenInput, setDiscordTokenInput] = useState("");
  const [telegramTokenInput, setTelegramTokenInput] = useState("");

  useEffect(() => {
    void ownerGetPlatformTokenStatus()
      .then(setTokenStatus)
      .catch((e) => setMessage(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  async function saveDiscordToken() {
    setSaving(true);
    setMessage("");
    setTokenProbe(null);
    try {
      const ts = await ownerSetPlatformToken({
        data: { key: "discord_bot_token", value: discordTokenInput },
      });
      setTokenStatus(ts);
      setDiscordTokenInput("");
      setMessage(
        discordTokenInput.trim()
          ? "Discord bot token saved (dashboard). Env still wins if set."
          : "Discord dashboard token cleared.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save Discord token.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTelegramToken() {
    setSaving(true);
    setMessage("");
    setTokenProbe(null);
    try {
      const ts = await ownerSetPlatformToken({
        data: { key: "telegram_bot_token", value: telegramTokenInput },
      });
      setTokenStatus(ts);
      setTelegramTokenInput("");
      setMessage(
        telegramTokenInput.trim()
          ? "Telegram bot token saved (dashboard). Env still wins if set."
          : "Telegram dashboard token cleared.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save Telegram token.");
    } finally {
      setSaving(false);
    }
  }

  async function probeDiscord() {
    setSaving(true);
    setTokenProbe(null);
    try {
      const r = await ownerTestDiscordToken();
      setTokenProbe(r.ok ? `Discord OK — ${r.detail}` : `Discord FAIL — ${r.detail}`);
    } catch (e) {
      setTokenProbe(e instanceof Error ? e.message : "Probe failed");
    } finally {
      setSaving(false);
    }
  }

  async function probeTelegram() {
    setSaving(true);
    setTokenProbe(null);
    try {
      const r = await ownerTestTelegramToken();
      setTokenProbe(r.ok ? `Telegram OK — ${r.detail}` : `Telegram FAIL — ${r.detail}`);
    } catch (e) {
      setTokenProbe(e instanceof Error ? e.message : "Probe failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="size-6 animate-spin text-violet-300" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <AppLink to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </AppLink>
        <div>
          <h1 className="text-xl font-bold">Platform tokens</h1>
          <p className="text-xs text-white/45">Discord · Telegram bots · env wins over dashboard</p>
        </div>
      </div>

      {message ? (
        <p className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/70">
          {message}
        </p>
      ) : null}
      {tokenProbe ? (
        <p className="mb-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-200">
          {tokenProbe}
        </p>
      ) : null}

      {tokenStatus ? (
        <div className="mb-4 grid gap-2">
          <div className="rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Discord bot</p>
              <span className={tokenStatus.discord.configured ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-amber-300"}>
                {tokenStatus.discord.configured ? `OK · ${tokenStatus.discord.source}` : "UNSET"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/45">
              {tokenStatus.discord.masked ? `Masked: ${tokenStatus.discord.masked}` : "Paste token below or set DISCORD_BOT_TOKEN in Vercel"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Telegram bot</p>
              <span className={tokenStatus.telegram.configured ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-amber-300"}>
                {tokenStatus.telegram.configured ? `OK · ${tokenStatus.telegram.source}` : "UNSET"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/45">
              {tokenStatus.telegram.masked ? `Masked: ${tokenStatus.telegram.masked}` : "Usually TELEGRAM_BOT_TOKEN on Vercel"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 space-y-3 rounded-3xl border border-white/10 bg-[#12141c] p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-white/70">
          <Shield className="size-3.5 text-violet-300" /> Discord bot token
        </p>
        <p className="text-[11px] text-white/40">Discord Developer Portal → Bot → Copy Token. Invite bot to advertiser servers.</p>
        <input type="password" autoComplete="off" placeholder="Paste Discord bot token (empty = clear dashboard value)" value={discordTokenInput} onChange={(e) => setDiscordTokenInput(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-violet-400/40" />
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => void saveDiscordToken()} className="flex-1 rounded-xl bg-violet-500 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save Discord token</button>
          <button type="button" disabled={saving} onClick={() => void probeDiscord()} className="rounded-xl border border-violet-400/30 px-3 py-2.5 text-xs font-bold text-violet-200 disabled:opacity-50">Test</button>
        </div>
      </div>

      <div className="mb-4 space-y-3 rounded-3xl border border-white/10 bg-[#12141c] p-4">
        <p className="text-xs font-bold text-white/70">Telegram bot token (optional override)</p>
        <p className="text-[11px] text-white/40">Prefer Vercel env. Dashboard only used if env is empty.</p>
        <input type="password" autoComplete="off" placeholder="Paste Telegram bot token from @BotFather" value={telegramTokenInput} onChange={(e) => setTelegramTokenInput(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-sky-400/40" />
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => void saveTelegramToken()} className="flex-1 rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-[#05070c] disabled:opacity-50">Save Telegram token</button>
          <button type="button" disabled={saving} onClick={() => void probeTelegram()} className="rounded-xl border border-sky-400/30 px-3 py-2.5 text-xs font-bold text-sky-200 disabled:opacity-50">Test</button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-[11px] text-white/45">
        <p className="font-semibold text-white/60">Users connect accounts in-app</p>
        <p className="mt-1">Discord auto-verify needs: user Connected Accounts + bot token above + bot invited to the server.</p>
      </div>
    </main>
  );
}
