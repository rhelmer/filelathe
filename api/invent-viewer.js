// src/compose-lib.ts
import {
  experimental_composeSpec
} from "@json-render/core";

// src/catalog.ts
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";
var dashboardExtras = {
  Metric: {
    props: z.object({
      label: z.string(),
      value: z.string(),
      change: z.string().nullable(),
      changeType: z.enum(["positive", "negative", "neutral"]).nullable(),
      prefix: z.string().nullable(),
      suffix: z.string().nullable()
    }),
    description: "Key metric / KPI display for dashboards"
  },
  BarGraph: {
    props: z.object({
      title: z.string().nullable(),
      data: z.array(z.object({ label: z.string(), value: z.number() }))
    }),
    description: "Vertical bar chart"
  },
  AudioPlayer: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable(),
      autoplay: z.boolean().nullable()
    }),
    events: ["play", "pause", "ended"],
    description: "HTML audio player with native transport controls for a loaded track"
  },
  PixelEditor: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable()
    }),
    description: "Canvas pixel editor for a loaded image: brush, colors, reset, download PNG"
  },
  Spreadsheet: {
    props: z.object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
      caption: z.string().nullable()
    }),
    description: "Editable spreadsheet for CSV data: edit cells, add rows/columns, download CSV"
  },
  PdfViewer: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable()
    }),
    description: "Embedded PDF viewer with open-in-new-tab link"
  },
  VideoPlayer: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable()
    }),
    description: "HTML video player with native transport controls"
  },
  TrackerPlayer: {
    props: z.object({
      moduleId: z.string(),
      title: z.string().nullable(),
      format: z.string(),
      channels: z.number().nullable()
    }),
    description: "libopenmpt / chiptune3 player for XM, MOD, IT, S3M and other tracker modules"
  },
  MarkdownView: {
    props: z.object({
      markdown: z.string(),
      title: z.string().nullable()
    }),
    description: "Rendered Markdown document with GFM (tables, strikethrough, task lists)"
  },
  WebPageViewer: {
    props: z.object({
      html: z.string(),
      sourceUrl: z.string().nullable(),
      title: z.string().nullable()
    }),
    description: "Fetched HTML webpage snapshot: sandboxed Preview iframe + Source tab + open-original link"
  },
  BinaryInspector: {
    props: z.object({
      filename: z.string(),
      mimeType: z.string(),
      size: z.number(),
      hexPreview: z.string(),
      sampleText: z.string().nullable(),
      note: z.string().nullable(),
      playerHint: z.string().nullable()
    }),
    description: "Hex/metadata inspector for opaque binaries and for formats whose emulator is planned but not wired. Never a fake emulator."
  },
  InventedViewer: {
    props: z.object({
      /**
       * Nested Spec as JSON string. Must be a string so the outer Renderer does
       * not deep-resolve $bindState/$state inside the invented Spec.
       */
      specJson: z.string(),
      note: z.string().nullable(),
      prompt: z.string(),
      invent: z.object({
        title: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        size: z.number(),
        sampleText: z.string().nullable(),
        hexPreview: z.string(),
        sourceUrl: z.string().nullable()
      })
    }),
    description: "Host wrapper: editable Haiku invent prompt + nested Renderer for an invented catalog Spec (pass Spec as specJson string). Do not nest InventedViewer inside invented Specs."
  }
};
function withoutClassName(definitions) {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => {
      const props = definition.props;
      if (!props.shape || !("className" in props.shape)) {
        return [name, definition];
      }
      return [name, { ...definition, props: props.omit({ className: true }) }];
    })
  );
}
var catalog = defineCatalog(schema, {
  components: {
    ...withoutClassName(shadcnComponentDefinitions),
    ...dashboardExtras
  },
  actions: {
    formSubmit: {
      description: "Validate form fields and show a demo toast (does not send data)",
      params: z.object({ formName: z.string() })
    }
  }
});

// src/invent-prompt.ts
function detectContentKind(filename, sampleText) {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";
  if (name.endsWith(".toml") || name.endsWith(".ini") || name.endsWith(".cfg")) {
    return {
      kind: "toml/ini config",
      language: "toml",
      hint: "Mini-app: Tabs for Overview (parsed key highlights as Badge/Text) | Edit (Textarea with full sample in state) | Raw. Prefer editing over a static dump."
    };
  }
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return {
      kind: "yaml",
      language: "yaml",
      hint: "Mini-app: Tabs Overview | Edit (Textarea bound to state) | Raw. Surface top-level keys as Badges."
    };
  }
  if (name.endsWith(".json") || name.endsWith(".jsonl") || sample.startsWith("{") || sample.startsWith("[")) {
    return {
      kind: "json",
      language: "json",
      hint: "Mini-app: Tabs Overview (Metrics/Badges for key fields) | Edit (Textarea with pretty JSON in state) | Raw. Not a single Markdown dump."
    };
  }
  if (name.endsWith(".xml") || name.endsWith(".html") || name.endsWith(".htm") || sample.startsWith("<")) {
    return {
      kind: "markup",
      language: "xml",
      hint: "Mini-app: Tabs Preview (MarkdownView fenced) | Edit (Textarea) | Structure notes (Alert). Keep editable."
    };
  }
  if (/\.lhs$/i.test(name)) {
    return {
      kind: "literate haskell",
      language: "haskell",
      hint: "Mini-app for literate Haskell: Tabs \u2014 Code (only lines starting with '>' stripped of the bird track, in a Textarea or fenced MarkdownView) | Literate (full sample) | Notes (Alert explaining bird-style '>' code vs prose). Put both views' text in Spec.state. Do NOT only show one static card with a tip."
    };
  }
  if (/\.hs$/i.test(name)) {
    return {
      kind: "haskell",
      language: "haskell",
      hint: "Mini-app: Tabs Code (Textarea/Markdown fence) | Exports (Badges for module/imports if present) | Raw. Editable source in state."
    };
  }
  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|swift|sql|css|scss|sh|bash|zsh)$/i.test(
    name
  )) {
    const language = name.split(".").pop() || "code";
    return {
      kind: "source code",
      language,
      hint: `Mini-app: Tabs Code (editable Textarea or Markdown fence for ${language}) | Symbols (Badges for imports/exports/functions if obvious from sample) | Raw. Source must live in Spec.state so it can be edited.`
    };
  }
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return {
      kind: "markdown",
      language: "markdown",
      hint: "Mini-app: Tabs Preview (MarkdownView) | Edit (Textarea bound to same markdown state). Two-way feel via shared state path."
    };
  }
  if (sample.length > 0) {
    return {
      kind: "text",
      language: "text",
      hint: "Mini-app: Tabs Text (editable Textarea) | Hex (Text with hexPreview). Avoid a single static paragraph."
    };
  }
  return {
    kind: "binary/unknown",
    language: "bin",
    hint: "Mini-app: metadata Stack + Hex Textarea/Text + Alert that no text decode was possible. Optional Badge for mime/size."
  };
}
function buildInventPrompt(input) {
  const sample = (input.sampleText ?? "").slice(0, 2400);
  const hex = input.hexPreview.slice(0, 800);
  const detected = detectContentKind(input.filename, input.sampleText);
  const catalogPrompt = catalog.prompt({
    mode: "standalone",
    system: "You invent a small interactive json-render mini-app Spec for an unrecognized dropped file \u2014 not a static dump viewer.",
    customRules: [
      "Never invent an emulator, CPU, disk controller, ROM runner, or game console. If the file needs one, the host will use BinaryInspector or a registered player instead.",
      "Never use InventedViewer or BinaryInspector (host wrappers).",
      "Do not use AudioPlayer, VideoPlayer, PdfViewer, PixelEditor, TrackerPlayer, Spreadsheet, or WebPageViewer unless the file data clearly fits and you inline all required props.",
      "Put file contents in Spec.state and bind Textarea / MarkdownView / Tabs via $bindState or $state. Every $bindState/$state path MUST appear in the top-level state object with a real initial value from the file sample.",
      'Example state: {"activeTab":"code","codeExtracted":"...","literateSource":"..."}.',
      "Build a MINI-APP, not a poster: prefer Tabs (or Accordion) with at least two panes \u2014 e.g. Preview/Code + Edit, or Overview + Raw.",
      "Card is only a border shell (title/description null \u2014 window chrome already shows the name).",
      "Do not invent fake file contents \u2014 copy from the sample (for .lhs Code tab, strip leading '>' bird tracks).",
      "Use Badge, Alert, Heading, Text, Separator for structure. Buttons are fine for secondary chrome (even if actions are no-ops).",
      "Typical size: 6\u201314 elements. Avoid a 3-element Card\u2192Markdown\u2192Alert dump.",
      "Every props field required by the catalog must be present (use null where nullable).",
      'Textarea/Input label must be a string (use "" if unlabeled), never null.',
      'Leaf elements must include "children": [].',
      "Nullable prop omissions: always include nullable keys with null rather than omitting them."
    ]
  });
  return `${catalogPrompt}

---

TASK
Invent an interactive mini-app Spec for this file. Follow SpecStream JSONL from the catalog prompt.

Goal: someone who dropped this file should be able to inspect AND work with it (switch views, edit text, see structured highlights) \u2014 not just read a summary card.

Detected: ${detected.kind} (language=${detected.language})
App guidance: ${detected.hint}

File metadata:
- title: ${JSON.stringify(input.title)}
- filename: ${JSON.stringify(input.filename)}
- mimeType: ${JSON.stringify(input.mimeType)}
- size: ${input.size} bytes
- sourceUrl: ${JSON.stringify(input.sourceUrl ?? null)}

Sample text (may be truncated; use as real content in state/props):
${sample || "(empty \u2014 binary or no decode)"}

Hex preview (use in a Hex tab when useful):
${hex || "(empty)"}
`;
}

// src/evaluator.ts
import {
  experimental_createEvaluator
} from "@json-render/core";
import { TypeSafeClient } from "@typesafe-ai/sdk";

// src/server/model-errors.ts
var ModelUnavailableError = class extends Error {
  model;
  status = 503;
  code = "model_unavailable";
  constructor(model, message) {
    super(message);
    this.name = "ModelUnavailableError";
    this.model = model;
  }
};
function isModelUnavailableError(error) {
  return error instanceof ModelUnavailableError;
}

// src/invent-viewer.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { compileSpecStream } from "@json-render/core";
import { generateText } from "ai";

// src/invent-hydrate.ts
function extractBirdCode(sample) {
  return sample.split("\n").filter((line) => line.startsWith(">")).map((line) => line.replace(/^>\s?/, "")).join("\n");
}
function fenceAs(language, body) {
  const safe = body.replace(/```/g, "'''");
  return "```" + language + "\n" + safe + "\n```";
}
function collectStatePaths(value, into) {
  if (Array.isArray(value)) {
    for (const item of value) collectStatePaths(item, into);
    return;
  }
  if (!value || typeof value !== "object") return;
  const obj = value;
  for (const [key, child] of Object.entries(obj)) {
    if ((key === "$bindState" || key === "$state") && typeof child === "string" && child.startsWith("/")) {
      into.add(child);
    } else {
      collectStatePaths(child, into);
    }
  }
}
function getByPointer(state, path) {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  let cur = state;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return void 0;
    cur = cur[part];
  }
  return cur;
}
function setByPointer(state, path, value) {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return;
  let cur = state;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = cur[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}
function defaultTabValue(spec) {
  for (const el of Object.values(spec.elements ?? {})) {
    if (el.type !== "Tabs") continue;
    const props = el.props;
    if (props.defaultValue) return props.defaultValue;
    if (props.tabs?.[0]?.value) return props.tabs[0].value;
  }
  return "code";
}
function seedValueForPath(path, input, tabDefault) {
  const leaf = path.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
  const sample = input.sampleText ?? "";
  const bird = extractBirdCode(sample);
  const lang = input.filename.includes(".") ? input.filename.split(".").pop() || "text" : "text";
  if (/^(active)?tab$/i.test(leaf) || leaf === "selectedtab") return tabDefault;
  if (/hex/i.test(leaf)) return input.hexPreview;
  if (/extract|bird/i.test(leaf) || leaf.includes("code") && !leaf.includes("source")) {
    return bird || sample;
  }
  if (/literate|raw|full|source|content|text|body|edit|markdown|sample|code/i.test(
    leaf
  )) {
    if (/markdown|preview/i.test(leaf) && sample) {
      return fenceAs(
        lang === "lhs" || lang === "hs" ? "haskell" : lang,
        sample
      );
    }
    return sample || input.hexPreview;
  }
  return sample || tabDefault;
}
function hydrateInventedSpec(spec, input) {
  const paths = /* @__PURE__ */ new Set();
  collectStatePaths(spec, paths);
  collectStatePaths(spec.elements, paths);
  const state = {
    ...spec.state ?? {}
  };
  const tabDefault = defaultTabValue(spec);
  for (const path of paths) {
    const existing = getByPointer(state, path);
    const leaf = path.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
    const forceLhsCode = /\.lhs$/i.test(input.filename) && /code|extract|bird/i.test(leaf);
    const forceFileContent = /source|code|text|content|raw|literate|markdown|body|edit|sample/i.test(
      leaf
    ) && typeof existing === "string" && existing.length === 0;
    if (forceLhsCode || forceFileContent || existing === void 0 || existing === "") {
      setByPointer(state, path, seedValueForPath(path, input, tabDefault));
    }
  }
  const elements = { ...spec.elements };
  for (const [key, el] of Object.entries(elements)) {
    const props = { ...el.props };
    if ((el.type === "Textarea" || el.type === "Input") && (props.label === null || props.label === void 0)) {
      props.label = "";
    }
    if ((el.type === "Textarea" || el.type === "Input") && props.checks === void 0) {
      props.checks = null;
    }
    elements[key] = {
      ...el,
      props,
      children: el.children ?? []
    };
  }
  return {
    ...spec,
    elements,
    state: Object.keys(state).length > 0 ? state : spec.state
  };
}

// src/invent-viewer.ts
function fenceMarkdown(language, body) {
  const safe = body.replace(/```/g, "'''");
  return "```" + language + "\n" + safe + "\n```";
}
function buildFallbackSpec(input) {
  const detected = input.filename.includes(".") ? input.filename.split(".").pop() || "txt" : "txt";
  const sample = input.sampleText?.trim() ?? "";
  const bodyMarkdown = sample ? fenceMarkdown(detected, sample.slice(0, 6e3)) : `_No text sample_ \u2014 showing hex preview instead.

\`\`\`
${input.hexPreview.slice(0, 1200)}
\`\`\``;
  return {
    root: "card",
    elements: {
      card: {
        type: "Card",
        props: {
          title: null,
          description: null,
          maxWidth: "full",
          centered: null
        },
        children: ["stack"]
      },
      stack: {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "md",
          align: "stretch",
          justify: "start"
        },
        children: ["meta", "body"]
      },
      meta: {
        type: "Text",
        props: {
          text: `${input.filename} \xB7 ${input.mimeType} \xB7 ${input.size} bytes`,
          variant: "muted"
        },
        children: []
      },
      body: {
        type: "MarkdownView",
        props: {
          markdown: bodyMarkdown,
          title: null
        },
        children: []
      }
    }
  };
}
function normalizeInventOutput(raw) {
  let text = raw.trim();
  if (!text) return "";
  text = text.replace(/^```(?:json|spec|jsonl)?\s*/i, "");
  text = text.replace(/```\s*$/i, "");
  return text.trim();
}
function parseInventedSpec(raw) {
  const text = normalizeInventOutput(raw);
  if (!text) return null;
  if (text.startsWith("{") && !/"op"\s*:/.test(text)) {
    try {
      const obj = JSON.parse(text);
      if (typeof obj.root === "string" && obj.elements) return obj;
    } catch {
    }
  }
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("{") && line.includes('"op"'));
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
      const obj = JSON.parse(text.slice(start, end + 1));
      if (typeof obj.root === "string" && obj.elements) return obj;
    } catch {
      return null;
    }
  }
  return null;
}
var FORBIDDEN_TYPES = /* @__PURE__ */ new Set([
  "InventedViewer",
  "SandboxedViewer",
  "BinaryInspector"
]);
function isSpecInventPrompt(prompt) {
  if (!prompt?.trim()) return false;
  if (/window\.__HIGHLIGHT__/.test(prompt)) return false;
  if (/TINY syntax highlighter/i.test(prompt)) return false;
  return /AVAILABLE COMPONENTS/i.test(prompt) || /Output ONLY JSONL patches/i.test(prompt) || /json-render/i.test(prompt);
}
function resolveInventPrompt(input, custom) {
  const trimmed = custom?.trim();
  if (trimmed && isSpecInventPrompt(trimmed)) return trimmed;
  return buildInventPrompt(input);
}
function validateInventedSpec(value) {
  const result = catalog.validate(value);
  if (!result.success) {
    const issues = result.error?.issues?.slice(0, 5) ?? [];
    const detail = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    return {
      ok: false,
      error: detail || result.error?.message || "Spec failed catalog validation"
    };
  }
  const spec = result.data;
  for (const el of Object.values(spec.elements ?? {})) {
    if (FORBIDDEN_TYPES.has(el.type)) {
      return {
        ok: false,
        error: `Forbidden component type: ${el.type}`
      };
    }
  }
  return { ok: true, spec };
}
async function inventViewerSpec(input, options = {}) {
  const prompt = resolveInventPrompt(input, options.prompt);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const reason = "ANTHROPIC_API_KEY not set \u2014 Haiku unavailable";
    console.warn(`[invent-viewer] ${reason} \u2014 using fallback Spec.`);
    return {
      spec: buildFallbackSpec(input),
      source: "fallback",
      prompt,
      reason,
      modelUnavailable: true
    };
  }
  try {
    const anthropic = createAnthropic({ apiKey });
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      abortSignal: options.signal,
      maxOutputTokens: 4096,
      prompt
    });
    const parsed = parseInventedSpec(result.text);
    if (!parsed) {
      const reason = "Could not parse Spec/SpecStream from model output";
      console.warn(`[invent-viewer] ${reason} \u2014 fallback.`);
      console.warn(
        "[invent-viewer] raw head:",
        result.text.slice(0, 240).replace(/\s+/g, " ")
      );
      return {
        spec: buildFallbackSpec(input),
        source: "fallback",
        prompt,
        reason
      };
    }
    const rawState = parsed && typeof parsed === "object" && "state" in parsed && parsed.state;
    const validated = validateInventedSpec(parsed);
    if (!validated.ok) {
      const reason = `Invalid Spec: ${validated.error}`;
      console.warn(`[invent-viewer] ${reason} \u2014 fallback.`);
      return {
        spec: buildFallbackSpec(input),
        source: "fallback",
        prompt,
        reason
      };
    }
    const withState = {
      ...validated.spec,
      state: {
        ...typeof rawState === "object" && rawState ? rawState : {},
        ...validated.spec.state ?? {}
      }
    };
    return {
      spec: hydrateInventedSpec(withState, input),
      source: "haiku",
      prompt
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
      modelUnavailable: true
    };
  }
}

// src/fetch-resource.ts
var MAX_BYTES = 15 * 1024 * 1024;

// src/server/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// src/server/kv.ts
function createMemoryKv() {
  const store = /* @__PURE__ */ new Map();
  function purgeExpired(key) {
    const entry = store.get(key);
    if (!entry) return;
    if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      store.delete(key);
    }
  }
  return {
    async get(key) {
      purgeExpired(key);
      return store.get(key)?.value ?? null;
    },
    async put(key, value, options) {
      const ttlSec = options?.expirationTtl;
      const expiresAt = typeof ttlSec === "number" && ttlSec > 0 ? Date.now() + ttlSec * 1e3 : null;
      store.set(key, { value, expiresAt });
    }
  };
}

// src/server/rate-limit.ts
var RATE_LIMITS = {
  invent: { max: 10, windowMs: 60 * 6e4 },
  // 10 / hour
  compose: { max: 60, windowMs: 60 * 6e4 },
  // 60 / hour
  fetch: { max: 30, windowMs: 60 * 6e4 }
  // 30 / hour
};
var memoryKv = createMemoryKv();
var upstashLimiters = /* @__PURE__ */ new Map();
function hasUpstash() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}
function upstashLimiter(bucket) {
  const existing = upstashLimiters.get(bucket);
  if (existing) return existing;
  const config = RATE_LIMITS[bucket];
  const windowSec = Math.max(1, Math.round(config.windowMs / 1e3));
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(config.max, `${windowSec} s`),
    prefix: `filelathe:${bucket}`,
    analytics: true
  });
  upstashLimiters.set(bucket, limiter);
  return limiter;
}
function kvTtlSeconds(windowMs) {
  return Math.max(60, Math.ceil(windowMs / 1e3) + 10);
}
async function enforceMemoryLimit(kv, bucket, clientKey, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const bucketKey = `rl:${bucket}:${clientKey}`;
  const raw = await kv.get(bucketKey);
  let timestamps = [];
  if (raw) {
    try {
      timestamps = JSON.parse(raw);
    } catch {
      timestamps = [];
    }
  }
  const valid = timestamps.filter((ts) => ts > windowStart);
  if (valid.length >= config.max) {
    const oldest = valid[0] ?? now;
    const retryAfter = Math.max(
      1,
      Math.ceil((oldest + config.windowMs - now) / 1e3)
    );
    return {
      allowed: false,
      status: 429,
      retryAfter,
      code: "rate_limit",
      error: `Rate limit exceeded for ${bucket} \u2014 try again in ${retryAfter}s.`
    };
  }
  valid.push(now);
  await kv.put(bucketKey, JSON.stringify(valid), {
    expirationTtl: kvTtlSeconds(config.windowMs)
  });
  return { allowed: true };
}
async function enforceRateLimit(bucket, clientKey, config = RATE_LIMITS[bucket]) {
  if (hasUpstash()) {
    const result = await upstashLimiter(bucket).limit(`${bucket}:${clientKey}`);
    if (!result.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1e3)
      );
      return {
        allowed: false,
        status: 429,
        retryAfter,
        code: "rate_limit",
        error: `Rate limit exceeded for ${bucket} \u2014 try again in ${retryAfter}s.`,
        pending: result.pending
      };
    }
    return { allowed: true, pending: result.pending };
  }
  return enforceMemoryLimit(memoryKv, bucket, clientKey, config);
}
function clientKeyFromHeaders(headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  return "local";
}

// src/server/http.ts
function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });
}
function errorResponse(status, error, options = {}) {
  const body = {
    error,
    code: options.code,
    retryAfter: options.retryAfter,
    model: options.model
  };
  const headers = {};
  if (typeof options.retryAfter === "number") {
    headers["Retry-After"] = String(options.retryAfter);
  }
  return jsonResponse(body, { status, headers });
}
async function withRateLimit(request, bucket, handler) {
  const clientKey = clientKeyFromHeaders(request.headers);
  const limit = await enforceRateLimit(bucket, clientKey);
  if (limit.pending) {
    void limit.pending.catch(() => void 0);
  }
  if (!limit.allowed) {
    return errorResponse(limit.status, limit.error, {
      code: limit.code,
      retryAfter: limit.retryAfter
    });
  }
  return handler();
}
function catchApiError(error) {
  if (isModelUnavailableError(error)) {
    return errorResponse(503, error.message, {
      code: "model_unavailable",
      model: error.model
    });
  }
  console.error(error);
  return errorResponse(
    500,
    error instanceof Error ? error.message : String(error),
    { code: "internal" }
  );
}
async function readJsonBody(request) {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

// src/server/handlers.ts
async function handleInventViewer(request) {
  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed", { code: "bad_request" });
  }
  return withRateLimit(request, "invent", async () => {
    try {
      const body = await readJsonBody(request);
      if (!body.filename || !body.mimeType || body.hexPreview == null) {
        return errorResponse(
          400,
          "filename, mimeType, and hexPreview are required",
          { code: "bad_request" }
        );
      }
      const result = await inventViewerSpec(
        {
          title: body.title ?? body.filename,
          filename: body.filename,
          mimeType: body.mimeType,
          size: body.size ?? 0,
          sampleText: body.sampleText ?? null,
          hexPreview: body.hexPreview,
          sourceUrl: body.sourceUrl ?? null
        },
        {
          signal: AbortSignal.timeout(9e4),
          prompt: body.prompt
        }
      );
      return jsonResponse(result);
    } catch (error) {
      return catchApiError(error);
    }
  });
}

// src/api-entries/invent-viewer.ts
var maxDuration = 300;
var invent_viewer_default = {
  async fetch(request) {
    return handleInventViewer(request);
  }
};
export {
  invent_viewer_default as default,
  maxDuration
};
