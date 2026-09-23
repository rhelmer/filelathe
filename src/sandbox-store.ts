/** Persist Haiku/fallback invented Specs in IndexedDB for reuse across drops. */

import type { Spec } from "@json-render/core";
import { contentDialectId } from "./invent-prompt";

const DB_NAME = "jev-invented-specs";
const DB_VERSION = 1;
const STORE = "specs";

export type SandboxInventedBy = "haiku" | "fallback";

export type SandboxScope = "content" | "dialect" | "extension";

export type SandboxRecord = {
  key: string;
  /**
   * content = exact sample match.
   * dialect = reusable template for a format narrower than the extension
   * (xml-sitemap, not every .xml file).
   * extension = reusable template for that extension+MIME.
   */
  scope: SandboxScope;
  extension: string;
  /** Set when this file's format is narrower than its extension. */
  dialect?: string;
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

/** `kind:xml-sitemap` — null when the extension template is specific enough. */
export function sandboxDialectKey(input: {
  filename: string;
  sampleText: string | null;
}): string | null {
  const dialect = contentDialectId(input.filename, input.sampleText);
  return dialect ? `kind:${dialect}` : null;
}

/** Template written on save: dialect when set, otherwise extension+MIME. */
export function sandboxTemplateTarget(input: {
  filename: string;
  mimeType: string;
  sampleText: string | null;
}): { scope: "dialect" | "extension"; key: string; dialect?: string } {
  const dialect = contentDialectId(input.filename, input.sampleText);
  if (dialect) {
    return { scope: "dialect", key: `kind:${dialect}`, dialect };
  }
  return { scope: "extension", key: sandboxExtensionKey(input) };
}

/**
 * Lookup order: exact content, then dialect, then extension.
 * Dialect is preferred over extension so a sitemap Spec is not reused for
 * generic XML when both records exist. Extension stays the fallback.
 */
export function orderedSandboxLookupKeys(input: {
  contentKey: string;
  filename: string;
  mimeType: string;
  sampleText: string | null;
}): string[] {
  const keys = [input.contentKey];
  const template = sandboxTemplateTarget(input);
  keys.push(template.key);
  if (template.scope === "dialect") {
    keys.push(sandboxExtensionKey(input));
  }
  return keys;
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

/** Prefer exact content, then dialect, then extension template. */
export async function lookupSandboxViewer(input: {
  filename: string;
  mimeType: string;
  sampleText: string | null;
  hexPreview: string;
}): Promise<SandboxRecord | null> {
  const contentKey = await sandboxContentKey(input);
  const keys = orderedSandboxLookupKeys({ ...input, contentKey });
  for (const key of keys) {
    const record = await getSandboxRecord(key);
    if (record) return record;
  }
  return null;
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
  const template = sandboxTemplateTarget(input);
  const prompt = input.prompt ?? undefined;

  const contentRecord: SandboxRecord = {
    key: contentKey,
    scope: "content",
    extension: ext,
    dialect: template.dialect,
    mimeType: input.mimeType,
    filenameHint: input.filename,
    spec: input.spec,
    prompt,
    inventedBy: input.inventedBy,
    savedAt,
  };

  // Dialect files must not overwrite the extension template. A sitemap
  // invent stays on `kind:xml-sitemap` and leaves `ext:xml:*` for generic XML.
  const templateRecord: SandboxRecord = {
    key: template.key,
    scope: template.scope,
    extension: ext,
    dialect: template.dialect,
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
    store.put(templateRecord);
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

export async function deleteSandboxRecord(key: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB delete failed"));
    });
  } finally {
    db.close();
  }
}

/**
 * Records to show in Saved mini-apps.
 * A dialect template replaces its content snapshot in the list (that is the
 * Spec safe to contribute). Extension templates stay visible unless a
 * content snapshot for that extension+MIME is already shown — a dialect
 * record does not hide the generic extension template.
 */
export function dedupeSandboxRecords(records: SandboxRecord[]): SandboxRecord[] {
  const haiku = records.filter((r) => r.inventedBy === "haiku");
  const dialects = haiku.filter((r) => r.scope === "dialect");
  const dialectIds = new Set(
    dialects.map((r) => r.dialect).filter((id): id is string => Boolean(id)),
  );
  const content = haiku.filter(
    (r) => r.scope === "content" && !(r.dialect && dialectIds.has(r.dialect)),
  );
  const coveredExt = new Set(
    content.map((r) => `${r.extension}:${r.mimeType}`),
  );
  const extensionOnly = haiku.filter(
    (r) =>
      r.scope === "extension" &&
      !coveredExt.has(`${r.extension}:${r.mimeType}`),
  );
  return [...dialects, ...content, ...extensionOnly].sort(
    (a, b) => b.savedAt - a.savedAt,
  );
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
