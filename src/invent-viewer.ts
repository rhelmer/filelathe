import { createAnthropic } from "@ai-sdk/anthropic";
import { compileSpecStream, type Spec } from "@json-render/core";
import { generateText } from "ai";
import { catalog } from "./catalog";
import { hydrateInventedSpec } from "./invent-hydrate";
import { buildInventPrompt, type InventInput } from "./invent-prompt";

export type { InventInput };
export { buildInventPrompt };
export { hydrateInventedSpec };

export type InventSource = "haiku" | "fallback";

export type InventViewerResult = {
  spec: Spec;
  source: InventSource;
  prompt: string;
  reason?: string;
  /** True when Haiku could not be used (missing key or API failure). */
  modelUnavailable?: boolean;
};

function fenceMarkdown(language: string, body: string): string {
  const safe = body.replace(/```/g, "'''");
  return "```" + language + "\n" + safe + "\n```";
}

/** Deterministic Spec when Haiku is unavailable or returns invalid JSON. */
export function buildFallbackSpec(input: InventInput): Spec {
  const detected = input.filename.includes(".")
    ? input.filename.split(".").pop() || "txt"
    : "txt";
  const sample = input.sampleText?.trim() ?? "";
  const bodyMarkdown = sample
    ? fenceMarkdown(detected, sample.slice(0, 6000))
    : `_No text sample_ — showing hex preview instead.\n\n\`\`\`\n${input.hexPreview.slice(0, 1200)}\n\`\`\``;

  return {
    root: "card",
    elements: {
      card: {
        type: "Card",
        props: {
          title: null,
          description: null,
          maxWidth: "full",
          centered: null,
        },
        children: ["stack"],
      },
      stack: {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "md",
          align: "stretch",
          justify: "start",
        },
        children: ["meta", "body"],
      },
      meta: {
        type: "Text",
        props: {
          text: `${input.filename} · ${input.mimeType} · ${input.size} bytes`,
          variant: "muted",
        },
        children: [],
      },
      body: {
        type: "MarkdownView",
        props: {
          markdown: bodyMarkdown,
          title: null,
        },
        children: [],
      },
    },
  };
}

/** Strip markdown fences / noise so SpecStream lines are visible. */
export function normalizeInventOutput(raw: string): string {
  let text = raw.trim();
  if (!text) return "";
  text = text.replace(/^```(?:json|spec|jsonl)?\s*/i, "");
  text = text.replace(/```\s*$/i, "");
  return text.trim();
}

/**
 * Accept either a single Spec JSON object or SpecStream JSONL patches
 * (what catalog.prompt() teaches by default).
 */
export function parseInventedSpec(raw: string): unknown | null {
  const text = normalizeInventOutput(raw);
  if (!text) return null;

  // Single Spec object (one JSON value, not JSONL)
  if (text.startsWith("{") && !/"op"\s*:/.test(text)) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if (typeof obj.root === "string" && obj.elements) return obj;
    } catch {
      /* fall through */
    }
  }

  // SpecStream JSONL (possibly mixed with fences/prose)
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.includes('"op"'));
  if (lines.length > 0) {
    try {
      return compileSpecStream(lines.join("\n"));
    } catch {
      return null;
    }
  }

  // Last resort: first {...} that looks like a Spec
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      if (typeof obj.root === "string" && obj.elements) return obj;
    } catch {
      return null;
    }
  }

  return null;
}

const FORBIDDEN_TYPES = new Set([
  "InventedViewer",
  "SandboxedViewer",
  "BinaryInspector",
]);

/**
 * True when the prompt is a catalog Spec invent prompt (not the old
 * HTML highlighter prompt, which made Haiku return non-Spec output).
 */
export function isSpecInventPrompt(prompt: string | null | undefined): boolean {
  if (!prompt?.trim()) return false;
  if (/window\.__HIGHLIGHT__/.test(prompt)) return false;
  if (/TINY syntax highlighter/i.test(prompt)) return false;
  return (
    /AVAILABLE COMPONENTS/i.test(prompt) ||
    /Output ONLY JSONL patches/i.test(prompt) ||
    /json-render/i.test(prompt)
  );
}

export function resolveInventPrompt(
  input: InventInput,
  custom?: string | null,
): string {
  const trimmed = custom?.trim();
  if (trimmed && isSpecInventPrompt(trimmed)) return trimmed;
  return buildInventPrompt(input);
}

export function validateInventedSpec(
  value: unknown,
): { ok: true; spec: Spec } | { ok: false; error: string } {
  const result = catalog.validate(value);
  if (!result.success) {
    const issues = result.error?.issues?.slice(0, 5) ?? [];
    const detail = issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return {
      ok: false,
      error:
        detail || result.error?.message || "Spec failed catalog validation",
    };
  }
  const spec = result.data as Spec;
  for (const el of Object.values(spec.elements ?? {})) {
    if (FORBIDDEN_TYPES.has(el.type)) {
      return {
        ok: false,
        error: `Forbidden component type: ${el.type}`,
      };
    }
  }
  return { ok: true, spec };
}

/**
 * Ask Haiku for a catalog Spec (SpecStream or JSON); fall back to host Spec.
 */
export async function inventViewerSpec(
  input: InventInput,
  options: { signal?: AbortSignal; prompt?: string } = {},
): Promise<InventViewerResult> {
  const prompt = resolveInventPrompt(input, options.prompt);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const reason = "ANTHROPIC_API_KEY not set — Haiku unavailable";
    console.warn(`[invent-viewer] ${reason} — using fallback Spec.`);
    return {
      spec: buildFallbackSpec(input),
      source: "fallback",
      prompt,
      reason,
      modelUnavailable: true,
    };
  }

  try {
    const anthropic = createAnthropic({ apiKey });
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      abortSignal: options.signal,
      maxOutputTokens: 4096,
      prompt,
    });

    const parsed = parseInventedSpec(result.text);
    if (!parsed) {
      const reason = "Could not parse Spec/SpecStream from model output";
      console.warn(`[invent-viewer] ${reason} — fallback.`);
      console.warn(
        "[invent-viewer] raw head:",
        result.text.slice(0, 240).replace(/\s+/g, " "),
      );
      return {
        spec: buildFallbackSpec(input),
        source: "fallback",
        prompt,
        reason,
      };
    }

    // catalog.validate() strips `state` (not in the React schema) — preserve it,
    // then seed any missing $bindState/$state paths from the file.
    const rawState =
      parsed &&
      typeof parsed === "object" &&
      "state" in parsed &&
      (parsed as { state?: Spec["state"] }).state;

    const validated = validateInventedSpec(parsed);
    if (!validated.ok) {
      const reason = `Invalid Spec: ${validated.error}`;
      console.warn(`[invent-viewer] ${reason} — fallback.`);
      return {
        spec: buildFallbackSpec(input),
        source: "fallback",
        prompt,
        reason,
      };
    }

    const withState: Spec = {
      ...validated.spec,
      state: {
        ...(typeof rawState === "object" && rawState ? rawState : {}),
        ...(validated.spec.state ?? {}),
      },
    };

    return {
      spec: hydrateInventedSpec(withState, input),
      source: "haiku",
      prompt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = `Haiku request failed: ${message}`;
    console.warn(`[invent-viewer] ${reason}`);
    return {
      spec: buildFallbackSpec(input),
      source: "fallback",
      prompt,
      reason,
      modelUnavailable: true,
    };
  }
}
