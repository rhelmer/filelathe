import { useEffect, useRef, useState } from "react";
import { ChiptuneJsPlayer } from "chiptune3";
import { getModule } from "./module-store";

type Meta = {
  title?: string;
  artist?: string;
  type?: string;
  num_channels?: number;
  num_patterns?: number;
  num_orders?: number;
  dur?: number;
};

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
  const playerRef = useRef<ChiptuneJsPlayer | null>(null);
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const buffer = getModule(props.moduleId);
    if (!buffer) {
      setError("Module data missing from browser store.");
      return;
    }

    let cancelled = false;
    startedRef.current = false;
    const player = new ChiptuneJsPlayer({ repeatCount: 0 });
    playerRef.current = player;

    player.onInitialized(() => {
      if (cancelled) return;
      setReady(true);
      player.setRepeatCount(0);
    });
    player.onMetadata((info: Meta) => {
      if (cancelled) return;
      setMeta(info);
      if (typeof info.dur === "number") setDuration(info.dur);
    });
    player.onProgress((info: { pos?: number }) => {
      if (cancelled) return;
      if (typeof info.pos === "number") setPosition(info.pos);
    });
    player.onEnded(() => {
      if (cancelled) return;
      setPlaying(false);
    });
    player.onError((err: { type?: string }) => {
      if (cancelled) return;
      setError(err?.type ?? "Playback error");
    });

    return () => {
      cancelled = true;
      try {
        player.stop();
        void player.context.close();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [props.moduleId]);

  async function toggle() {
    const player = playerRef.current;
    const buffer = getModule(props.moduleId);
    if (!player || !ready || !buffer) return;
    setError(null);
    if (player.context.state === "suspended") {
      await player.context.resume();
    }
    if (!startedRef.current) {
      player.play(buffer.slice(0));
      startedRef.current = true;
      setPlaying(true);
      return;
    }
    player.togglePause();
    setPlaying((value) => !value);
  }

  function stop() {
    const player = playerRef.current;
    if (!player) return;
    player.stop();
    startedRef.current = false;
    setPlaying(false);
    setPosition(0);
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
