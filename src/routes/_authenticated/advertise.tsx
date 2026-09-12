import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ownerCreateTask } from "@/lib/taskora.functions";
import type { Platform } from "@/components/PlatformIcon";

export const Route = createFileRoute("/_authenticated/advertise")({
  component: AdvertisePage,
});

const PLATFORMS: Platform[] = [
  "telegram",
  "youtube",
  "x",
  "instagram",
  "tiktok",
  "discord",
  "whatsapp",
];

/**
 * Advertise scaffold: platform → task type → configure → publish.
 * Funding / campaign budget ledger still required for production advertisers.
 * Owner path can publish tasks immediately via ownerCreateTask.
 */
function AdvertisePage() {
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [taskType, setTaskType] = useState("join");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [reward, setReward] = useState("0.50");
  const [slots, setSlots] = useState("100");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!platform) return;
    setBusy(true);
    setMessage(null);
    try {
      const task = await ownerCreateTask({
        data: {
          platform,
          title: title || `${taskType} on ${platform}`,
          advertiser: "TASKORA Owner",
          reward: Number(reward),
          slots: Number(slots),
          steps: ["Open the target", `Complete: ${taskType}`, "Return and submit proof"],
          proof: platform === "telegram" ? "auto" : "username",
          link: link || undefined,
        },
      });
      setMessage(`Published task ${task.id}. It will appear in the marketplace when active.`);
      setStep(0);
      setPlatform(null);
      setTitle("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed (owner role required)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="text-xl font-bold">Advertise</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Platform first, then task type. Funding wallets for third-party advertisers are still pending.
      </p>

      {step === 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPlatform(p);
                setStep(1);
              }}
              className="card-surface p-4 text-left text-sm font-semibold capitalize"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      {step === 1 && platform ? (
        <div className="card-surface mt-4 space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Platform: {platform}</p>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            {["join", "follow", "like", "view", "subscribe", "comment", "repost"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Target URL"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="Reward"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={slots}
              onChange={(e) => setSlots(e.target.value)}
              placeholder="Slots"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            disabled={busy}
            onClick={publish}
            className="bg-green-grad w-full rounded-2xl py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish (owner)"}
          </button>
          <button type="button" className="w-full text-xs text-muted-foreground" onClick={() => setStep(0)}>
            Back
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </main>
  );
}
