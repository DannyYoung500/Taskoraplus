import { createFileRoute } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import { Screen, ScreenTitle, Card } from "@/components/Screen";

export const Route = createFileRoute("/_authenticated/watch-earn")({
  head: () => ({ meta: [{ title: "Watch & Earn — TASKORA" }] }),
  component: WatchEarnPage,
});

function WatchEarnPage() {
  return (
    <Screen>
      <ScreenTitle title="Watch & Earn" subtitle="Verified provider rewards only" />

      <Card className="p-5">
        <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <PlayCircle className="size-6" />
        </div>
        <h2 className="text-base font-bold">Coming online soon</h2>
        <p className="mt-2 text-sm text-white/50">
          Rewards only after a signed provider callback. No simulated credits. Owner will connect AdMob /
          offerwall keys when ready.
        </p>
        <button
          type="button"
          disabled
          className="mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-[#05070c] opacity-50"
          style={{ background: "linear-gradient(135deg,#FFE08A,#F5C542,#C9961A)" }}
        >
          Provider not configured
        </button>
      </Card>

      <Card className="mt-4 space-y-2 p-4 text-xs text-white/45">
        <p>· Server validates provider signature</p>
        <p>· Ledger credit is idempotent</p>
        <p>· Duplicate callbacks ignored</p>
      </Card>
    </Screen>
  );
}
