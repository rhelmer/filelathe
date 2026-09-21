import { useEffect, useRef, useState } from "react";
import { ChiptuneJsPlayer } from "chiptune3";
import { track } from "./analytics";
import {
  getMediaPlayback,
  setMediaPlayback,
} from "./media-playback";
import { useMediaPlaybackKey } from "./media-playback-context";
import { getModule } from "./module-store";
import {
  getSharedTrackerContext,
  resumeTrackerContext,
} from "./tracker-audio";

type Meta = {
  title?: string;
  artist?: string;
  type?: string;
  num_channels?: number;
  num_patterns?: number;
  num_orders?: number;
  dur?: number;
};

type PlayerHandle = ChiptuneJsPlayer & {
  gain?: GainNode;
  processNode?: AudioWorkletNode;
};

const WORKLET_TIMEOUT_MS = 6_000;

export function TrackerPlayer({
  props,
}: {
  props: {
    moduleId: string;
    title: string | null;
    format: string;
    channels: number | null;
  };
}) {
  const playbackKey = useMediaPlaybackKey();
  const playerRef = useRef<PlayerHandle | null>(null);
  const startedRef = useRef(false);
  const trackedPlayRef = useRef(false);
  const playingRef = useRef(false);
  const positionRef = useRef(0);
  const restoredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bootId, setBootId] = useState(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    const buffer = getModule(props.moduleId);
    if (!buffer) {
      setReady(false);
      setError(
        "Module bytes are missing from this browser tab. Close this window and drop the file again.",
      );
      return;
    }

    let cancelled = false;
    let initialized = false;
    startedRef.current = false;
    restoredRef.current = false;
    setReady(false);
    setError(null);
    setPlaying(false);
    setMeta(null);
    setPosition(0);
    setDuration(0);

    const ctx = getSharedTrackerContext();
    // Pass shared context so React Strict Mode remounts don't abort addModule
    // by closing a per-instance AudioContext.
    const player = new ChiptuneJsPlayer({
      repeatCount: 0,
      context: ctx,
    }) as PlayerHandle;
    playerRef.current = player;

    const failTimer = window.setTimeout(() => {
      if (cancelled || initialized) return;
      setError(
        "libopenmpt audio worklet failed to load. Click Retry, or reload the page.",
      );
    }, WORKLET_TIMEOUT_MS);

    const persist = (patch: { currentTime?: number; playing?: boolean }) => {
      if (!playbackKey) return;
      setMediaPlayback(playbackKey, patch);
    };

    const tryRestore = async () => {
      if (cancelled || restoredRef.current || !playbackKey) return;
      const saved = getMediaPlayback(playbackKey);
      if (!saved || (saved.currentTime <= 0 && !saved.playing)) {
        restoredRef.current = true;
        return;
      }
      restoredRef.current = true;
      try {
        await resumeTrackerContext();
        player.play(buffer.slice(0));
        startedRef.current = true;
        if (saved.currentTime > 0) {
          player.setPos(saved.currentTime);
          setPosition(saved.currentTime);
        }
        if (saved.playing) {
          setPlaying(true);
          persist({ playing: true, currentTime: saved.currentTime });
        } else {
          player.pause();
          setPlaying(false);
          persist({ playing: false, currentTime: saved.currentTime });
        }
      } catch {
        // Autoplay / AudioContext may block resume after reload — keep seek.
        if (saved.currentTime > 0) {
          setPosition(saved.currentTime);
          persist({ playing: false, currentTime: saved.currentTime });
        }
      }
    };

    player.onInitialized(() => {
      if (cancelled) {
        try {
          player.gain?.disconnect();
          player.processNode?.disconnect();
        } catch {
          // ignore
        }
        return;
      }
      initialized = true;
      window.clearTimeout(failTimer);
      // External context → chiptune3 does not auto-connect to speakers
      try {
        player.gain?.connect(ctx.destination);
      } catch {
        // already connected
      }
      setError(null);
      setReady(true);
      player.setRepeatCount(0);
      void tryRestore();
    });
    player.onMetadata((info: Meta) => {
      if (cancelled) return;
      setMeta(info);
      if (typeof info.dur === "number") setDuration(info.dur);
    });
    player.onProgress((info: { pos?: number }) => {
      if (cancelled) return;
      if (typeof info.pos === "number") {
        setPosition(info.pos);
        persist({ currentTime: info.pos });
      }
    });
    player.onEnded(() => {
      if (cancelled) return;
      setPlaying(false);
      persist({ playing: false, currentTime: 0 });
    });
    player.onError((err: { type?: string }) => {
      if (cancelled) return;
      setError(err?.type ?? "Playback error");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      if (playbackKey) {
        setMediaPlayback(playbackKey, {
          currentTime: positionRef.current,
          playing: playingRef.current,
        });
      }
      playerRef.current = null;
      try {
        player.stop();
        player.gain?.disconnect();
        player.processNode?.disconnect();
      } catch {
        // ignore — never close the shared AudioContext
      }
    };
  }, [props.moduleId, bootId, playbackKey]);

  async function toggle() {
    const player = playerRef.current;
    const buffer = getModule(props.moduleId);
    if (!buffer) {
      setError("Module bytes are missing. Close this window and drop the file again.");
      return;
    }
    if (!player || !ready) {
      setError("Player is not ready yet. Wait a moment or click Retry.");
      return;
    }
    setError(null);
    try {
      await resumeTrackerContext();
      if (!startedRef.current) {
        const saved = playbackKey ? getMediaPlayback(playbackKey) : undefined;
        player.play(buffer.slice(0));
        startedRef.current = true;
        if (saved && saved.currentTime > 0) {
          player.setPos(saved.currentTime);
          setPosition(saved.currentTime);
        }
        setPlaying(true);
        if (playbackKey) {
          setMediaPlayback(playbackKey, {
            playing: true,
            currentTime: saved?.currentTime ?? 0,
          });
        }
        if (!trackedPlayRef.current) {
          trackedPlayRef.current = true;
          track("tracker_play", {
            format: (props.format || "mod").toLowerCase(),
          });
        }
        return;
      }
      player.togglePause();
      setPlaying((value) => {
        const next = !value;
        if (playbackKey) {
          setMediaPlayback(playbackKey, {
            playing: next,
            currentTime: positionRef.current,
          });
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function stop() {
    const player = playerRef.current;
    if (!player) return;
    player.stop();
    startedRef.current = false;
    setPlaying(false);
    setPosition(0);
    if (playbackKey) {
      setMediaPlayback(playbackKey, { playing: false, currentTime: 0 });
    }
  }

  const title = meta?.title || props.title || "Tracker module";
  const detail = [
    props.format.toUpperCase(),
    props.channels ? `${props.channels} ch` : null,
    meta?.artist || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-tracker-play=""
          className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
          disabled={!ready}
          onClick={() => void toggle()}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="rounded-full border px-3 py-1 text-xs disabled:opacity-50"
          disabled={!ready}
          onClick={stop}
        >
          Stop
        </button>
        {error ? (
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs"
            onClick={() => setBootId((n) => n + 1)}
          >
            Retry
          </button>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatTime(position)}
        {duration > 0 ? ` / ${formatTime(duration)}` : ""}
        {meta?.num_patterns != null ? ` · ${meta.num_patterns} patterns` : ""}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {!ready && !error ? (
        <p className="text-xs text-muted-foreground">Loading libopenmpt…</p>
      ) : null}
    </div>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
