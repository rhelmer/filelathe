/**
 * Strip dropped-file contents from Specs / invent prompts before they leave
 * the browser (Propose PR clipboard paste, contrib download). Structure and
 * $bindState paths stay; samples/hex/inline bodies become empty placeholders.
 */

import type { Spec } from "@json-render/core";

export const REDACTED_SAMPLE = "(sample redacted for contribution)";
export const REDACTED_HEX = "(hex preview redacted for contribution)";

/** Short tab / mode ids we keep in Spec.state. */
const KEEP_STATE_LEAF =
  /^(active)?tab$|^(selected)?tab$|^(code|text|hex|raw|edit|preview|overview|structure|notes|source|literate|view|mode|panel)$/i;

/** Prop keys that often hold file bodies. */
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
]);

function leafName(pathOrKey: string): string {
  const parts = pathOrKey.replace(/^\//, "").split("/").filter(Boolean);
  return (parts[parts.length - 1] ?? pathOrKey).toLowerCase();
}

export function isLikelyFileContent(
  value: string,
  keyHint?: string,
): boolean {
  const leaf = keyHint ? leafName(keyHint) : "";
  if (KEEP_STATE_LEAF.test(leaf) && value.length < 48) return false;
  // Short UI chrome
  if (value.length <= 48 && !value.includes("\n")) return false;
  if (value.length > 120) return true;
  if (value.includes("\n") && value.length > 40) return true;
  // Hex dump rows
  if (/^[0-9a-f]{4,8}\s+[0-9a-f]{2}(\s+[0-9a-f]{2})+/im.test(value)) {
    return true;
  }
  // Fenced code blocks / EDN / JSON blobs
  if (/^```/.test(value.trim()) && value.length > 40) return true;
  if (
    CONTENT_PROP_KEYS.has(leaf) &&
    value.length > 48
  ) {
    return true;
  }
  return false;
}

function scrubValue(value: unknown, keyHint: string): unknown {
  if (typeof value === "string") {
    return isLikelyFileContent(value, keyHint) ? "" : value;
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

/**
 * Deep-clone a Spec and empty any string that looks like file payload
 * (state seeds, Markdown bodies, Textarea values, hex dumps).
 */
export function scrubSpecForContrib(spec: Spec): Spec {
  const cloned = structuredClone(spec) as Spec;
  if (cloned.state && typeof cloned.state === "object") {
    cloned.state = scrubValue(cloned.state, "state") as Spec["state"];
  }
  if (cloned.elements && typeof cloned.elements === "object") {
    const elements: Spec["elements"] = {};
    for (const [id, el] of Object.entries(cloned.elements)) {
      const props = scrubValue(el.props ?? {}, `elements/${id}/props`) as Record<
        string,
        unknown
      >;
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
 * Remove sample / hex sections (and similar) from an invent prompt so a public
 * PR does not include the user's file bytes.
 */
export function scrubPromptForContrib(prompt: string | undefined): string | undefined {
  if (!prompt?.trim()) return prompt;
  let out = prompt;

  // Block sections produced by buildInventPrompt
  out = out.replace(
    /Sample text \(may be truncated[^)]*\):[\s\S]*?(?=\nHex preview|\nFile metadata:|\n---|\nTASK\b|$)/i,
    `Sample text:\n${REDACTED_SAMPLE}\n\n`,
  );
  out = out.replace(
    /Hex preview \(use in a Hex tab when useful\):[\s\S]*$/i,
    `Hex preview:\n${REDACTED_HEX}\n`,
  );
  // Older / edited prompts
  out = out.replace(
    /Sample text:[\s\S]*?(?=\nHex preview:|\nFile metadata:|$)/i,
    `Sample text:\n${REDACTED_SAMPLE}\n\n`,
  );
  out = out.replace(
    /Hex preview:[\s\S]*$/i,
    `Hex preview:\n${REDACTED_HEX}\n`,
  );

  // sourceUrl lines can leak private hosts
  out = out.replace(
    /- sourceUrl:\s*.+$/gim,
    '- sourceUrl: "(redacted)"',
  );

  return out.trimEnd() + "\n";
}
