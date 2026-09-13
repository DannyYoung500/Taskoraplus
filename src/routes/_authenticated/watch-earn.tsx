import { createFileRoute } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";

export const Route = createFileRoute("/_authenticated/watch-earn")({
  head: () => ({ meta: [{ title: "Watch & Earn — TASKORA" }] }),
  component: WatchEarnPage,
});

function WatchEarnPage() {
  return (
    <Screen>
      <ScreenTitle title="Watch & Earn" subtitle="Rewarded video providers" />

      <section className="card-surface p-5">
        <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <PlayCircle className="size-6" />
        </div>
        <h2 className="text-base font-bold">Provider integration</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Watch & Earn pays only after a verified provider callback. No client-side reward
          simulation. Connect AdMob / rewarded-ad or offerwall credentials in owner settings when
          ready.
        </p>
        <button
          type="button"
          disabled
          className="bg-green-grad mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-primary-foreground opacity-50"
        >
          Provider not configured
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Status: awaiting owner provider keys
        </p>
      </section>

      <section className="card-surface mt-4 space-y-2 p-4 text-xs text-muted-foreground">
        <p>· Server validates provider signature</p>
        <p>· Ledger credit is idempotent</p>
        <p>· Duplicate callbacks are ignored</p>
      </section>
    </Screen>
  );
}
