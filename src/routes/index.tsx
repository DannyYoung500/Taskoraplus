import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Coins, Zap } from "lucide-react";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TASKORA — Verified Tasks. Real Rewards." },
      {
        name: "description",
        content:
          "Complete verified social tasks on Telegram, YouTube, WhatsApp and more, and earn real crypto rewards with TASKORA.",
      },
      { property: "og:title", content: "TASKORA — Verified Tasks. Real Rewards." },
      {
        property: "og:description",
        content: "Earn real crypto rewards for verified social tasks, right inside Telegram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PLATFORMS: Platform[] = ["telegram", "youtube", "whatsapp", "x", "instagram", "tiktok", "discord"];

function Landing() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
      <section className="bg-brand relative overflow-hidden rounded-3xl p-6 text-navy-foreground shadow-raised">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "var(--gradient-sheen)" }} />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">TASKORA</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">Verified tasks. Real rewards.</h1>
          <p className="mt-3 text-sm opacity-85">
            Follow, join and watch for the brands you like — get paid in crypto once your task is verified.
          </p>
          <Link
            to="/auth"
            className="bg-green-grad mt-6 block rounded-2xl px-4 py-3.5 text-center text-sm font-bold text-primary-foreground shadow-glow"
          >
            Start earning
          </Link>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {PLATFORMS.map((p) => (
          <PlatformIcon key={p} platform={p} size={26} />
        ))}
      </div>

      <section className="mt-8 space-y-2.5">
        <Feature Icon={ShieldCheck} title="Every task is verified" text="Rewards release only after your action is confirmed." />
        <Feature Icon={Coins} title="Crypto payouts only" text="Withdraw in USDT, BTC or TON from $10." />
        <Feature Icon={Zap} title="Built for Telegram" text="Fast, mobile-first and no app store needed." />
      </section>

      <Link to="/auth" className="mt-8 text-center text-xs font-semibold text-primary">
        Already have an account? Sign in
      </Link>
    </main>
  );
}

function Feature({
  Icon,
  title,
  text,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="card-surface flex items-start gap-3 p-4">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-accent">
        <Icon className="size-4 text-accent-foreground" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
