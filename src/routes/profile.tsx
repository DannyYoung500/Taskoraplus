import { createFileRoute } from "@tanstack/react-router";
import { Bell, Globe, LifeBuoy, ShieldCheck, ChevronRight, Link2 } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { USER } from "@/lib/taskora-data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TASKORA" },
      {
        name: "description",
        content: "Manage your TASKORA account, connected social accounts, language and notifications.",
      },
      { property: "og:title", content: "Profile — TASKORA" },
      {
        property: "og:description",
        content: "Your TASKORA account, connected accounts and preferences.",
      },
    ],
  }),
  component: ProfileScreen,
});

const CONNECTED: { platform: Platform; handle: string | null }[] = [
  { platform: "telegram", handle: "@dannyy" },
  { platform: "youtube", handle: "Danny Y." },
  { platform: "x", handle: null },
  { platform: "tiktok", handle: null },
];

const SETTINGS = [
  { label: "Language", value: "English", Icon: Globe },
  { label: "Notifications", value: "On", Icon: Bell },
  { label: "Security", value: "Telegram verified", Icon: ShieldCheck },
  { label: "Support", value: "", Icon: LifeBuoy },
];

function ProfileScreen() {
  return (
    <Screen>
      <ScreenTitle title="Profile" />

      <section className="card-surface flex items-center gap-3 p-4">
        <span className="bg-green-grad inline-flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground">
          {USER.name.charAt(0)}
        </span>
        <div>
          <p className="text-base font-bold leading-tight">{USER.name}</p>
          <p className="text-xs text-muted-foreground">{USER.handle}</p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            <ShieldCheck className="size-3" /> {USER.level}
          </span>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        <Stat value={`${USER.verifiedTasks}`} label="Verified" />
        <Stat value={`$${USER.lifetime.toFixed(0)}`} label="Lifetime" />
        <Stat value={`${USER.streak}d`} label="Streak" />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Connected accounts</h2>
        <div className="card-surface divide-y divide-border">
          {CONNECTED.map((c) => (
            <div key={c.platform} className="flex items-center gap-3 p-3.5">
              <PlatformIcon platform={c.platform} size={22} />
              <p className="flex-1 text-sm font-medium">{c.handle ?? "Not connected"}</p>
              {c.handle ? (
                <span className="text-[11px] font-semibold text-success">Connected</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <Link2 className="size-3" /> Connect
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Settings</h2>
        <div className="card-surface divide-y divide-border">
          {SETTINGS.map(({ label, value, Icon }) => (
            <button key={label} className="flex w-full items-center gap-3 p-3.5 text-left">
              <Icon className="size-4 text-primary" />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{value}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-surface p-3">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
