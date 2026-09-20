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

// src/invent-catalog.ts
import { defineCatalog as defineCatalog2 } from "@json-render/core";
import { schema as schema2 } from "@json-render/react/schema";
import { shadcnComponentDefinitions as shadcnComponentDefinitions2 } from "@json-render/shadcn/catalog";
import { z as z2 } from "zod";
var INVENT_SHADCN = [
  "Card",
  "Stack",
  "Grid",
  "Separator",
  "Tabs",
  "Accordion",
  "Heading",
  "Text",
  "Badge",
  "Alert",
  "Input",
  "Textarea",
  "Button",
  "Link"
];
function pickShadcn(names) {
  const all = shadcnComponentDefinitions2;
  const out = {};
  for (const name of names) {
    const def = all[name];
    if (!def) continue;
    const props = def.props;
    if (props?.shape && "className" in props.shape) {
      out[name] = { ...def, props: props.omit({ className: true }) };
    } else {
      out[name] = def;
    }
  }
  return out;
}
var inventExtras = {
  MarkdownView: {
    props: z2.object({
      markdown: z2.string(),
      title: z2.string().nullable()
    }),
    description: "Rendered Markdown (GFM). Prefer for Preview panes; put body in Spec.state and $bindState when editable elsewhere."
  },
  Metric: {
    props: z2.object({
      label: z2.string(),
      value: z2.string(),
      change: z2.string().nullable(),
      changeType: z2.enum(["positive", "negative", "neutral"]).nullable(),
      prefix: z2.string().nullable(),
      suffix: z2.string().nullable()
    }),
    description: "Small KPI chip for Overview panes (file size, key count, etc.)"
  }
};
var inventCatalog = defineCatalog2(schema2, {
  components: {
    ...pickShadcn(INVENT_SHADCN),
    ...inventExtras
  },
  actions: {
    formSubmit: {
      description: "Demo form toast (no network)",
      params: z2.object({ formName: z2.string() })
    }
  }
});
var INVENT_COMPONENT_NAMES = inventCatalog.componentNames;

// src/resource-utils.ts
function isProbablyUrl(value) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
    return parsed.hostname.replace(/^www\./, "") || "link";
  } catch {
    return "link";
  }
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

// src/fetch-resource.ts
var MAX_BYTES = 15 * 1024 * 1024;
async function fetchRemoteResource(rawUrl, options = {}) {
  const url = rawUrl.trim();
  if (!isProbablyUrl(url)) {
    throw new Error("Only http(s) URLs are supported.");
  }
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: options.signal ?? AbortSignal.timeout(3e4),
    headers: {
      Accept: "*/*",
      "User-Agent": "filelathe/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Remote resource is too large (${buffer.byteLength} bytes; max ${MAX_BYTES}).`
    );
  }
  return {
    url,
    name: filenameFromUrl(url),
    mimeType,
    size: buffer.byteLength,
    base64: buffer.toString("base64")
  };
}

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
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  return Boolean(url && token);
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
  if (process.env.FILELATHE_DISABLE_RATE_LIMIT === "1") {
    return { allowed: true };
  }
  const onVercel = Boolean(process.env.VERCEL);
  if (hasUpstash() && onVercel) {
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
async function handleFetchResource(request) {
  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed", { code: "bad_request" });
  }
  return withRateLimit(request, "fetch", async () => {
    try {
      const body = await readJsonBody(request);
      if (!body.url) {
        return errorResponse(400, "url is required", { code: "bad_request" });
      }
      const resource = await fetchRemoteResource(body.url, {
        signal: AbortSignal.timeout(3e4)
      });
      return jsonResponse(resource);
    } catch (error) {
      return catchApiError(error);
    }
  });
}

// src/api-entries/fetch-resource.ts
var maxDuration = 60;
var fetch_resource_default = {
  async fetch(request) {
    return handleFetchResource(request);
  }
};
export {
  fetch_resource_default as default,
  maxDuration
};
