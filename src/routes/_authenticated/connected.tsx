import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { listConnectedAccounts, requestConnectAccount } from "@/lib/connected-accounts.functions";
import type { Platform } from "@/components/PlatformIcon";

export const Route = createFileRoute("/_authenticated/connected")({
  loader: async () => {
    const accounts = await listConnectedAccounts().catch(() => []);
    return { accounts };
  },
  component: ConnectedPage,
});

const PLATFORMS: Platform[] = ["telegram", "youtube", "x", "tiktok", "instagram", "discord", "whatsapp"];

function ConnectedPage() {
  const { accounts } = Route.useLoaderData();
  const [platform, setPlatform] = useState<Platform>("telegram");
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await requestConnectAccount({ data: { platform, handle } });
      setMsg("Saved as pending. Real verification adapters are not live yet — status stays pending.");
      setHandle("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="text-xl font-bold">Connected accounts</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Link handles for eligibility. Verification requires platform adapters (not faked).
      </p>

      <div className="card-surface mt-4 space-y-3 p-4">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@username or handle"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
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
        {(accounts as Array<{ id: string; platform: string; handle: string; status: string }>).map(
          (a) => (
            <div key={a.id} className="card-surface flex justify-between p-3 text-sm">
              <span className="font-medium capitalize">
                {a.platform}: {a.handle}
              </span>
              <span className="text-xs text-muted-foreground">{a.status}</span>
            </div>
          ),
        )}
      </div>
    </main>
  );
}
