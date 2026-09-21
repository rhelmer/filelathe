import { ApiRequestError } from "./api-error";

/**
 * Privacy-safe Umami custom events.
 * Never send filenames, sample text, hex, full URLs, or file contents.
 */

export type FileOpenSource = "drop" | "picker" | "url";

export type FileOpenFailReason =
  | "network"
  | "rate_limit"
  | "compose"
  | "fetch"
  | "drop_empty"
  | "unknown";

export type InventOutcome =
  | "haiku"
  | "cache"
  | "fallback"
  | "planned_inspector";

type TrackValue = string | number | boolean;
type TrackData = Record<string, TrackValue>;

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: TrackData) => void;
    };
  }
}

function cleanData(data?: Record<string, TrackValue | null | undefined>): TrackData | undefined {
  if (!data) return undefined;
  const out: TrackData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === "") continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Fire a custom Umami event when the tracker is loaded. */
export function track(
  event: string,
  data?: Record<string, TrackValue | null | undefined>,
) {
  try {
    window.umami?.track(event, cleanData(data));
  } catch {
    // Analytics must never break the app.
  }
}

/** Lowercase extension without the leading dot, or "none". */
export function extensionFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "none";
  return base.slice(dot + 1).toLowerCase() || "none";
}

export function classifyOpenError(
  error: unknown,
  stage: "compose" | "fetch" | "load",
): FileOpenFailReason {
  if (error instanceof ApiRequestError) {
    if (error.code === "rate_limit") return "rate_limit";
  }
  if (error instanceof Error) {
    const msg = error.message || "";
    if (
      error.name === "AbortError" ||
      error.name === "TypeError" ||
      /aborted|timeout|failed to fetch|networkerror|load failed/i.test(msg)
    ) {
      return "network";
    }
  }
  if (stage === "fetch") return "fetch";
  if (stage === "compose") return "compose";
  return "unknown";
}
