import { createAnthropic } from "@ai-sdk/anthropic";
import { compileSpecStream, type Spec } from "@json-render/core";
import { generateText } from "ai";
import { inventCatalog } from "./invent-catalog";
import { hydrateInventedSpec } from "./invent-hydrate";
import {
  assessInventedSpecQuality,
  formatQualityIssues,
} from "./invent-quality";
import {
  buildInventPrompt,
  buildInventRepairPrompt,
  type InventInput,
} from "./invent-prompt";

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
  /** Set when a repair pass recovered a Spec. */
  repaired?: boolean;
};

/**
 * Deterministic mini-app when Haiku is unavailable or still invalid after repair.
 * Uses Tabs Text|Hex (or Hex|Notes for binary) — not a poster dump.
 */
export function buildFallbackSpec(input: InventInput): Spec {
  const sample = input.sampleText?.trim() ?? "";
  const hasText = sample.length > 0;
  const body = hasText ? sample.slice(0, 6000) : "";
  const hex = input.hexPreview.slice(0, 4000) || "(no hex preview)";

  if (hasText) {
    return {
      root: "card",
      state: {
        activeTab: "text",
        body,
        hex,
      },
      elements: {
        card: {
          type: "Card",
          props: {
            title: null,
            description: null,
            maxWidth: "full",
            centered: null,
          },
          children: ["meta", "tabs"],
        },
        meta: {
          type: "Text",
          props: {
            text: `${input.filename} · ${input.mimeType} · ${input.size} bytes`,
            variant: "muted",
          },
          children: [],
        },
        tabs: {
          type: "Tabs",
          props: {
            defaultValue: "text",
            value: { $bindState: "/activeTab" },
            tabs: [
              { label: "Text", value: "text" },
              { label: "Hex", value: "hex" },
            ],
          },
          children: ["paneText", "paneHex"],
        },
        paneText: {
          type: "Textarea",
          props: {
            label: "Contents",
            name: "body",
            placeholder: null,
            rows: 12,
            checks: null,
            validateOn: null,
            value: { $bindState: "/body" },
          },
          children: [],
        },
        paneHex: {
          type: "Textarea",
          props: {
            label: "Hex",
            name: "hex",
            placeholder: null,
            rows: 10,
            checks: null,
            validateOn: null,
            value: { $bindState: "/hex" },
          },
          children: [],
        },
      },
    };
  }

  return {
    root: "card",
    state: {
      activeTab: "hex",
      hex,
    },
    elements: {
      card: {
        type: "Card",
        props: {
          title: null,
          description: null,
          maxWidth: "full",
          centered: null,
        },
        children: ["meta", "tabs"],
      },
      meta: {
        type: "Text",
        props: {
          text: `${input.filename} · ${input.mimeType} · ${input.size} bytes`,
          variant: "muted",
        },
        children: [],
      },
      tabs: {
        type: "Tabs",
        props: {
          defaultValue: "hex",
          value: { $bindState: "/activeTab" },
          tabs: [
            { label: "Hex", value: "hex" },
            { label: "Notes", value: "notes" },
          ],
        },
        children: ["paneHex", "paneNotes"],
      },
      paneHex: {
        type: "Textarea",
        props: {
          label: "Hex",
          name: "hex",
          placeholder: null,
          rows: 12,
          checks: null,
          validateOn: null,
          value: { $bindState: "/hex" },
        },
        children: [],
      },
      paneNotes: {
        type: "Alert",
        props: {
          title: "Binary / unknown",
          message:
            "No decodable text sample — hex preview only (host fallback).",
          type: "info",
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

  if (text.startsWith("{") && !/"op"\s*:/.test(text)) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if (typeof obj.root === "string" && obj.elements) return obj;
    } catch {
      /* fall through */
    }
  }

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
  "AudioPlayer",
  "VideoPlayer",
  "PdfViewer",
  "PixelEditor",
  "TrackerPlayer",
  "Spreadsheet",
  "WebPageViewer",
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
  const result = inventCatalog.validate(value);
  if (!result.success) {
    const issues = result.error?.issues?.slice(0, 5) ?? [];
    const detail = issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return {
      ok: false,
      error:
        detail ||
        result.error?.message ||
        "Spec failed invent catalog validation",
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
    if (!inventCatalog.componentNames.includes(el.type)) {
      return {
        ok: false,
        error: `Component not in invent catalog: ${el.type}`,
      };
    }
  }
  return { ok: true, spec };
}

type AcceptResult =
  | { ok: true; spec: Spec }
  | { ok: false; error: string };

function acceptInventedRaw(parsed: unknown): AcceptResult {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Parsed value is not an object" };
  }
  const rawState =
    "state" in parsed
      ? (parsed as { state?: Spec["state"] }).state
      : undefined;

  const validated = validateInventedSpec(parsed);
  if (!validated.ok) return validated;

  const withState: Spec = {
    ...validated.spec,
    state: {
      ...(typeof rawState === "object" && rawState ? rawState : {}),
      ...(validated.spec.state ?? {}),
    },
  };

  const quality = assessInventedSpecQuality(withState);
  if (quality.length > 0) {
    return { ok: false, error: formatQualityIssues(quality) };
  }

  return { ok: true, spec: withState };
}

async function callHaiku(
  prompt: string,
  options: { signal?: AbortSignal; apiKey: string },
): Promise<string> {
  const anthropic = createAnthropic({ apiKey: options.apiKey });
  const result = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    abortSignal: options.signal,
    maxOutputTokens: 4096,
    prompt,
  });
  return result.text;
}

/**
 * Ask Haiku for a catalog Spec (SpecStream or JSON); repair once on failure;
 * fall back to host Spec.
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
      spec: hydrateInventedSpec(buildFallbackSpec(input), input),
      source: "fallback",
      prompt,
      reason,
      modelUnavailable: true,
    };
  }

  try {
    const firstRaw = await callHaiku(prompt, {
      signal: options.signal,
      apiKey,
    });
    const firstParsed = parseInventedSpec(firstRaw);
    if (firstParsed) {
      const accepted = acceptInventedRaw(firstParsed);
      if (accepted.ok) {
        return {
          spec: hydrateInventedSpec(accepted.spec, input),
          source: "haiku",
          prompt,
        };
      }
      console.warn(
        `[invent-viewer] first pass rejected — ${accepted.error}; attempting repair.`,
      );

      const repairPrompt = buildInventRepairPrompt({
        basePrompt: prompt,
        previousOutput: firstRaw,
        errors: accepted.error,
      });
      const repairRaw = await callHaiku(repairPrompt, {
        signal: options.signal,
        apiKey,
      });
      const repairParsed = parseInventedSpec(repairRaw);
      if (repairParsed) {
        const repaired = acceptInventedRaw(repairParsed);
        if (repaired.ok) {
          console.warn("[invent-viewer] repair succeeded.");
          return {
            spec: hydrateInventedSpec(repaired.spec, input),
            source: "haiku",
            prompt,
            repaired: true,
          };
        }
        console.warn(
          `[invent-viewer] repair still invalid — ${repaired.error} — fallback.`,
        );
        return {
          spec: hydrateInventedSpec(buildFallbackSpec(input), input),
          source: "fallback",
          prompt,
          reason: `Invalid Spec after repair: ${repaired.error}`,
        };
      }
      console.warn("[invent-viewer] repair could not parse Spec — fallback.");
      return {
        spec: hydrateInventedSpec(buildFallbackSpec(input), input),
        source: "fallback",
        prompt,
        reason: "Could not parse Spec after repair",
      };
    }

    console.warn(
      "[invent-viewer] could not parse first output — attempting repair.",
    );
    console.warn(
      "[invent-viewer] raw head:",
      firstRaw.slice(0, 240).replace(/\s+/g, " "),
    );
    const repairPrompt = buildInventRepairPrompt({
      basePrompt: prompt,
      previousOutput: firstRaw,
      errors: "Could not parse Spec/SpecStream from model output",
    });
    const repairRaw = await callHaiku(repairPrompt, {
      signal: options.signal,
      apiKey,
    });
    const repairParsed = parseInventedSpec(repairRaw);
    if (repairParsed) {
      const repaired = acceptInventedRaw(repairParsed);
      if (repaired.ok) {
        return {
          spec: hydrateInventedSpec(repaired.spec, input),
          source: "haiku",
          prompt,
          repaired: true,
        };
      }
    }

    return {
      spec: hydrateInventedSpec(buildFallbackSpec(input), input),
      source: "fallback",
      prompt,
      reason: "Could not parse Spec/SpecStream from model output",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = `Haiku request failed: ${message}`;
    console.warn(`[invent-viewer] ${reason}`);
    return {
      spec: hydrateInventedSpec(buildFallbackSpec(input), input),
      source: "fallback",
      prompt,
      reason,
      modelUnavailable: true,
    };
  }
}
