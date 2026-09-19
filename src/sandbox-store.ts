/** Persist Haiku/fallback invented Specs in IndexedDB for reuse across drops. */

import type { Spec } from "@json-render/core";

const DB_NAME = "jev-invented-specs";
const DB_VERSION = 1;
const STORE = "specs";

export type SandboxInventedBy = "haiku" | "fallback";

export type SandboxRecord = {
  key: string;
  /** content = exact sample match; extension = reusable template for that file type */
  scope: "content" | "extension";
  extension: string;
  mimeType: string;
  filenameHint: string;
  spec: Spec;
  prompt?: string;
  inventedBy: SandboxInventedBy;
  savedAt: number;
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
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("extension", "extension", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
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

export function extensionOf(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  if (/^(dockerfile|makefile)$/i.test(base)) return base.toLowerCase();
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sandboxContentKey(input: {
  filename: string;
  mimeType: string;
  sampleText: string | null;
  hexPreview: string;
}): Promise<string> {
  const ext = extensionOf(input.filename);
  const material = input.sampleText ?? input.hexPreview;
  const hash = await sha256Hex(material);
  return `content:${input.mimeType}:${ext}:${hash.slice(0, 32)}`;
}

export function sandboxExtensionKey(input: {
  filename: string;
  mimeType: string;
}): string {
  const ext = extensionOf(input.filename) || "bin";
  return `ext:${ext}:${input.mimeType}`;
}

export async function getSandboxRecord(
  key: string,
): Promise<SandboxRecord | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const result = await idbReq(tx.objectStore(STORE).get(key));
    return (result as SandboxRecord | undefined) ?? null;
  } finally {
    db.close();
  }
}

/** Prefer exact content match, then latest extension template. */
export async function lookupSandboxViewer(input: {
  filename: string;
  mimeType: string;
  sampleText: string | null;
  hexPreview: string;
}): Promise<SandboxRecord | null> {
  const contentKey = await sandboxContentKey(input);
  const byContent = await getSandboxRecord(contentKey);
  if (byContent) return byContent;
  return getSandboxRecord(sandboxExtensionKey(input));
}

export async function saveSandboxViewer(input: {
  filename: string;
  mimeType: string;
  sampleText: string | null;
  hexPreview: string;
  spec: Spec;
  prompt?: string | null;
  inventedBy: SandboxInventedBy;
}): Promise<void> {
  if (!input.spec?.root || !input.spec.elements) return;

  const ext = extensionOf(input.filename);
  const savedAt = Date.now();
  const contentKey = await sandboxContentKey(input);
  const extensionKey = sandboxExtensionKey(input);
  const prompt = input.prompt ?? undefined;

  const contentRecord: SandboxRecord = {
    key: contentKey,
    scope: "content",
    extension: ext,
    mimeType: input.mimeType,
    filenameHint: input.filename,
    spec: input.spec,
    prompt,
    inventedBy: input.inventedBy,
    savedAt,
  };

  const extensionRecord: SandboxRecord = {
    key: extensionKey,
    scope: "extension",
    extension: ext,
    mimeType: input.mimeType,
    filenameHint: input.filename,
    spec: input.spec,
    prompt,
    inventedBy: input.inventedBy,
    savedAt,
  };

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put(contentRecord);
    store.put(extensionRecord);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB write failed"));
    });
  } finally {
    db.close();
  }
}

export async function listSandboxViewers(): Promise<SandboxRecord[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const all = await idbReq(tx.objectStore(STORE).getAll());
    return ((all as SandboxRecord[]) ?? []).sort(
      (a, b) => b.savedAt - a.savedAt,
    );
  } finally {
    db.close();
  }
}

export async function clearSandboxViewers(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB clear failed"));
    });
  } finally {
    db.close();
  }
}
