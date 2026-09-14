import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { listConnectedAccounts, requestConnectAccount } from "@/lib/connected-accounts.functions";
import { CONNECTABLE_PLATFORMS } from "@/lib/taskora-data";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";

export const Route = createFileRoute("/_authenticated/connected")({
  loader: async () => {
    const accounts = await listConnectedAccounts().catch(() => []);
    return { accounts };
  },
  component: ConnectedPage,
});

function ConnectedPage() {
  const { accounts } = Route.useLoaderData();
  const [platform, setPlatform] = useState<Platform>(CONNECTABLE_PLATFORMS[0]!);
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await requestConnectAccount({ data: { platform, handle } });
      setMsg("Saved as pending. Owner can approve from Connected Accounts.");
      setHandle("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle
        title="Connect socials"
        subtitle="Telegram is your identity — link other platforms"
      />

      <Card className="space-y-3 p-4">
        <label className="text-xs text-white/50">Platform</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/40"
        >
          {CONNECTABLE_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@username or handle"
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/40"
        />
        <GoldButton disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Save (pending verification)"}
        </GoldButton>
        {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      </Card>

      <div className="mt-6 space-y-2">
        {(accounts as Array<{ id: string; platform: string; handle: string; status: string }>)
          .filter((a) => a.platform !== "telegram")
          .map((a) => (
            <Card key={a.id} className="flex items-center gap-3 p-3.5 text-sm">
              <PlatformIcon platform={a.platform as Platform} size={20} />
              <span className="min-w-0 flex-1 truncate font-medium">{a.handle}</span>
              <span className="text-xs text-amber-300/80">{a.status}</span>
            </Card>
          ))}
      </div>
    </Screen>
  );
}
