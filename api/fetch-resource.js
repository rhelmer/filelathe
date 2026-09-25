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
  SlideViewer: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable(),
      filename: z.string(),
      format: z.string(),
      note: z.string().nullable()
    }),
    description: "Client-side PPTX slide renderer (pptx-wasm): canvas slides with charts, images, and shapes. Classic .ppt stays on ArchiveBrowser. Never invent this."
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
  ArchiveBrowser: {
    props: z.object({
      archiveId: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      size: z.number(),
      format: z.string(),
      formatLabel: z.string(),
      entries: z.array(
        z.object({
          name: z.string(),
          size: z.number(),
          isDir: z.boolean()
        })
      ),
      peekText: z.string().nullable(),
      peekXml: z.string().nullable(),
      hexPreview: z.string(),
      note: z.string().nullable()
    }),
    description: "Browser for containers (ZIP/ODT/DOCX/XLSX/PPTX/EPUB/gzip/tar and classic OLE .doc/.xls/.ppt/.msg): entry listing, extracted document text, click-to-open an entry as its own window. Container bytes stay client-side; never invent this."
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

// src/archive.ts
import * as CFB from "cfb";
import { unzipSync } from "fflate";
var MAX_PEEK_BYTES = 4 * 1024 * 1024;
var ZIP_PACKAGES = {
  odt: { id: "odt", label: "OpenDocument Text" },
  ods: { id: "ods", label: "OpenDocument Sheet" },
  odp: { id: "odp", label: "OpenDocument Slides" },
  docx: { id: "docx", label: "Word Document" },
  xlsx: { id: "xlsx", label: "Excel Workbook" },
  pptx: { id: "pptx", label: "PowerPoint" },
  epub: { id: "epub", label: "EPUB Book" },
  jar: { id: "jar", label: "Java Archive" },
  war: { id: "jar", label: "Java Web Archive" },
  apk: { id: "zip", label: "Android Package" },
  zip: { id: "zip", label: "Zip Archive" }
};
var ZIP_PACKAGE_MIME = {
  "application/zip": ZIP_PACKAGES.zip,
  "application/vnd.oasis.opendocument.text": ZIP_PACKAGES.odt,
  "application/vnd.oasis.opendocument.spreadsheet": ZIP_PACKAGES.ods,
  "application/vnd.oasis.opendocument.presentation": ZIP_PACKAGES.odp,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ZIP_PACKAGES.docx,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ZIP_PACKAGES.xlsx,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ZIP_PACKAGES.pptx,
  "application/epub+zip": ZIP_PACKAGES.epub,
  "application/java-archive": ZIP_PACKAGES.jar
};
var OLE_PACKAGES = {
  doc: { id: "doc", label: "Word 97\u20132003" },
  dot: { id: "doc", label: "Word 97\u20132003 Template" },
  xls: { id: "xls", label: "Excel 97\u20132003" },
  xlt: { id: "xls", label: "Excel 97\u20132003 Template" },
  xlm: { id: "xls", label: "Excel 97\u20132003" },
  ppt: { id: "ppt", label: "PowerPoint 97\u20132003" },
  pot: { id: "ppt", label: "PowerPoint 97\u20132003 Template" },
  pps: { id: "ppt", label: "PowerPoint 97\u20132003 Show" },
  msg: { id: "msg", label: "Outlook Message" },
  msi: { id: "ole", label: "Windows Installer" }
};
var OLE_PACKAGE_MIME = {
  "application/msword": OLE_PACKAGES.doc,
  "application/vnd.ms-word": OLE_PACKAGES.doc,
  "application/vnd.ms-excel": OLE_PACKAGES.xls,
  "application/vnd.ms-powerpoint": OLE_PACKAGES.ppt,
  "application/vnd.ms-outlook": OLE_PACKAGES.msg,
  "application/x-msi": OLE_PACKAGES.msi
};

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

// src/office.ts
import * as CFB2 from "cfb";
import { unzipSync as unzipSync2 } from "fflate";
import * as XLSX from "xlsx";

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

// src/safe-fetch-url.ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
var BLOCKED_HOSTNAMES = /* @__PURE__ */ new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "metadata"
]);
var BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal"];
var FetchResourceError = class extends Error {
  status;
  constructor(message, status = 400, options) {
    super(message, options?.cause !== void 0 ? { cause: options.cause } : void 0);
    this.name = "FetchResourceError";
    this.status = status;
  }
};
function isPublicIp(address) {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}
function ipv4ToInt(address) {
  const parts = address.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new FetchResourceError("Invalid remote URL.");
  }
  return (parts[0] << 24 >>> 0) + (parts[1] << 16 >>> 0) + (parts[2] << 8 >>> 0) + (parts[3] >>> 0) >>> 0;
}
function inCidr(ip, base, prefix) {
  const baseInt = ipv4ToInt(base);
  const mask = prefix === 0 ? 0 : ~0 << 32 - prefix >>> 0;
  return (ip & mask) === (baseInt & mask);
}
function isPublicIpv4(address) {
  let ip;
  try {
    ip = ipv4ToInt(address);
  } catch {
    return false;
  }
  const blocked = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4]
  ];
  for (const [base, prefix] of blocked) {
    if (inCidr(ip, base, prefix)) return false;
  }
  if (ip === 4294967295) return false;
  return true;
}
function expandIpv6(address) {
  let addr = address.toLowerCase();
  if (addr.startsWith("::ffff:")) {
    const mapped = addr.slice(7);
    if (isIP(mapped) === 4) {
      const parts = mapped.split(".").map(Number);
      const hi = (parts[0] << 8 | parts[1]).toString(16);
      const lo = (parts[2] << 8 | parts[3]).toString(16);
      addr = `0:0:0:0:0:ffff:${hi}:${lo}`;
    }
  }
  const [left, right = ""] = addr.split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const missing = 8 - leftParts.length - rightParts.length;
  const filled = [
    ...leftParts,
    ...Array.from({ length: Math.max(0, missing) }, () => "0"),
    ...rightParts
  ];
  while (filled.length < 8) filled.push("0");
  return filled.slice(0, 8).map((h) => h.padStart(4, "0")).join(":");
}
function isPublicIpv6(address) {
  if (address.toLowerCase().includes(".")) {
    const m = /:ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (m) return isPublicIpv4(m[1]);
  }
  let expanded;
  try {
    expanded = expandIpv6(address);
  } catch {
    return false;
  }
  const hextets = expanded.split(":").map((h) => parseInt(h, 16));
  if (hextets.length !== 8 || hextets.some((n) => Number.isNaN(n))) return false;
  if (hextets.every((h) => h === 0)) return false;
  if (hextets[0] === 0 && hextets[1] === 0 && hextets[2] === 0 && hextets[3] === 0 && hextets[4] === 0 && hextets[5] === 0 && hextets[6] === 0 && hextets[7] === 1) {
    return false;
  }
  if (hextets[0] === 0 && hextets[1] === 0 && hextets[2] === 0 && hextets[3] === 0 && hextets[4] === 0 && hextets[5] === 65535) {
    const a = hextets[6] >> 8 & 255;
    const b = hextets[6] & 255;
    const c = hextets[7] >> 8 & 255;
    const d = hextets[7] & 255;
    return isPublicIpv4(`${a}.${b}.${c}.${d}`);
  }
  if ((hextets[0] & 65024) === 64512) return false;
  if ((hextets[0] & 65472) === 65152) return false;
  if ((hextets[0] & 65280) === 65280) return false;
  return true;
}
function hostnameFromUrl(url) {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}
function isBlockedHostname(hostname) {
  if (!hostname) return true;
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) return true;
  }
  return false;
}
async function assertSafeFetchUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  let url;
  try {
    url = new URL(trimmed);
  } catch (cause) {
    throw new FetchResourceError("Invalid remote URL.", 400, { cause });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchResourceError("Only http(s) URLs are supported.");
  }
  if (url.username || url.password) {
    throw new FetchResourceError("URLs with credentials are not allowed.");
  }
  const hostname = hostnameFromUrl(url);
  if (isBlockedHostname(hostname)) {
    throw new FetchResourceError("That host is not allowed.");
  }
  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (!isPublicIp(hostname)) {
      throw new FetchResourceError("That address is not allowed.");
    }
    return url;
  }
  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch (cause) {
    throw new FetchResourceError("Could not resolve host.", 400, { cause });
  }
  if (!records.length) {
    throw new FetchResourceError("Could not resolve host.");
  }
  for (const record of records) {
    if (!isPublicIp(record.address)) {
      throw new FetchResourceError("That host is not allowed.");
    }
  }
  return url;
}

// src/fetch-resource.ts
var MAX_BYTES = 15 * 1024 * 1024;
var MAX_REDIRECTS = 5;
var FETCH_TIMEOUT_MS = 3e4;
function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
async function readBodyCapped(response, maxBytes) {
  const contentLength = response.headers.get("content-length");
  if (contentLength != null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => void 0);
      throw new FetchResourceError(
        `Remote resource is too large (max ${maxBytes} bytes).`
      );
    }
  }
  if (!response.body) {
    return Buffer.alloc(0);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => void 0);
        throw new FetchResourceError(
          `Remote resource is too large (max ${maxBytes} bytes).`
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof FetchResourceError) throw error;
    throw new FetchResourceError("Could not fetch remote resource.", 502, {
      cause: error
    });
  }
  return Buffer.concat(chunks);
}
async function fetchRemoteResource(rawUrl, options = {}) {
  const requested = rawUrl.trim();
  if (!isProbablyUrl(requested)) {
    throw new FetchResourceError("Only http(s) URLs are supported.");
  }
  const parentSignal = options.signal;
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal = parentSignal != null ? AbortSignal.any([parentSignal, timeout]) : timeout;
  let current = await assertSafeFetchUrl(requested);
  const originalUrl = current.href;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response;
    try {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          Accept: "*/*",
          "User-Agent": "filelathe/0.1"
        }
      });
    } catch (error) {
      if (error instanceof FetchResourceError) throw error;
      if (signal.aborted) {
        throw new FetchResourceError("Fetch timed out.", 504, { cause: error });
      }
      throw new FetchResourceError("Could not fetch remote resource.", 502, {
        cause: error
      });
    }
    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => void 0);
      if (!location) {
        throw new FetchResourceError("Could not fetch remote resource.", 502);
      }
      let nextHref;
      try {
        nextHref = new URL(location, current).href;
      } catch (cause) {
        throw new FetchResourceError("Could not fetch remote resource.", 502, {
          cause
        });
      }
      if (hop === MAX_REDIRECTS) {
        throw new FetchResourceError("Too many redirects.");
      }
      current = await assertSafeFetchUrl(nextHref);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => void 0);
      throw new FetchResourceError("Could not fetch remote resource.", 502);
    }
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    const buffer = await readBodyCapped(response, MAX_BYTES);
    return {
      url: originalUrl,
      name: filenameFromUrl(originalUrl),
      mimeType,
      size: buffer.byteLength,
      base64: buffer.toString("base64")
    };
  }
  throw new FetchResourceError("Too many redirects.");
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
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
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
      if (error instanceof FetchResourceError) {
        console.error(error);
        return errorResponse(error.status, error.message, {
          code: error.status >= 500 ? "internal" : "bad_request"
        });
      }
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
