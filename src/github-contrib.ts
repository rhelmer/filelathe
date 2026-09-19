/**
 * Helpers to package a local Haiku Spec and open GitHub's "new file" flow
 * (fork + PR when the user lacks write access).
 */

import type { SandboxRecord } from "./sandbox-store";

export const CONTRIB_REPO = "rhelmer/filelathe";
export const CONTRIB_BRANCH = "main";
export const CONTRIB_DIR = "contrib/invented";

/** Soft browser URL length budget for pre-filled GitHub new-file links. */
const MAX_GITHUB_URL_CHARS = 7000;

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

export function githubNewFileUrl(options: {
  filename: string;
  value?: string;
  message?: string;
  description?: string;
}): string {
  const path = `${CONTRIB_DIR}/${options.filename}`;
  const params = new URLSearchParams();
  params.set("filename", path);
  if (options.value != null) params.set("value", options.value);
  if (options.message) params.set("message", options.message);
  if (options.description) params.set("description", options.description);
  return `https://github.com/${CONTRIB_REPO}/new/${CONTRIB_BRANCH}?${params.toString()}`;
}

export type ProposeResult =
  | { mode: "prefilled"; url: string }
  | { mode: "clipboard"; url: string };

/**
 * Prefer a one-click prefilled GitHub editor. If the Spec is too large for the
 * URL, copy JSON to the clipboard and open an empty editor at the right path.
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

  const prefilled = githubNewFileUrl({
    filename,
    value: body,
    message,
    description,
  });

  if (prefilled.length <= MAX_GITHUB_URL_CHARS) {
    return { mode: "prefilled", url: prefilled };
  }

  await navigator.clipboard.writeText(body);
  const empty = githubNewFileUrl({
    filename,
    message,
    description,
  });
  return { mode: "clipboard", url: empty };
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
