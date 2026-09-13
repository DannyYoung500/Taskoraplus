import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { listConnectedAccounts, requestConnectAccount } from "@/lib/connected-accounts.functions";
import { CONNECTABLE_PLATFORMS } from "@/lib/taskora-data";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { Screen, ScreenTitle } from "@/components/Screen";

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
      setMsg("Saved as pending. Real verification adapters are not live yet.");
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
        subtitle="Telegram is already your identity — link other platforms"
      />

      <div className="card-surface space-y-3 p-4">
        <label className="text-xs text-muted-foreground">Platform</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
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
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="bg-green-grad w-full rounded-2xl py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save (pending verification)"}
        </button>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>

      <div className="mt-6 space-y-2">
        {(accounts as Array<{ id: string; platform: string; handle: string; status: string }>)
          .filter((a) => a.platform !== "telegram")
          .map((a) => (
            <div key={a.id} className="card-surface flex items-center gap-3 p-3.5 text-sm">
              <PlatformIcon platform={a.platform as Platform} size={20} />
              <span className="min-w-0 flex-1 truncate font-medium">{a.handle}</span>
              <span className="text-xs text-muted-foreground">{a.status}</span>
            </div>
          ))}
      </div>
    </Screen>
  );
}
