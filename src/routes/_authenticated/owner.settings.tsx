import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/settings")({
  component: OwnerSettings,
});

function OwnerSettings() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Platform settings</h1>
      <p className="mt-1 text-xs text-white/45">
        Operational defaults. Env-backed secrets stay on Vercel (never in the browser).
      </p>

      <div className="mt-4 space-y-3">
        {[
          { k: "Min withdrawal", v: "$10.00" },
          { k: "Payout methods", v: "USDT TRC20 · BEP20 · BTC · TON" },
          { k: "Referral share", v: "8% of verified rewards" },
          { k: "Daily check-in", v: "$0.10" },
          { k: "Owner Telegram IDs", v: "TASKORA_OWNER_TELEGRAM_IDS (server)" },
          { k: "Bot token", v: "TELEGRAM_BOT_TOKEN (server)" },
        ].map((row) => (
          <div
            key={row.k}
            className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3"
          >
            <span className="text-sm text-white/70">{row.k}</span>
            <span className="text-xs font-semibold text-amber-300">{row.v}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-white/40">
        Editable settings UI can write to `owner_settings` once that table is migrated. Current values
        are enforced in server functions.
      </p>
    </main>
  );
}
