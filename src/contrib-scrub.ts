/**
 * Strip dropped-file contents from Specs / invent prompts before they leave
 * the browser (Propose PR clipboard paste, contrib download) and before Specs
 * are persisted as reusable templates.
 *
 * Structure, $bindState paths, and short UI chrome (tab ids, Metric labels)
 * stay. Samples, hex dumps, Textarea/Markdown bodies, and invent prompts that
 * embed the file are removed or replaced with placeholders.
 */

import type { Spec } from "@json-render/core";

export const REDACTED_SAMPLE = "(sample redacted for contribution)";
export const REDACTED_HEX = "(hex preview redacted for contribution)";
export const REDACTED_PROMPT =
  "(invent prompt redacted — contained file sample/hex; regenerate locally)";

/**
 * State leaves that hold file payloads or derived file text.
 * Always cleared on scrub (empty string), then refilled at render by hydrate.
 */
const FILE_PAYLOAD_STATE_LEAVES =
  /^(body|hex|code|text|raw|source|content|sample|markdown|literate|extract|bird|json|edit|preview|overview|summary|about|checks|keys|keywords|fields)$/i;

/** Short tab / mode ids we keep in Spec.state. */
const KEEP_STATE_LEAF =
  /^(active)?tab$|^(selected)?tab$|^(view|mode|panel)$/i;

/** Prop keys that often hold file bodies when set as plain strings. */
const CONTENT_PROP_KEYS = new Set([
  "markdown",
  "text",
  "value",
  "html",
  "content",
  "src",
  "sampletext",
  "hexpreview",
  "code",
  "body",
  "message",
]);

/** Component types whose string props are treated as file-ish by default. */
const CONTENT_COMPONENT_TYPES = new Set([
  "MarkdownView",
  "Textarea",
  "Input",
  "Text",
]);

function leafName(pathOrKey: string): string {
  const parts = pathOrKey.replace(/^\//, "").split("/").filter(Boolean);
  return (parts[parts.length - 1] ?? pathOrKey).toLowerCase();
}

function isBindExpression(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    "$bindState" in obj ||
    "$state" in obj ||
    "$bindItem" in obj ||
    "$item" in obj ||
    "$template" in obj ||
    "$cond" in obj
  );
}

/** True when a string looks like dropped-file payload rather than UI chrome. */
export function isLikelyFileContent(
  value: string,
  keyHint?: string,
): boolean {
  const leaf = keyHint ? leafName(keyHint) : "";
  if (KEEP_STATE_LEAF.test(leaf) && value.length < 48) return false;
  if (FILE_PAYLOAD_STATE_LEAVES.test(leaf)) return true;
  // Secrets / tokens — check before the short-chrome allowlist
  if (
    /\b(api[_-]?key|secret|password|token|bearer|authorization)\b\s*[:=]/i.test(
      value,
    )
  ) {
    return true;
  }
  // Hex dump rows
  if (/^[0-9a-f]{4,8}\s+[0-9a-f]{2}(\s+[0-9a-f]{2})+/im.test(value)) {
    return true;
  }
  // Short UI chrome (Metric labels, Badge tags, tab ids)
  if (value.length <= 48 && !value.includes("\n")) return false;
  if (value.length > 80) return true;
  if (value.includes("\n") && value.length > 40) return true;
  // Fenced code blocks / EDN / JSON blobs
  if (/^```/.test(value.trim()) && value.length > 40) return true;
  if (CONTENT_PROP_KEYS.has(leaf) && value.length > 48) {
    return true;
  }
  return false;
}

function scrubString(value: string, keyHint: string): string {
  return isLikelyFileContent(value, keyHint) ? "" : value;
}

function scrubValue(value: unknown, keyHint: string): unknown {
  if (typeof value === "string") {
    return scrubString(value, keyHint);
  }
  if (isBindExpression(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => scrubValue(item, `${keyHint}/${i}`));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, `${keyHint}/${k}`);
    }
    return out;
  }
  return value;
}

function scrubElementProps(
  type: string,
  props: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    const keyPath = `${path}/${k}`;
    if (isBindExpression(v)) {
      out[k] = v;
      continue;
    }
    if (typeof v === "string") {
      const leaf = k.toLowerCase();
      // Always clear file-bearing props on content components.
      if (
        CONTENT_COMPONENT_TYPES.has(type) &&
        (leaf === "markdown" ||
          leaf === "value" ||
          leaf === "text" ||
          leaf === "html" ||
          leaf === "content")
      ) {
        out[k] = "";
        continue;
      }
      // Alert messages / Badge text can quote sample lines — scrub when file-ish.
      if (
        (type === "Alert" && (leaf === "message" || leaf === "title")) ||
        (type === "Badge" && leaf === "text") ||
        (type === "Heading" && leaf === "text")
      ) {
        out[k] = scrubString(v, keyPath);
        continue;
      }
    }
    out[k] = scrubValue(v, keyPath);
  }
  return out;
}

/**
 * Deep-clone a Spec and empty file payloads (state seeds, Markdown bodies,
 * Textarea values, hex dumps). Safe for IndexedDB templates and public PRs —
 * `hydrateInventedSpec` refills from the current drop at render time.
 */
export function scrubSpecForContrib(spec: Spec): Spec {
  const cloned = structuredClone(spec) as Spec;
  if (cloned.state && typeof cloned.state === "object") {
    const state = { ...(cloned.state as Record<string, unknown>) };
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === "string" && FILE_PAYLOAD_STATE_LEAVES.test(key)) {
        state[key] = "";
      } else {
        state[key] = scrubValue(value, `state/${key}`);
      }
    }
    cloned.state = state as Spec["state"];
  }
  if (cloned.elements && typeof cloned.elements === "object") {
    const elements: Spec["elements"] = {};
    for (const [id, el] of Object.entries(cloned.elements)) {
      const props = scrubElementProps(
        el.type,
        (el.props ?? {}) as Record<string, unknown>,
        `elements/${id}/props`,
      );
      elements[id] = {
        ...el,
        props,
        children: el.children ?? [],
      };
    }
    cloned.elements = elements;
  }
  return cloned;
}

/**
 * Remove sample / hex / ANALYSIS file echoes from an invent prompt.
 * Prefer omitting the prompt from public contribs; this is the fallback when
 * a short prompt stub is still useful.
 */
export function scrubPromptForContrib(
  prompt: string | undefined,
): string | undefined {
  if (!prompt?.trim()) return prompt;

  // Full invent prompts embed catalog + sample — never ship them.
  if (
    /Sample text/i.test(prompt) ||
    /Hex preview/i.test(prompt) ||
    /AVAILABLE COMPONENTS/i.test(prompt) ||
    /ANALYSIS \(use these facts/i.test(prompt)
  ) {
    return `${REDACTED_PROMPT}\n`;
  }

  let out = prompt;

  out = out.replace(
    /Sample text \(may be truncated[^)]*\):[\s\S]*?(?=\nHex preview|\nFile metadata:|\n---|\nTASK\b|$)/i,
    `Sample text:\n${REDACTED_SAMPLE}\n\n`,
  );
  out = out.replace(
    /Hex preview \([^)]*\):[\s\S]*$/i,
    `Hex preview:\n${REDACTED_HEX}\n`,
  );
  out = out.replace(
    /Sample text:[\s\S]*?(?=\nHex preview:|\nFile metadata:|$)/i,
    `Sample text:\n${REDACTED_SAMPLE}\n\n`,
  );
  out = out.replace(
    /Hex preview:[\s\S]*$/i,
    `Hex preview:\n${REDACTED_HEX}\n`,
  );

  // Real filenames / hosts in metadata
  out = out.replace(
    /- filename:\s*.+$/gim,
    '- filename: "example.bin"',
  );
  out = out.replace(
    /- title:\s*.+$/gim,
    '- title: "example"',
  );
  out = out.replace(
    /- sourceUrl:\s*.+$/gim,
    '- sourceUrl: "(redacted)"',
  );
  out = out.replace(
    /^\s*-\s*Filename:\s*.+$/gim,
    "- Filename: example.bin",
  );
  out = out.replace(
    /^\s*-\s*First locations:\s*.+$/gim,
    "- First locations: (redacted)",
  );

  return out.trimEnd() + "\n";
}

/**
 * True when scrubbed JSON still looks like it embeds a file sample.
 * Used as a last-line guard before Propose PR / download.
 */
export function contribLooksLeaky(json: string): boolean {
  if (/SECRET_TOKEN|BEGIN (RSA |OPENSSH )?PRIVATE KEY/i.test(json)) {
    return true;
  }
  if (/Sample text:\n(?!\(sample redacted)/i.test(json)) {
    return true;
  }
  if (/Hex preview:\n(?!\(hex preview redacted)/i.test(json)) {
    return true;
  }
  // Long hex dump rows
  if (/^[0-9a-f]{4,8}\s+[0-9a-f]{2}(\s+[0-9a-f]{2}){8,}/im.test(json)) {
    return true;
  }
  return false;
}
