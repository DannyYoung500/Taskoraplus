import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  ExternalLink,
  Film,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { OwnerShell } from "@/components/OwnerShell";
import {
  deleteOwnerVideo,
  getYoutubeVideoMetadata,
  listOwnerVideos,
  registerOwnerVideo,
  setOwnerVideoStatus,
  type WatchVideo,
} from "@/lib/watch-video.functions";

export const Route = createFileRoute("/_authenticated/owner/videos")({
  component: OwnerVideosPage,
});

function getYoutubeId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (host.endsWith("youtube.com")) {
      const direct = url.searchParams.get("v");
      if (direct) return direct;

      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) =>
        ["shorts", "embed", "live"].includes(part),
      );
      return marker >= 0 ? parts[marker + 1] ?? "" : "";
    }
  } catch {
    return "";
  }

  return "";
}

async function loadYoutubePlayerApi() {
  const win = window as typeof window & {
    YT?: { Player?: new (...args: any[]) => any };
    onYouTubeIframeAPIReady?: () => void;
  };

  if (win.YT?.Player) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-taskora-youtube-api="true"]',
    );

    if (existing) {
      const started = Date.now();
      const check = () => {
        if (win.YT?.Player) {
          resolve();
          return;
        }

        if (Date.now() - started > 10000) {
          reject(new Error("YouTube player metadata timed out."));
          return;
        }

        window.setTimeout(check, 100);
      };

      check();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.taskoraYoutubeApi = "true";
    win.onYouTubeIframeAPIReady = () => resolve();
    script.onerror = () =>
      reject(new Error("Could not load YouTube duration service."));
    document.head.appendChild(script);
  });
}

async function readYoutubeDuration(videoId: string) {
  await loadYoutubePlayerApi();

  const win = window as typeof window & {
    YT?: { Player?: new (...args: any[]) => any };
  };

  const Player = win.YT?.Player;
  if (!Player) throw new Error("YouTube player is unavailable.");

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none";
  document.body.appendChild(host);

  return await new Promise<number>((resolve, reject) => {
    let finished = false;
    let player: any;

    const cleanup = () => {
      try {
        player?.destroy?.();
      } catch {
        // Ignore player cleanup errors.
      }
      host.remove();
    };

    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
    };

    const poll = () => {
      if (finished) return;

      const duration = Number(player?.getDuration?.() ?? 0);
      if (duration > 0) {
        finished = true;
        cleanup();
        resolve(Math.round(duration));
        return;
      }

      window.setTimeout(poll, 250);
    };

    try {
      player = new Player(host, {
        videoId,
        playerVars: { playsinline: 1 },
        events: {
          onReady: () => poll(),
          onError: () =>
            fail(new Error("YouTube could not load that video.")),
        },
      });
    } catch (error) {
      fail(
        error instanceof Error
          ? error
          : new Error("Could not create the YouTube player."),
      );
    }
  });
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secondsPart = total % 60;

  if (hours > 0) {
    return (
      hours +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(secondsPart).padStart(2, "0")
    );
  }

  return minutes + ":" + String(secondsPart).padStart(2, "0");
}

function OwnerVideosPage() {
  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("0.0300");
  const [duration, setDuration] = useState("");
  const [dailyLimit, setDailyLimit] = useState("1");
  const [maxViews, setMaxViews] = useState("0");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    try {
      const rows = await listOwnerVideos();
      setVideos(rows);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load campaigns.",
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const videoId = getYoutubeId(url.trim());

    if (!videoId) {
      setThumbnail(null);
      setChannel("");
      setDuration("");
      return;
    }

    setThumbnail(
      "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg",
    );

    const timer = window.setTimeout(async () => {
      setMetadataBusy(true);
      setMessage(null);

      try {
        const metadata = await getYoutubeVideoMetadata({
          data: { url: url.trim() },
        });

        setTitle((current) => current || metadata.title);
        setThumbnail(metadata.thumbnailUrl);
        setChannel(metadata.authorName);

        try {
          const seconds = await readYoutubeDuration(videoId);
          setDuration(String(seconds));
        } catch {
          setDuration("");
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not read YouTube metadata.",
        );
      } finally {
        setMetadataBusy(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [url]);

  async function publish() {
    const videoId = getYoutubeId(url.trim());

    if (!videoId) {
      setMessage("Paste a valid public YouTube URL.");
      return;
    }

    if (!title.trim()) {
      setMessage("Video title could not be detected.");
      return;
    }

    const requiredSeconds = Number(duration);
    if (!Number.isFinite(requiredSeconds) || requiredSeconds < 1) {
      setMessage("Wait for the YouTube duration to load.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await registerOwnerVideo({
        data: {
          platform: "YouTube",
          videoUrl: url.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          rewardUsdt: Math.max(0, Number(reward) || 0),
          durationSeconds: Math.round(requiredSeconds),
          thumbnailUrl: thumbnail || undefined,
          dailyLimit: Math.max(1, Math.floor(Number(dailyLimit) || 1)),
          maxViews: Math.max(0, Math.floor(Number(maxViews) || 0)),
        },
      });

      setUrl("");
      setTitle("");
      setDescription("");
      setReward("0.0300");
      setDuration("");
      setDailyLimit("1");
      setMaxViews("0");
      setThumbnail(null);
      setChannel("");
      setMessage("Campaign published to Watch & Earn.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not publish video.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeVideo(video: WatchVideo) {
    const confirmed = window.confirm(
      "Remove this video from Watch & Earn? Existing watch and earning history will be preserved.",
    );

    if (!confirmed) return;

    setActionId(video.id);

    try {
      await deleteOwnerVideo({ data: { videoId: video.id } });
      setMessage("Video removed from the active earning feed.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not remove video.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function toggleVideo(video: WatchVideo) {
    setActionId(video.id);

    try {
      await setOwnerVideoStatus({
        data: {
          videoId: video.id,
          status: video.status === "active" ? "paused" : "active",
        },
      });
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update video.",
      );
    } finally {
      setActionId(null);
    }
  }

  const liveCount = videos.filter((video) => video.status === "active").length;
  const totalViews = videos.reduce(
    (sum, video) => sum + video.viewsCount,
    0,
  );
  const deliveredValue = videos.reduce(
    (sum, video) => sum + video.viewsCount * video.rewardUsdt,
    0,
  );

  return (
    <OwnerShell>
      <main className="min-h-screen bg-[#06101d] px-4 pb-12 pt-4 text-white sm:px-6">
        <header className="mb-5 flex items-center gap-3">
          <Link
            to="/owner"
            className="rounded-xl border border-white/10 bg-white/5 p-2"
          >
            <ChevronLeft className="size-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              Watch & Earn
            </p>
            <h1 className="text-2xl font-black">Video Campaigns</h1>
            <p className="text-xs text-slate-400">
              Create and manage paid YouTube watch campaigns.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-white/10 p-2.5 text-slate-300"
            aria-label="Refresh campaigns"
          >
            <RefreshCw className="size-4" />
          </button>
        </header>

        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Campaigns" value={videos.length} />
          <Metric label="Live" value={liveCount} />
          <Metric label="Views" value={totalViews} />
          <Metric
            label="Delivered value"
            value={"$" + deliveredValue.toFixed(4)}
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#0b1a2d]">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <UploadCloud className="size-5" />
              </span>

              <div>
                <h2 className="text-base font-black">
                  Create Watch & Earn campaign
                </h2>
                <p className="text-[11px] text-slate-400">
                  Paste a YouTube URL and TASKORA reads the title, channel,
                  thumbnail and duration.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              YouTube video URL
            </label>

            <div className="mt-1 flex gap-2 rounded-2xl border border-white/10 bg-black/20 px-3">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
              />
              {metadataBusy ? (
                <Loader2 className="my-auto size-4 animate-spin text-cyan-300" />
              ) : getYoutubeId(url) ? (
                <Check className="my-auto size-4 text-emerald-300" />
              ) : null}
            </div>

            {thumbnail ? (
              <div className="mt-3 flex gap-3 rounded-2xl border border-white/10 bg-black/15 p-2.5">
                <img
                  src={thumbnail}
                  alt=""
                  className="aspect-video w-32 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-bold">
                    {title || "YouTube video"}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {channel || "YouTube"} ·{" "}
                    {duration
                      ? formatDuration(Number(duration))
                      : "Reading duration…"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label="Campaign title"
                value={title}
                onChange={setTitle}
              />
              <Field
                label="Reward per completed watch (USDT)"
                value={reward}
                onChange={setReward}
                numeric
              />
              <Field
                label="Required watch time"
                value={
                  duration
                    ? formatDuration(Number(duration))
                    : "Auto from YouTube"
                }
                readOnly
              />
              <Field
                label="Max watches / user / day"
                value={dailyLimit}
                onChange={setDailyLimit}
                numeric
              />
              <Field
                label="Campaign max views"
                value={maxViews === "0" ? "Unlimited" : maxViews}
                onChange={(value) =>
                  setMaxViews(value === "Unlimited" ? "0" : value)
                }
                numeric
              />
            </div>

            <label className="mt-3 block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Campaign description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Tell users what they earn and what they need to do."
                className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none"
              />
            </label>

            <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] leading-5 text-amber-100/75">
              <b className="text-amber-200">Pricing:</b> users see the exact
              USDT reward before starting. Only qualified foreground playback
              counts toward the required watch time.
            </div>

            <button
              type="button"
              disabled={saving || metadataBusy}
              onClick={() => void publish()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-black disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <UploadCloud className="size-4" />
                  Publish campaign
                </>
              )}
            </button>

            {message ? (
              <p className="mt-3 text-center text-xs text-slate-300">
                {message}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-lg font-black">Your posted videos</h2>
            <p className="text-[11px] text-slate-500">
              Pause or remove your campaigns without deleting their accounting
              history.
            </p>
          </div>

          <div className="space-y-3">
            {videos.map((video) => (
              <article
                key={video.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1a2d]"
              >
                <div className="flex gap-3 p-3">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="h-20 w-32 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-xl bg-white/5">
                      <Film className="size-6 text-slate-500" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-2 flex-1 text-sm font-bold">
                        {video.title}
                      </p>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-bold text-slate-300">
                        {video.status}
                      </span>
                    </div>

                    <p className="mt-1 text-[10px] text-slate-500">
                      YouTube · {video.viewsCount.toLocaleString()} views ·{" "}
                      {formatDuration(video.durationSeconds)} · $
                      {video.rewardUsdt.toFixed(4)} / completion
                    </p>

                    <p className="mt-1 text-[10px] text-slate-500">
                      {video.maxViews
                        ? "Max " + video.maxViews + " views"
                        : "Unlimited views"}
                    </p>
                  </div>
                </div>

                <div className="flex border-t border-white/10 p-2.5">
                  <a
                    href={video.videoUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-bold text-slate-300"
                  >
                    <ExternalLink className="size-3.5" />
                    YouTube
                  </a>

                  <button
                    type="button"
                    disabled={
                      Boolean(actionId) || video.status === "completed"
                    }
                    onClick={() => void toggleVideo(video)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-l border-white/10 py-2 text-[10px] font-bold text-slate-300 disabled:opacity-40"
                  >
                    {video.status === "active" ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    {video.status === "active" ? "Pause" : "Resume"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      Boolean(actionId) || video.status === "completed"
                    }
                    onClick={() => void removeVideo(video)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-l border-red-400/10 py-2 text-[10px] font-bold text-red-300 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </OwnerShell>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1a2d] p-3">
      <p className="text-[9px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-base font-black">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  numeric?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        readOnly={readOnly}
        inputMode={numeric ? "decimal" : undefined}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm font-semibold outline-none read-only:text-slate-400"
      />
    </label>
  );
}
