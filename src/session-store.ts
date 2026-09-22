/**
 * Persist the open workspace (windows, Specs, media bytes) in IndexedDB so a
 * reload restores floating windows instead of wiping the desk.
 */

import type { Spec } from "@json-render/core";
import { putArchive } from "./archive-store";
import { stateForFile } from "./file-candidates";
import type { LoadedFile } from "./files";
import {
  getMediaPlayback,
  setMediaPlayback,
  type MediaPlaybackState,
} from "./media-playback";
import { putModule } from "./module-store";
import type { WindowGeometry } from "./WindowChrome";

const DB_NAME = "filelathe-session";
const DB_VERSION = 1;
const STORE = "workspace";
const KEY = "current";

export type SessionWindow = {
  id: string;
  file: LoadedFile;
  /** Raw bytes for blob:-backed audio/image/video/pdf. */
  mediaBytes: ArrayBuffer | null;
  /** Tracker module payload (module-store is in-memory only). */
  moduleBytes: ArrayBuffer | null;
  /** Archive container payload (archive-store is in-memory only). */
  archiveBytes: ArrayBuffer | null;
  spec: Spec;
  prompt: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  restore: WindowGeometry | null;
  /** Seek / play state for audio, video, and tracker windows. */
  playback: MediaPlaybackState | null;
};

export type SessionSnapshot = {
  version: 1;
  savedAt: number;
  activeId: string | null;
  zTop: number;
  windows: SessionWindow[];
};

export type LiveWindow = {
  id: string;
  file: LoadedFile;
  spec: Spec;
  prompt: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  poppedOut: boolean;
  restore: WindowGeometry | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function isBlobMedia(
  file: LoadedFile,
): file is LoadedFile & { src: string; kind: "audio" | "image" | "video" | "pdf" } {
  return (
    (file.kind === "audio" ||
      file.kind === "image" ||
      file.kind === "video" ||
      file.kind === "pdf") &&
    typeof file.src === "string"
  );
}

async function readMediaBytes(file: LoadedFile): Promise<ArrayBuffer | null> {
  if (!isBlobMedia(file) || !file.src.startsWith("blob:")) return null;
  try {
    const res = await fetch(file.src);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function stripEphemeralSrc(file: LoadedFile): LoadedFile {
  if (!isBlobMedia(file) || !file.src.startsWith("blob:")) return file;
  return { ...file, src: "" };
}

export async function serializeWindow(
  item: LiveWindow,
  moduleBytes: ArrayBuffer | null | undefined,
  archiveBytes: ArrayBuffer | null | undefined,
): Promise<SessionWindow> {
  const mediaBytes = await readMediaBytes(item.file);
  return {
    id: item.id,
    file: stripEphemeralSrc(item.file),
    mediaBytes,
    moduleBytes:
      item.file.kind === "tracker"
        ? (moduleBytes ?? null)
        : null,
    archiveBytes:
      item.file.kind === "archive"
        ? (archiveBytes ?? null)
        : null,
    spec: item.spec,
    prompt: item.prompt,
    x: item.x,
    y: item.y,
    z: item.z,
    width: item.width,
    height: item.height,
    minimized: item.minimized,
    maximized: item.maximized,
    restore: item.restore,
    playback: getMediaPlayback(item.id) ?? null,
  };
}

export function reviveWindow(stored: SessionWindow): LiveWindow {
  let file = structuredClone(stored.file) as LoadedFile;

  if (
    stored.mediaBytes &&
    (file.kind === "audio" ||
      file.kind === "image" ||
      file.kind === "video" ||
      file.kind === "pdf")
  ) {
    const blob = new Blob([stored.mediaBytes], { type: file.mimeType });
    file = { ...file, src: URL.createObjectURL(blob) };
  }

  if (file.kind === "tracker" && stored.moduleBytes) {
    putModule(file.moduleId, stored.moduleBytes);
  }

  if (file.kind === "archive" && stored.archiveBytes) {
    putArchive(file.archiveId, stored.archiveBytes);
  }

  if (
    stored.playback &&
    typeof stored.playback.currentTime === "number" &&
    typeof stored.playback.playing === "boolean"
  ) {
    setMediaPlayback(stored.id, stored.playback);
  }

  const spec = structuredClone(stored.spec) as Spec;
  const fresh = stateForFile(file);
  const prevState = (spec.state ?? {}) as Record<string, unknown>;
  const prevFile = (prevState.file ?? {}) as Record<string, unknown>;
  spec.state = {
    ...prevState,
    ...fresh,
    file: { ...prevFile, ...fresh.file },
  };

  return {
    id: stored.id,
    file,
    spec,
    prompt: stored.prompt,
    x: stored.x,
    y: stored.y,
    z: stored.z,
    width: stored.width,
    height: stored.height,
    minimized: stored.minimized,
    maximized: stored.maximized,
    poppedOut: false,
    restore: stored.restore,
  };
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const raw = await idbReq(tx.objectStore(STORE).get(KEY));
    if (!raw || typeof raw !== "object") return null;
    const snap = raw as SessionSnapshot;
    if (snap.version !== 1 || !Array.isArray(snap.windows)) return null;
    return snap;
  } finally {
    db.close();
  }
}

export async function saveSession(snapshot: SessionSnapshot): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(snapshot, KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB session write failed"));
    });
  } finally {
    db.close();
  }
}

export async function clearSession(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB session clear failed"));
    });
  } finally {
    db.close();
  }
}

export async function buildSessionSnapshot(input: {
  windows: LiveWindow[];
  activeId: string | null;
  zTop: number;
  getModuleBytes: (moduleId: string) => ArrayBuffer | undefined;
  getArchiveBytes: (archiveId: string) => ArrayBuffer | undefined;
}): Promise<SessionSnapshot> {
  const windows: SessionWindow[] = [];
  for (const item of input.windows) {
    const moduleBytes =
      item.file.kind === "tracker"
        ? input.getModuleBytes(item.file.moduleId) ?? null
        : null;
    const archiveBytes =
      item.file.kind === "archive"
        ? input.getArchiveBytes(item.file.archiveId) ?? null
        : null;
    windows.push(await serializeWindow(item, moduleBytes, archiveBytes));
  }
  return {
    version: 1,
    savedAt: Date.now(),
    activeId: input.activeId,
    zTop: input.zTop,
    windows,
  };
}
