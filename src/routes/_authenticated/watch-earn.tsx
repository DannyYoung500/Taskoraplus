import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/watch-earn")({
  component: WatchEarnPage,
});

/**
 * Watch & Earn is separate from Advertise.
 * Rewards only after provider server-side completion confirmation.
 * Do not credit from a frontend video-ended event alone.
 */
function WatchEarnPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="text-xl font-bold">Watch & Earn</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Complete a rewarded video through the configured provider. TASKORA credits a reward only after
        the provider confirms completion on the server.
      </p>

      <div className="card-surface mt-6 space-y-3 p-4">
        <p className="text-sm font-semibold">Provider not connected</p>
        <p className="text-xs text-muted-foreground">
          Owner must configure a rewarded-video provider (server secrets only — never NEXT_PUBLIC_).
          Limits, cooldown, and fraud controls belong in the Owner Control Center.
        </p>
        <button
          type="button"
          disabled
          className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground"
        >
          Watch video (disabled until provider is live)
        </button>
      </div>
    </main>
  );
}
