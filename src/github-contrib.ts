/**
 * Helpers to package a local Haiku Spec and open GitHub's "new file" flow
 * (fork + PR when the user lacks write access).
 *
 * GitHub's create-file UI no longer reliably accepts a `value=` query param
 * (and Specs often exceed URL length). We always copy JSON to the clipboard
 * and open an editor with the filename prefilled — user pastes once.
 *
 * File samples / hex / inline bodies are scrubbed before copy/download so a
 * public PR does not include the dropped file’s contents.
 */

import type { SandboxRecord } from "./sandbox-store";
import {
  scrubPromptForContrib,
  scrubSpecForContrib,
} from "./contrib-scrub";

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
  scope: SandboxRecord["scope"];
  /** Set for dialect templates (xml-sitemap), separate from the extension. */
  dialect?: string;
  savedAt: string;
  /** Invent prompt with sample/hex sections redacted. */
  prompt?: string;
  /** Spec structure only — file payloads emptied. */
  spec: SandboxRecord["spec"];
  /** True when sample/hex/bodies were stripped for public contribution. */
  contentsRedacted: true;
};

export function contribFilename(record: SandboxRecord): string {
  if (record.scope === "dialect" && record.dialect) {
    const slug = record.dialect.replace(/[^a-z0-9._-]+/gi, "-");
    return `${slug}.json`;
  }
  const ext = (record.extension || "bin").replace(/[^a-z0-9._-]+/gi, "-");
  const hash = record.key.replace(/[^a-z0-9]+/gi, "-").slice(-16) || "spec";
  return `${ext}-${hash}.json`;
}

export function buildContribPayload(record: SandboxRecord): ContribPayload {
  const ext = record.extension || "bin";
  return {
    version: 1,
    source: "filelathe",
    inventedBy: "haiku",
    extension: ext,
    mimeType: record.mimeType,
    // Avoid leaking the user's real filename into a public PR.
    filenameHint: `example.${ext}`,
    sandboxKey: record.key,
    scope: record.scope,
    dialect: record.dialect,
    savedAt: new Date(record.savedAt).toISOString(),
    prompt: scrubPromptForContrib(record.prompt),
    spec: scrubSpecForContrib(record.spec),
    contentsRedacted: true,
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
 * Copy scrubbed mini-app JSON to the clipboard, then open GitHub's new-file page.
 * User pastes into the editor, commits on a branch, and opens a PR.
 */
export async function proposeSpecOnGithub(
  record: SandboxRecord,
): Promise<ProposeResult> {
  const filename = contribFilename(record);
  const body = contribJson(record);
  const label = record.dialect ?? `.${record.extension || "bin"}`;
  const message = `Add Haiku mini-app for ${label}`;
  const description = [
    "Contributed from a local Filelathe session (json-render Spec).",
    "",
    record.dialect
      ? `- Dialect: \`${record.dialect}\` (not the generic extension template)`
      : null,
    `- Extension: \`.${record.extension || "bin"}\``,
    `- MIME: \`${record.mimeType}\``,
    "",
    "Dropped-file contents (samples, hex, Textarea bodies) were redacted before paste.",
    "Please review the mini-app Spec before merging.",
  ]
    .filter((line) => line !== null)
    .join("\n");

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
