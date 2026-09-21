/**
 * In-memory playback position / playing flag, keyed by window id.
 * Survives React remounts (pop-out / dock). Session store also persists
 * these fields across reload.
 */

export type MediaPlaybackState = {
  currentTime: number;
  playing: boolean;
};

const states = new Map<string, MediaPlaybackState>();

export function getMediaPlayback(
  key: string,
): MediaPlaybackState | undefined {
  return states.get(key);
}

export function setMediaPlayback(
  key: string,
  patch: Partial<MediaPlaybackState>,
): MediaPlaybackState {
  const prev = states.get(key) ?? { currentTime: 0, playing: false };
  const next: MediaPlaybackState = {
    currentTime:
      typeof patch.currentTime === "number" && Number.isFinite(patch.currentTime)
        ? Math.max(0, patch.currentTime)
        : prev.currentTime,
    playing:
      typeof patch.playing === "boolean" ? patch.playing : prev.playing,
  };
  states.set(key, next);
  return next;
}

export function clearMediaPlayback(key: string) {
  states.delete(key);
}
