import { useEffect, useRef, useState } from "react";
import { CheckCircle2, PlayCircle, ShieldCheck } from "lucide-react";
import {
  coveragePercent,
  extractTikTokVideoId,
  extractYouTubeVideoId,
  isDirectVideoUrl,
} from "@/lib/task-actions";

type YouTubePlayer = {
  destroy: () => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

type YouTubeEvent = { target: YouTubePlayer; data: number };

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events: {
        onReady: (event: YouTubeEvent) => void;
        onStateChange: (event: YouTubeEvent) => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const COVERAGE_REQUIRED = 95;

export function TaskActionPlayer({
  url,
  onComplete,
}: {
  url: string;
  onComplete: () => void;
}) {
  const youtubeId = extractYouTubeVideoId(url);
  const tiktokId = extractTikTokVideoId(url);
  const directVideo = isDirectVideoUrl(url);
  const [duration, setDuration] = useState(0);
  const [coverage, setCoverage] = useState(0);
  const [ended, setEnded] = useState(false);
  const watched = useRef(new Set<number>());
  const lastTime = useRef(0);
  const youtubePlayer = useRef<YouTubePlayer | null>(null);
  const directRef = useRef<HTMLVideoElement | null>(null);

  function markWatched(currentTime: number, mediaDuration: number) {
    if (!Number.isFinite(currentTime) || !Number.isFinite(mediaDuration) || mediaDuration <= 0) return;
    const second = Math.floor(Math.max(0, Math.min(currentTime, mediaDuration - 0.001)));
    watched.current.add(second);
    lastTime.current = Math.max(lastTime.current, currentTime);
    setDuration(mediaDuration);
    setCoverage(coveragePercent(watched.current, mediaDuration));
  }

  function finish(mediaDuration: number) {
    const percent = coveragePercent(watched.current, mediaDuration);
    setCoverage(percent);
    if (percent >= COVERAGE_REQUIRED) {
      setEnded(true);
      onComplete();
    }
  }

  useEffect(() => {
    if (!youtubeId) return;

    let disposed = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const setup = () => {
      if (disposed || !window.YT) return;
      const host = document.getElementById("taskora-youtube-player");
      if (!host) return;
      youtubePlayer.current = new window.YT.Player(host, {
        videoId: youtubeId,
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: ({ target }) => {
            setDuration(target.getDuration());
            interval = setInterval(() => {
              if (target.getPlayerState() === 1) {
                markWatched(target.getCurrentTime(), target.getDuration());
              }
            }, 500);
          },
          onStateChange: ({ target, data }) => {
            if (data === 0) finish(target.getDuration());
          },
        },
      });
    };

    if (window.YT) {
      setup();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        setup();
      };
      const existing = document.querySelector('script[data-taskora-youtube-api="true"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.dataset.taskoraYoutubeApi = "true";
        document.head.appendChild(script);
      }
    }

    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      youtubePlayer.current?.destroy();
      youtubePlayer.current = null;
    };
  }, [youtubeId]);

  useEffect(() => {
    if (!tiktokId) return;

    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes("tiktok.com")) return;
      const data = event.data as {
        [key: string]: unknown;
        type?: string;
        value?: { currentTime?: number; duration?: number };
      };
      if (!data || data["x-tiktok-player"] !== true) return;
      if (data.type === "onCurrentTime") {
        const current = Number(data.value?.currentTime ?? 0);
        const total = Number(data.value?.duration ?? 0);
        markWatched(current, total);
      }
      if (data.type === "onStateChange" && Number(data.value) === 0) {
        finish(duration);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tiktokId, duration]);

  if (!url) {
    return <PlayerMessage text="This task has no video target yet." />;
  }

  if (youtubeId) {
    return (
      <PlayerShell coverage={coverage} ended={ended}>
        <div id="taskora-youtube-player" className="aspect-video w-full overflow-hidden rounded-xl bg-black" />
      </PlayerShell>
    );
  }

  if (tiktokId) {
    return (
      <PlayerShell coverage={coverage} ended={ended}>
        <iframe
          title="Task video"
          src={`https://www.tiktok.com/player/v1/${tiktokId}?controls=1&progress_bar=1&play_button=1&timestamp=1&loop=0`}
          className="aspect-video w-full rounded-xl bg-black"
          allow="fullscreen"
        />
      </PlayerShell>
    );
  }

  if (directVideo) {
    return (
      <PlayerShell coverage={coverage} ended={ended}>
        <video
          ref={directRef}
          src={url}
          controls
          playsInline
          className="aspect-video w-full rounded-xl bg-black"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => markWatched(event.currentTarget.currentTime, event.currentTarget.duration)}
          onSeeking={(event) => {
            const video = event.currentTarget;
            if (video.currentTime > lastTime.current + 2) video.currentTime = lastTime.current;
          }}
          onEnded={() => finish(directRef.current?.duration ?? duration)}
        />
      </PlayerShell>
    );
  }

  return (
    <PlayerMessage
      text="This platform does not expose an in-app completion event for this link. The task can still require proof, but TASKORA will not falsely mark it as fully watched."
      link={url}
    />
  );
}

function PlayerShell({
  children,
  coverage,
  ended,
}: {
  children: React.ReactNode;
  coverage: number;
  ended: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-2">
      {children}
      <div className="mt-2 flex items-center justify-between px-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-white/45">
          <PlayCircle className="size-3.5" /> Watch to unlock submission
        </span>
        <span className={ended ? "text-emerald-300" : "text-amber-300"}>
          {ended ? "Completed" : `${Math.min(100, Math.round(coverage))}% watched`}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-300 transition-[width] duration-300"
          style={{ width: `${Math.min(100, coverage)}%` }}
        />
      </div>
      {ended ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="size-3.5" /> Watch requirement completed.
        </p>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-white/35">
          <ShieldCheck className="size-3.5" /> Keep the video playing. Skipping ahead will not count.
        </p>
      )}
    </div>
  );
}

function PlayerMessage({ text, link }: { text: string; link?: string }) {
  return (
    <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4 text-sm text-white/65">
      <p>{text}</p>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-amber-300">
          Open target →
        </a>
      ) : null}
    </div>
  );
}
