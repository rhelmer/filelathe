/** Shared AudioContext for tracker playback — never closed on React unmount.
 *  Closing mid-addModule aborts chiptune3's worklet load (console-only AbortError). */

let shared: AudioContext | null = null;

export function getSharedTrackerContext(): AudioContext {
  if (!shared || shared.state === "closed") {
    shared = new AudioContext();
  }
  return shared;
}

export async function resumeTrackerContext(): Promise<void> {
  const ctx = getSharedTrackerContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}
