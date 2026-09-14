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

function AdvertisePage() {
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [taskType, setTaskType] = useState("join");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reward, setReward] = useState("0.50");
  const [slots, setSlots] = useState("100");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!platform) return;
    setBusy(true);
    setMessage(null);
    try {
      const steps = instructions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const task = await ownerCreateTask({
        data: {
          platform,
          title: title || `${taskType} on ${platform}`,
          advertiser: "TASKORA Owner",
          reward: Number(reward),
          slots: Number(slots),
          steps:
            steps.length > 0
              ? steps
              : ["Open the target", `Complete: ${taskType}`, "Return and submit proof"],
          proof: platform === "telegram" ? "auto" : "username",
          link: link || undefined,
        },
      });
      setMessage(`Published task ${task.id}. It will appear in the marketplace when active.`);
      setStep(0);
      setPlatform(null);
      setTitle("");
      setInstructions("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed (owner role required)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-6 text-white">
      <h1 className="text-xl font-bold">Advertise</h1>
      <p className="mt-1 text-xs text-white/45">
        Platform first · long instructions supported · PDF briefs in Owner → Documents
      </p>

      {step === 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPlatform(p);
                setStep(1);
              }}
              className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-left text-sm font-semibold capitalize"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      {step === 1 && platform ? (
        <div className="mt-4 space-y-3 rounded-3xl border border-white/8 bg-[#12141c] p-4">
          <p className="text-xs text-white/45">Platform: {platform}</p>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
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
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Target URL"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Long instructions (one step per line). Unlimited length."
            rows={6}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-amber-300/40"
          />
          <div className="flex gap-2">
            <input
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="Reward"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
            />
            <input
              value={slots}
              onChange={(e) => setSlots(e.target.value)}
              placeholder="Slots"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="w-full rounded-2xl py-3 text-sm font-bold text-[#05070c] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#FFE08A,#F5C542,#C9961A)" }}
          >
            {busy ? "Publishing…" : "Publish (owner)"}
          </button>
          <button type="button" className="w-full text-xs text-white/40" onClick={() => setStep(0)}>
            Back
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs text-white/55">{message}</p> : null}
    </main>
  );
}
