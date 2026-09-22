import { useEffect, useRef, type RefObject } from "react";
import {
  getMediaPlayback,
  setMediaPlayback,
} from "./media-playback";
import { useMediaPlaybackKey } from "./media-playback-context";

/**
 * Bind an HTMLMediaElement to the window playback store: restore seek /
 * playing on mount, and write back on timeupdate / play / pause / ended.
 */
export function usePersistedMedia(
  mediaRef: RefObject<HTMLMediaElement | null>,
  src: string,
) {
  const playbackKey = useMediaPlaybackKey();
  const restoredSrc = useRef<string | null>(null);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !playbackKey || !src) return;

    const applySaved = (force = false) => {
      if (!force && restoredSrc.current === src) return;
      const saved = getMediaPlayback(playbackKey);
      if (!saved) {
        restoredSrc.current = src;
        return;
      }
      restoredSrc.current = src;
      const seek = () => {
        if (saved.currentTime > 0 && Number.isFinite(el.duration)) {
          const capped =
            el.duration > 0
              ? Math.min(saved.currentTime, Math.max(0, el.duration - 0.05))
              : saved.currentTime;
          if (Math.abs(el.currentTime - capped) > 0.25) {
            el.currentTime = capped;
          }
        }
        if (saved.playing && el.paused) {
          void el.play().catch(() => {
            setMediaPlayback(playbackKey, { playing: false });
          });
        }
      };
      if (el.readyState >= 1) seek();
      else el.addEventListener("loadedmetadata", seek, { once: true });
    };

    applySaved();
    // Pop-out mounts the new player before the docked one unmounts; re-sync
    // once the docked cleanup has written the latest position.
    const resync = window.setTimeout(() => applySaved(true), 120);

    const onTimeUpdate = () => {
      setMediaPlayback(playbackKey, { currentTime: el.currentTime });
    };
    const onPlay = () => setMediaPlayback(playbackKey, { playing: true });
    const onPause = () =>
      setMediaPlayback(playbackKey, {
        playing: false,
        currentTime: el.currentTime,
      });
    const onEnded = () =>
      setMediaPlayback(playbackKey, { playing: false, currentTime: 0 });
    const onSeeked = () =>
      setMediaPlayback(playbackKey, { currentTime: el.currentTime });

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("seeked", onSeeked);

    return () => {
      window.clearTimeout(resync);
      setMediaPlayback(playbackKey, {
        currentTime: el.currentTime,
        playing: !el.paused && !el.ended,
      });
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("seeked", onSeeked);
    };
  }, [mediaRef, playbackKey, src]);
}
