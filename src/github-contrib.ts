/**
 * Helpers to package a local Haiku Spec and open GitHub's "new file" flow
 * (fork + PR when the user lacks write access).
 *
 * GitHub's create-file UI no longer reliably accepts a `value=` query param
 * (and Specs often exceed URL length). We always copy JSON to the clipboard
 * and open an editor with the filename prefilled — user pastes once.
 */

import type { SandboxRecord } from "./sandbox-store";

export const CONTRIB_REPO = "rhelmer/filelathe";
export const CONTRIB_BRANCH = "main";
export const CONTRIB_DIR = "contrib/invented";

export type ContribPayload = {
  version: 1;
  source: "filelathe";
  inventedBy: "haiku";
  extension: string;
  mimeType: string;
  filenameHint: string;
  sandboxKey: string;
  scope: "content" | "extension";
  savedAt: string;
  prompt?: string;
  spec: SandboxRecord["spec"];
};

export function contribFilename(record: SandboxRecord): string {
  const ext = (record.extension || "bin").replace(/[^a-z0-9._-]+/gi, "-");
  const hash = record.key.replace(/[^a-z0-9]+/gi, "-").slice(-16) || "spec";
  return `${ext}-${hash}.json`;
}

export function buildContribPayload(record: SandboxRecord): ContribPayload {
  return {
    version: 1,
    source: "filelathe",
    inventedBy: "haiku",
    extension: record.extension,
    mimeType: record.mimeType,
    filenameHint: record.filenameHint,
    sandboxKey: record.key,
    scope: record.scope,
    savedAt: new Date(record.savedAt).toISOString(),
    prompt: record.prompt,
    spec: record.spec,
  };
}

export function contribJson(record: SandboxRecord): string {
  return `${JSON.stringify(buildContribPayload(record), null, 2)}\n`;
}

/** Open GitHub "Create new file" under contrib/invented/ with name filled in. */
export function githubNewFileUrl(options: {
  filename: string;
  message?: string;
  description?: string;
}): string {
  const params = new URLSearchParams();
  // Basename only — directory is in the path (more reliable than path-in-filename).
  params.set("filename", options.filename);
  if (options.message) params.set("message", options.message);
  if (options.description) params.set("description", options.description);
  return `https://github.com/${CONTRIB_REPO}/new/${CONTRIB_BRANCH}/${CONTRIB_DIR}?${params.toString()}`;
}

export type ProposeResult = {
  url: string;
  filename: string;
  /** True when clipboard.writeText succeeded. */
  copied: boolean;
};

/**
 * Copy mini-app JSON to the clipboard, then open GitHub's new-file page.
 * User pastes into the editor, commits on a branch, and opens a PR.
 */
export async function proposeSpecOnGithub(
  record: SandboxRecord,
): Promise<ProposeResult> {
  const filename = contribFilename(record);
  const body = contribJson(record);
  const message = `Add Haiku mini-app for .${record.extension || "bin"} (${record.filenameHint})`;
  const description = [
    "Contributed from a local Filelathe session (json-render Spec).",
    "",
    `- Extension: \`.${record.extension || "bin"}\``,
    `- MIME: \`${record.mimeType}\``,
    `- Hint filename: \`${record.filenameHint}\``,
    "",
    "Please review the mini-app Spec before merging.",
  ].join("\n");

  let copied = false;
  try {
    await navigator.clipboard.writeText(body);
    copied = true;
  } catch {
    // Permissions / insecure context — caller should fall back to download.
    copied = false;
  }

  return {
    url: githubNewFileUrl({ filename, message, description }),
    filename,
    copied,
  };
}

export function downloadContribJson(record: SandboxRecord): void {
  const blob = new Blob([contribJson(record)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = contribFilename(record);
  a.click();
  URL.revokeObjectURL(url);
}
