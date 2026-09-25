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
    description: "HTML webpage snapshot: sandboxed Preview iframe + Source tab + open-original link"
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
  WadBrowser: {
    props: z.object({
      wadId: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      size: z.number(),
      identification: z.enum(["IWAD", "PWAD"]),
      formatLabel: z.string(),
      lumpCount: z.number(),
      mapCount: z.number(),
      mapNames: z.array(z.string()),
      note: z.string().nullable()
    }),
    description: "Doom IWAD/PWAD lump directory: map markers, text lumps, and a per-lump text or hex peek. Not an emulator. WAD bytes stay client-side; never invent this and never send the file to the hex inspector."
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
import { Inflate, Unzip, UnzipPassThrough } from "fflate";
var MAX_PEEK_BYTES = 4 * 1024 * 1024;
var MAX_INFLATE_BYTES = 32 * 1024 * 1024;
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

// src/invent-prompt.ts
function countMatches(sample, re) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return [...sample.matchAll(new RegExp(re.source, flags))].length;
}
function xmlRootTag(sample) {
  const m = sample.match(/<\s*([A-Za-z_][\w:.-]*)\b/);
  return m?.[1]?.toLowerCase() ?? null;
}
function xmlLocalName(tag) {
  if (!tag) return null;
  const i = tag.indexOf(":");
  return i >= 0 ? tag.slice(i + 1) : tag;
}
function analyzeFileSample(filename, sampleText, size) {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";
  const facts = [`Filename: ${filename}`, `Size: ${size} bytes`];
  const checks = [];
  const metrics = [
    { label: "Size", value: `${size} B` }
  ];
  if (!sample) {
    return {
      identity: "binary or empty sample",
      facts: [...facts, "No decodable text sample in the first bytes."],
      checks: [
        "Cannot validate structure without a text decode \u2014 use Hex + Meta only."
      ],
      metrics,
      summaryMarkdown: "## Unknown / binary\n\nNo text sample was decoded. Use the Hex tab for a byte preview."
    };
  }
  const root = xmlRootTag(sample);
  const local = xmlLocalName(root);
  if (name.includes("sitemap") || local === "urlset" || local === "sitemapindex" || /xmlns=["']https?:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(
    sample
  )) {
    const isIndex = local === "sitemapindex" || /<sitemapindex\b/i.test(sample);
    const urlCount = countMatches(sample, /<url\b/i);
    const sitemapCount = countMatches(sample, /<sitemap\b/i);
    const locCount = countMatches(sample, /<loc\b/i);
    const hasNs = /sitemaps\.org\/schemas\/sitemap/i.test(sample);
    const locs = [...sample.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1].trim()).slice(0, 8);
    facts.push(
      isIndex ? "Looks like a sitemap index (sitemapindex)." : "Looks like a URL sitemap (urlset).",
      hasNs ? "Declares the standard sitemaps.org 0.9 namespace." : "Missing or non-standard sitemaps.org namespace.",
      `Counted <loc>: ${locCount}; <url>: ${urlCount}; <sitemap>: ${sitemapCount}.`
    );
    if (locs.length) {
      facts.push(`First locations: ${locs.join(" \xB7 ")}`);
    }
    if (!hasNs) {
      checks.push(
        'Warn: sitemap protocol usually uses xmlns="http://www.sitemaps.org/schemas/sitemap/0.9".'
      );
    }
    if (isIndex && sitemapCount === 0) {
      checks.push("Sitemap index has no <sitemap> children in the sample.");
    }
    if (!isIndex && urlCount === 0 && locCount === 0) {
      checks.push("No <url>/<loc> entries visible in the sample (truncated?).");
    }
    if (sample.includes("<") && !sample.includes(`</${local}`)) {
      checks.push(
        "Sample may be truncated \u2014 closing root tag not seen; treat counts as lower bounds."
      );
    }
    checks.push(
      sample.startsWith("<") || sample.startsWith("<?xml") ? "Opens like XML (good)." : "Does not start with XML prologue or < \u2014 may be malformed."
    );
    metrics.push(
      { label: "Type", value: isIndex ? "index" : "urlset" },
      { label: "URLs", value: String(isIndex ? sitemapCount : Math.max(urlCount, locCount)) },
      { label: "locs", value: String(locCount) }
    );
    const identity = isIndex ? "XML sitemap index" : "XML sitemap (urlset)";
    const summaryMarkdown = [
      `## ${identity}`,
      "",
      isIndex ? "A **sitemap index** lists other sitemap files for crawlers (Google Search Console, etc.)." : "A **urlset sitemap** lists page URLs for search-engine crawlers.",
      "",
      "### Checks",
      ...checks.map((c) => `- ${c}`),
      "",
      "### Sample locations",
      ...locs.length ? locs.map((u) => `- ${u}`) : ["- (none in sample)"]
    ].join("\n");
    return { identity, facts, checks, metrics, summaryMarkdown };
  }
  if (local === "rss" || local === "feed" || /<rss\b/i.test(sample) || /<feed\b[^>]*xmlns=["'][^"']*Atom/i.test(sample)) {
    const isAtom = local === "feed" || /<feed\b/i.test(sample);
    const items = isAtom ? countMatches(sample, /<entry\b/i) : countMatches(sample, /<item\b/i);
    const title = sample.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i)?.[1]?.trim() ?? null;
    facts.push(
      isAtom ? "Looks like an Atom feed." : "Looks like an RSS feed.",
      `Entry/item count in sample: ${items}.`
    );
    if (title) facts.push(`Feed title: ${title}`);
    checks.push(
      items > 0 ? "Contains entries/items in the sample." : "No entries/items visible \u2014 empty feed or truncated sample."
    );
    metrics.push(
      { label: "Format", value: isAtom ? "Atom" : "RSS" },
      { label: "Items", value: String(items) }
    );
    const identity = isAtom ? "Atom feed" : "RSS feed";
    return {
      identity,
      facts,
      checks,
      metrics,
      summaryMarkdown: [
        `## ${identity}`,
        "",
        title ? `**Title:** ${title}` : "",
        "",
        "### Checks",
        ...checks.map((c) => `- ${c}`)
      ].filter(Boolean).join("\n")
    };
  }
  if (name.endsWith(".svg") || local === "svg") {
    const w = sample.match(/\bwidth=["']([^"']+)["']/i)?.[1];
    const h = sample.match(/\bheight=["']([^"']+)["']/i)?.[1];
    const vb = sample.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
    facts.push("Scalable Vector Graphics document.");
    if (w || h) facts.push(`width=${w ?? "?"} height=${h ?? "?"}`);
    if (vb) facts.push(`viewBox=${vb}`);
    checks.push(
      /<svg\b/i.test(sample) ? "Has an <svg> root." : "Missing <svg> root in sample."
    );
    metrics.push({ label: "Format", value: "SVG" });
    return {
      identity: "SVG image markup",
      facts,
      checks,
      metrics,
      summaryMarkdown: [
        "## SVG",
        "",
        "Vector graphic markup. Prefer Source edit + a short Overview; Hex is useless here.",
        "",
        "### Checks",
        ...checks.map((c) => `- ${c}`)
      ].join("\n")
    };
  }
  if (name.endsWith(".xml") || name.endsWith(".plist") || sample.startsWith("<?xml") || sample.startsWith("<") && /<\/[A-Za-z_][\w:.-]*>/.test(sample)) {
    const tags = [
      ...new Set(
        [...sample.matchAll(/<\s*([A-Za-z_][\w:.-]*)\b/g)].map(
          (m) => m[1].toLowerCase()
        )
      )
    ].slice(0, 12);
    facts.push(
      root ? `Root / first tag: <${root}>` : "No clear root tag.",
      tags.length ? `Tags seen: ${tags.join(", ")}` : "Few tags parsed."
    );
    checks.push(
      sample.includes("<?xml") ? "Has XML declaration." : "No XML declaration (optional but common)."
    );
    if (root && !sample.includes(`</${root.split(":").pop()}`)) {
      checks.push("Closing root tag not found \u2014 sample may be truncated.");
    }
    metrics.push(
      { label: "Root", value: root ?? "?" },
      { label: "Tags", value: String(tags.length) }
    );
    return {
      identity: root ? `XML document (<${root}>)` : "XML document",
      facts,
      checks,
      metrics,
      summaryMarkdown: [
        `## XML${root ? ` \u2014 \`<${root}>\`` : ""}`,
        "",
        "Explain what this dialect is if recognizable (config, export, feed, \u2026). Surface structure on Overview; keep full markup on Source.",
        "",
        "### Checks",
        ...checks.map((c) => `- ${c}`),
        "",
        "### Tags in sample",
        tags.map((t) => `- \`${t}\``).join("\n") || "- (none)"
      ].join("\n")
    };
  }
  if (name === "robots.txt" || /^user-agent:/im.test(sample)) {
    const agents = countMatches(sample, /^user-agent:/im);
    const sitemaps = [
      ...sample.matchAll(/^sitemap:\s*(\S+)/gim)
    ].map((m) => m[1]);
    facts.push(`User-agent directives: ${agents}.`);
    if (sitemaps.length) facts.push(`Sitemap refs: ${sitemaps.join(", ")}`);
    checks.push(
      agents > 0 ? "Has User-agent rules." : "No User-agent line \u2014 may be incomplete."
    );
    metrics.push(
      { label: "Agents", value: String(agents) },
      { label: "Sitemaps", value: String(sitemaps.length) }
    );
    return {
      identity: "robots.txt",
      facts,
      checks,
      metrics,
      summaryMarkdown: [
        "## robots.txt",
        "",
        "Crawler policy file. Overview should list agents + sitemap URLs; Source is the editable body.",
        "",
        "### Checks",
        ...checks.map((c) => `- ${c}`),
        ...sitemaps.length ? ["", "### Sitemap references", ...sitemaps.map((u) => `- ${u}`)] : []
      ].join("\n")
    };
  }
  if (name.endsWith(".json") || name.endsWith(".jsonl") || name.endsWith(".jsonc") || sample.startsWith("{") || sample.startsWith("[")) {
    try {
      const parsed = JSON.parse(sample);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed).slice(0, 16);
        facts.push(`JSON object with keys: ${keys.join(", ") || "(none)"}`);
        metrics.push({ label: "Keys", value: String(keys.length) });
        checks.push("Parses as JSON object.");
      } else if (Array.isArray(parsed)) {
        facts.push(`JSON array length ${parsed.length} (in sample).`);
        metrics.push({ label: "Items", value: String(parsed.length) });
        checks.push("Parses as JSON array.");
      } else {
        checks.push("Parses as JSON primitive.");
      }
    } catch {
      checks.push("Sample does not parse as JSON (truncated or JSONC/JSONL).");
      facts.push("Treat as JSON-like text; show pretty Source if possible.");
    }
    return {
      identity: "JSON",
      facts,
      checks,
      metrics,
      summaryMarkdown: [
        "## JSON",
        "",
        "### Checks",
        ...checks.map((c) => `- ${c}`),
        "",
        "### Facts",
        ...facts.map((f) => `- ${f}`)
      ].join("\n")
    };
  }
  if (name.endsWith(".edn") || name.endsWith(".clj") || /^\s*[;({[]/.test(sample) && /:\w+/.test(sample)) {
    const keys = [
      ...new Set(
        [...sample.matchAll(/:([a-zA-Z_][\w-]*)/g)].map((m) => `:${m[1]}`)
      )
    ].slice(0, 16);
    facts.push(
      keys.length ? `Keyword-like keys: ${keys.join(", ")}` : "EDN/Clojure-like text."
    );
    checks.push("Not validated by a full EDN parser \u2014 structural skim only.");
    metrics.push({ label: "Keys", value: String(keys.length) });
    return {
      identity: "EDN / Clojure data",
      facts,
      checks,
      metrics,
      summaryMarkdown: [
        "## EDN / Clojure data",
        "",
        "### Top-level keywords (heuristic)",
        ...keys.map((k) => `- \`${k}\``),
        "",
        "### Checks",
        ...checks.map((c) => `- ${c}`)
      ].join("\n")
    };
  }
  const lines = sample.split(/\r?\n/).length;
  facts.push(`~${lines} lines in sample.`, `First line: ${sample.split(/\r?\n/)[0]?.slice(0, 80) ?? ""}`);
  metrics.push({ label: "Lines", value: String(lines) });
  return {
    identity: "text document",
    facts,
    checks: ["No specialized dialect detected \u2014 still prefer Overview + Source over Hex."],
    metrics,
    summaryMarkdown: [
      "## Text file",
      "",
      ...facts.map((f) => `- ${f}`)
    ].join("\n")
  };
}
function detectContentKind(filename, sampleText) {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";
  const root = xmlLocalName(xmlRootTag(sample));
  if (name.includes("sitemap") || root === "urlset" || root === "sitemapindex" || /sitemaps\.org\/schemas\/sitemap/i.test(sample)) {
    return {
      kind: "XML sitemap",
      language: "xml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview | Structure | Source. Overview = MarkdownView bound to /summary (what a sitemap is + Checks + first <loc> URLs as a list). Structure = Badges/Metrics for urlset vs index, URL count, namespace OK/warn Alerts. Source = Textarea /body with full sample. DO NOT add a Hex tab."
    };
  }
  if (root === "rss" || root === "feed" || /<rss\b/i.test(sample) || /<feed\b/i.test(sample)) {
    return {
      kind: "RSS/Atom feed",
      language: "xml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary: feed title, item count, checks) | Items (Badges or Text list of titles from sample) | Source (Textarea /body). No Hex."
    };
  }
  if (name.endsWith(".svg") || root === "svg") {
    return {
      kind: "SVG",
      language: "svg",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (size/viewBox Metrics + Alert) | Source (Textarea /body). No Hex."
    };
  }
  if (name === "robots.txt" || /^user-agent:/im.test(sample)) {
    return {
      kind: "robots.txt",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary: agents + sitemap URLs) | Edit (Textarea /body). No Hex."
    };
  }
  if (name.endsWith(".edn") || name.endsWith(".clj") || name.endsWith(".cljs") || /^\s*[;({[]/.test(sample) && /:\w+/.test(sample)) {
    return {
      kind: "edn/clojure config",
      language: "edn",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary + Badges for :keys) | Edit (Textarea /body) | Notes (Alert with checks). Put sample in state.body and analysis summary in state.summary. No Hex unless binary."
    };
  }
  if (name.endsWith(".toml") || name.endsWith(".ini") || name.endsWith(".cfg") || name.endsWith(".conf") || name.endsWith(".properties")) {
    return {
      kind: "toml/ini config",
      language: name.endsWith(".properties") ? "properties" : "toml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (section keys as Badges + checks Alert) | Edit (Textarea /body) | Raw optional. Prefer editing over a static dump. No Hex."
    };
  }
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return {
      kind: "yaml",
      language: "yaml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (top-level keys Badges + MarkdownView /summary) | Edit (Textarea /body). No Hex."
    };
  }
  if (name.endsWith(".json") || name.endsWith(".jsonl") || name.endsWith(".jsonc") || sample.startsWith("{") || sample.startsWith("[")) {
    return {
      kind: "json",
      language: "json",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (Metric/Badge for key fields + MarkdownView /summary with checks) | Edit (Textarea pretty JSON /body). Not a single Markdown dump. No Hex."
    };
  }
  if (name.endsWith(".xml") || name.endsWith(".plist") || name.endsWith(".html") || name.endsWith(".htm") || sample.startsWith("<") || sample.startsWith("<?xml")) {
    return {
      kind: "markup/xml",
      language: name.endsWith(".html") || name.endsWith(".htm") ? "html" : "xml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary explaining the dialect + checks) | Structure (Badges for root/tags) | Source (Textarea /body). Hex is wrong for XML \u2014 omit it."
    };
  }
  if (/\.lhs$/i.test(name)) {
    return {
      kind: "literate haskell",
      language: "haskell",
      wantHex: false,
      hint: "Mini-app: Tabs Overview | Code (bird '>' lines stripped into Textarea /code) | Literate (full /body). Both texts in Spec.state."
    };
  }
  if (/\.hs$/i.test(name)) {
    return {
      kind: "haskell",
      language: "haskell",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (exports as Badges) | Code (Textarea /body)."
    };
  }
  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|swift|sql|css|scss|sh|bash|zsh|lua|r|pl)$/i.test(
    name
  )) {
    const language = name.split(".").pop() || "code";
    return {
      kind: "source code",
      language,
      wantHex: false,
      hint: `Mini-app: Tabs Overview (language + rough symbols as Badges) | Code (Textarea /body for ${language}). No Hex.`
    };
  }
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".rst") || name.endsWith(".adoc")) {
    return {
      kind: "markdown",
      language: "markdown",
      wantHex: false,
      hint: "Mini-app: Tabs Preview (MarkdownView bound to /body) | Edit (Textarea same /body)."
    };
  }
  if (name.endsWith(".log") || name.endsWith(".out") || /\d{4}-\d{2}-\d{2}[ t]\d{2}:\d{2}/i.test(sample.slice(0, 400))) {
    return {
      kind: "log",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (line count / size Metrics + Alert) | Log (Textarea /body)."
    };
  }
  if (name.endsWith(".plist") || name.endsWith(".strings") || name.endsWith(".env") || name.endsWith(".env.example")) {
    return {
      kind: "env/plist",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (checks Alert) | Edit (Textarea /body). Never invent fake secrets \u2014 use the sample only."
    };
  }
  if (sample.length > 0) {
    return {
      kind: "text",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary) | Text (Textarea /body). Avoid Hex for readable text."
    };
  }
  return {
    kind: "binary/unknown",
    language: "bin",
    wantHex: true,
    hint: "Mini-app: Tabs Hex (Textarea /hex) | Meta (Badges for mime/size + Alert). No fake text decode."
  };
}
var FEW_SHOTS = `
EXAMPLE (structured document like sitemap/XML/JSON \u2014 Overview + Source; NO Hex):
{"op":"set","path":"/state","value":{"activeTab":"overview","summary":"## XML sitemap\\n\\n- Type: urlset\\n- URLs: 12\\n\\n### Checks\\n- Namespace OK","body":"(full file sample)"}}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}
{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"overview","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Overview","value":"overview"},{"label":"Structure","value":"structure"},{"label":"Source","value":"source"}]},"children":["paneOverview","paneStructure","paneSource"]}}
{"op":"add","path":"/elements/paneOverview","value":{"type":"MarkdownView","props":{"markdown":{"$bindState":"/summary"},"title":null},"children":[]}}
{"op":"add","path":"/elements/paneStructure","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm","align":null,"justify":null,"wrap":null},"children":["mType","mUrls","alertChecks"]}}
{"op":"add","path":"/elements/mType","value":{"type":"Metric","props":{"label":"Type","value":"urlset","change":null,"changeType":null,"prefix":null,"suffix":null},"children":[]}}
{"op":"add","path":"/elements/mUrls","value":{"type":"Metric","props":{"label":"URLs","value":"12","change":null,"changeType":null,"prefix":null,"suffix":null},"children":[]}}
{"op":"add","path":"/elements/alertChecks","value":{"type":"Alert","props":{"title":"Checks","message":"Namespace present. Sample may be truncated.","type":"info"},"children":[]}}
{"op":"add","path":"/elements/paneSource","value":{"type":"Textarea","props":{"label":"Source","name":"body","placeholder":null,"rows":14,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}
{"op":"add","path":"/root","value":"card"}

EXAMPLE (markdown \u2014 Preview + Edit sharing state):
{"op":"set","path":"/state","value":{"activeTab":"preview","body":"# Title\\n\\nBody from sample."}}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}
{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"preview","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Preview","value":"preview"},{"label":"Edit","value":"edit"}]},"children":["preview","edit"]}}
{"op":"add","path":"/elements/preview","value":{"type":"MarkdownView","props":{"markdown":{"$bindState":"/body"},"title":null},"children":[]}}
{"op":"add","path":"/elements/edit","value":{"type":"Textarea","props":{"label":"Markdown","name":"body","placeholder":null,"rows":14,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}
{"op":"add","path":"/root","value":"card"}
`;
function buildInventPrompt(input) {
  const sample = (input.sampleText ?? "").slice(0, 2400);
  const hex = input.hexPreview.slice(0, 800);
  const detected = detectContentKind(input.filename, input.sampleText);
  const analysis = analyzeFileSample(
    input.filename,
    input.sampleText,
    input.size
  );
  const catalogPrompt = inventCatalog.prompt({
    mode: "standalone",
    system: "You invent a useful interactive json-render mini-app for an unrecognized file \u2014 explain what it is, validate what you can, and surface the important bits. Never ship a generic text/hex dump when the file is structured text.",
    customRules: [
      `Only use these components: ${inventCatalog.componentNames.join(", ")}.`,
      "Never invent an emulator, CPU, disk controller, ROM runner, or game console.",
      "Never use InventedViewer, BinaryInspector, AudioPlayer, VideoPlayer, PdfViewer, SlideViewer, PixelEditor, TrackerPlayer, Spreadsheet, or WebPageViewer.",
      "Put derived explanation in state.summary (Markdown) and file body in state.body; bind MarkdownView\u2192/summary and Textarea\u2192/body. Every $bindState/$state path MUST exist in top-level state with real values from ANALYSIS / sample.",
      'Example state: {"activeTab":"overview","summary":"## \u2026","body":"\u2026"}.',
      "Preferred panes: Overview (what it is + checks) | Structure or Highlights (Metrics/Badges/Alerts) | Source (editable Textarea). Hex ONLY when ANALYSIS says binary / no text.",
      "Card is only a border shell (title/description null \u2014 window chrome already shows the name).",
      "Do not invent fake file contents \u2014 copy body from the sample; copy/adapt summary from ANALYSIS.summaryMarkdown.",
      "Use Badge, Alert, Heading, Text, Separator, Metric for structure and validation status.",
      "Typical size: 8\u201316 elements. Forbidden: Card\u2192Markdown poster only; Forbidden for XML/JSON/YAML/sitemap: Tabs that are only Text|Hex.",
      "Every required props field must be present (null where nullable).",
      'Textarea/Input label must be a string (use "" if unlabeled), never null.',
      'Leaf elements must include "children": [].'
    ]
  });
  const hexSection = detected.wantHex ? `Hex preview (include a Hex tab):
${hex || "(empty)"}` : `Hex preview (DO NOT add a Hex tab for this file \u2014 structured/readable text):
${hex.slice(0, 120) || "(empty)"}`;
  return `${catalogPrompt}

---
${FEW_SHOTS}
---

TASK
Invent an interactive mini-app Spec for this file. Follow SpecStream JSONL from the catalog prompt (same shape as the examples).

Goal: a domain-aware tool \u2014 name the format, run the listed checks, show pertinent counts/fields, and keep the full sample editable on Source. Not a summary card and not a hex dump.

Detected: ${detected.kind} (language=${detected.language})
App guidance: ${detected.hint}

ANALYSIS (use these facts \u2014 put summaryMarkdown into state.summary, metrics into Metric/Badge props):
- identity: ${analysis.identity}
- facts:
${analysis.facts.map((f) => `  - ${f}`).join("\n")}
- checks:
${analysis.checks.map((c) => `  - ${c}`).join("\n")}
- metrics: ${JSON.stringify(analysis.metrics)}
- summaryMarkdown:
${analysis.summaryMarkdown}

File metadata:
- title: ${JSON.stringify(input.title)}
- filename: ${JSON.stringify(input.filename)}
- mimeType: ${JSON.stringify(input.mimeType)}
- size: ${input.size} bytes
- sourceUrl: ${JSON.stringify(input.sourceUrl ?? null)}

Sample text (may be truncated; use as real content in state.body):
${sample || "(empty \u2014 binary or no decode)"}

${hexSection}
`;
}
function buildInventRepairPrompt(options) {
  return `${options.basePrompt}

---

REPAIR
Your previous Spec was rejected:
${options.errors}

Previous output (truncate if needed \u2014 fix the issues, do not explain):
${options.previousOutput.slice(0, 3500)}

Emit a corrected SpecStream JSONL only. Prefer Overview + Structure + Source with state.summary + state.body from ANALYSIS/sample. No poster dumps; no Text|Hex-only for structured text.
`;
}

// src/office.ts
import * as CFB2 from "cfb";
import * as XLSX from "xlsx";

// src/wad.ts
var MAP_CORE = [
  "THINGS",
  "LINEDEFS",
  "SIDEDEFS",
  "VERTEXES",
  "SEGS",
  "SSECTORS",
  "NODES",
  "SECTORS",
  "REJECT",
  "BLOCKMAP"
];
var MAP_FOLLOW = /* @__PURE__ */ new Set([
  ...MAP_CORE,
  "BEHAVIOR",
  "SCRIPTS",
  "DIALOGUE",
  "ZNODES",
  "LIGHTMAP",
  "TEXTMAP",
  "ENDMAP"
]);

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
function tryPrettyJson(sample) {
  const t = sample.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return null;
  }
}
function topLevelKeys(sample) {
  const keys = [];
  for (const m of sample.matchAll(/:([a-zA-Z_][\w-]*)/g)) {
    const k = m[1];
    if (k && !keys.includes(k)) keys.push(k);
    if (keys.length >= 8) break;
  }
  if (keys.length) return keys;
  for (const m of sample.matchAll(/"([^"]{1,40})"\s*:/g)) {
    const k = m[1];
    if (k && !keys.includes(k)) keys.push(k);
    if (keys.length >= 8) break;
  }
  return keys;
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
var DANGEROUS_POINTER_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function setByPointer(state, path, value) {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return;
  if (parts.some((part) => DANGEROUS_POINTER_KEYS.has(part))) return;
  let cur = state;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = cur[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[part] = /* @__PURE__ */ Object.create(null);
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
  const pretty = tryPrettyJson(sample);
  if (/^(active)?tab$/i.test(leaf) || leaf === "selectedtab") return tabDefault;
  if (/hex/i.test(leaf)) return input.hexPreview;
  if (/summary|overview|about|checks/i.test(leaf)) {
    return analyzeFileSample(input.filename, input.sampleText, input.size).summaryMarkdown;
  }
  if (/keys|keywords|fields/i.test(leaf)) {
    return topLevelKeys(sample).join(", ") || "(none detected)";
  }
  if (/size|bytes/i.test(leaf)) return String(input.size);
  if (/mime/i.test(leaf)) return input.mimeType;
  if (/filename|name|title/i.test(leaf) && leaf !== "textarea") {
    return input.title || input.filename;
  }
  if (/extract|bird/i.test(leaf) || leaf.includes("code") && !leaf.includes("source")) {
    return bird || pretty || sample;
  }
  if (/literate|raw|full|source|content|text|body|edit|markdown|sample|code|json/i.test(
    leaf
  )) {
    if (/markdown|preview/i.test(leaf) && sample) {
      return fenceAs(
        lang === "lhs" || lang === "hs" ? "haskell" : lang,
        pretty || sample
      );
    }
    return pretty || sample || input.hexPreview;
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
  if (state.body === void 0 && (input.sampleText ?? "").length > 0) {
    state.body = tryPrettyJson(input.sampleText) ?? input.sampleText;
  }
  if (state.summary === void 0 && (input.sampleText ?? "").length > 0) {
    state.summary = analyzeFileSample(
      input.filename,
      input.sampleText,
      input.size
    ).summaryMarkdown;
  }
  if (state.hex === void 0 && input.hexPreview) {
    state.hex = input.hexPreview;
  }
  if (state.activeTab === void 0 || state.activeTab === "") {
    state.activeTab = tabDefault;
  }
  for (const path of paths) {
    const existing = getByPointer(state, path);
    const leaf = path.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
    const forceLhsCode = /\.lhs$/i.test(input.filename) && /code|extract|bird/i.test(leaf);
    const forceFileContent = /source|code|text|content|raw|literate|markdown|body|edit|sample|json|hex/i.test(
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
    if (el.type === "MarkdownView" && typeof props.markdown === "string" && props.markdown.length === 0 && input.sampleText) {
      const lang = input.filename.split(".").pop() || "text";
      props.markdown = fenceAs(lang, input.sampleText);
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

// src/invent-quality.ts
function assessInventedSpecQuality(spec) {
  const issues = [];
  const elements = Object.values(spec.elements ?? {});
  const types = new Set(elements.map((el) => el.type));
  const n = elements.length;
  if (n < 4) {
    issues.push({
      code: "too_small",
      message: `Only ${n} elements \u2014 need a mini-app (\u22654), not a poster.`
    });
  }
  const hasTabs = types.has("Tabs");
  const hasAccordion = types.has("Accordion");
  const hasTextarea = types.has("Textarea");
  const hasMarkdown = types.has("MarkdownView");
  const hasMetricOrBadge = types.has("Metric") || types.has("Badge");
  if (!hasTabs && !hasAccordion) {
    issues.push({
      code: "no_panes",
      message: "Missing Tabs or Accordion \u2014 need at least two panes."
    });
  }
  const interactive = hasTextarea || types.has("Input") || hasTabs || hasAccordion;
  if (!interactive) {
    issues.push({
      code: "not_interactive",
      message: "No interactive controls (Tabs/Accordion/Textarea/Input)."
    });
  }
  const leafTypes = [...types].filter(
    (t) => !["Card", "Stack", "Grid", "Separator"].includes(t)
  );
  const onlyStatic = leafTypes.length > 0 && leafTypes.every(
    (t) => ["MarkdownView", "Text", "Alert", "Heading", "Badge", "Metric"].includes(
      t
    )
  );
  if (onlyStatic && !hasTabs && !hasAccordion && !hasTextarea) {
    issues.push({
      code: "poster",
      message: "Looks like a static dump (Card/Markdown/Text only). Add Tabs + Edit Textarea bound to Spec.state."
    });
  }
  if (hasTabs) {
    for (const el of elements) {
      if (el.type !== "Tabs") continue;
      const tabs = el.props.tabs;
      if (!Array.isArray(tabs) || tabs.length < 2) {
        issues.push({
          code: "tabs_thin",
          message: "Tabs must list at least two panes."
        });
        continue;
      }
      const labels = tabs.map(
        (t) => String(t.label ?? t.value ?? "").toLowerCase()
      );
      const onlyTextHex = labels.length === 2 && labels.some((l) => /^(text|source|raw|body|contents)$/.test(l)) && labels.some((l) => /^hex/.test(l));
      if (onlyTextHex) {
        issues.push({
          code: "text_hex_dump",
          message: "Tabs are only Text|Hex \u2014 for structured files use Overview (what/checks) + Structure + Source instead of a hex dump."
        });
      }
      const kids = el.children ?? [];
      if (kids.length < 2) {
        issues.push({
          code: "tabs_no_children",
          message: "Tabs must include \u22652 child element ids (one panel per tab)."
        });
      }
    }
  }
  const state = spec.state ?? {};
  const stateKeys = Object.keys(state);
  const hasBind = JSON.stringify(spec.elements ?? {}).includes('"$bindState"') || JSON.stringify(spec.elements ?? {}).includes('"$state"');
  if (!hasBind && stateKeys.length === 0) {
    issues.push({
      code: "no_state",
      message: "No Spec.state and no $bindState/$state \u2014 put file contents in state and bind panes."
    });
  }
  if (hasTabs && hasTextarea && !hasMarkdown && !hasMetricOrBadge && !types.has("Alert")) {
    issues.push({
      code: "no_overview",
      message: "Add an Overview (MarkdownView /summary) or Structure Metrics/Badges/Alert explaining what the file is and basic checks."
    });
  }
  return issues;
}
function formatQualityIssues(issues) {
  return issues.map((i) => `${i.code}: ${i.message}`).join("; ");
}

// src/invent-viewer.ts
function buildFallbackSpec(input) {
  const sample = input.sampleText?.trim() ?? "";
  const hasText = sample.length > 0;
  const body = hasText ? sample.slice(0, 6e3) : "";
  const hex = input.hexPreview.slice(0, 4e3) || "(no hex preview)";
  const analysis = analyzeFileSample(input.filename, input.sampleText, input.size);
  if (hasText) {
    const metricEls = {};
    const metricIds = [];
    for (const [i, m] of analysis.metrics.slice(0, 4).entries()) {
      const id = `metric${i}`;
      metricIds.push(id);
      metricEls[id] = {
        type: "Metric",
        props: {
          label: m.label,
          value: m.value,
          change: null,
          changeType: null,
          prefix: null,
          suffix: null
        },
        children: []
      };
    }
    return {
      root: "card",
      state: {
        activeTab: "overview",
        summary: analysis.summaryMarkdown,
        body
      },
      elements: {
        card: {
          type: "Card",
          props: {
            title: null,
            description: null,
            maxWidth: "full",
            centered: null
          },
          children: ["tabs"]
        },
        tabs: {
          type: "Tabs",
          props: {
            defaultValue: "overview",
            value: { $bindState: "/activeTab" },
            tabs: [
              { label: "Overview", value: "overview" },
              { label: "Structure", value: "structure" },
              { label: "Source", value: "source" }
            ]
          },
          children: ["paneOverview", "paneStructure", "paneSource"]
        },
        paneOverview: {
          type: "MarkdownView",
          props: {
            markdown: { $bindState: "/summary" },
            title: null
          },
          children: []
        },
        paneStructure: {
          type: "Stack",
          props: {
            direction: "vertical",
            gap: "sm",
            align: null,
            justify: null,
            wrap: null
          },
          children: [...metricIds, "alertChecks"]
        },
        ...metricEls,
        alertChecks: {
          type: "Alert",
          props: {
            title: analysis.identity,
            message: analysis.checks.slice(0, 3).join(" ") || analysis.facts[0] || "",
            type: "info"
          },
          children: []
        },
        paneSource: {
          type: "Textarea",
          props: {
            label: "Source",
            name: "body",
            placeholder: null,
            rows: 14,
            checks: null,
            validateOn: null,
            value: { $bindState: "/body" }
          },
          children: []
        }
      }
    };
  }
  return {
    root: "card",
    state: {
      activeTab: "hex",
      hex
    },
    elements: {
      card: {
        type: "Card",
        props: {
          title: null,
          description: null,
          maxWidth: "full",
          centered: null
        },
        children: ["meta", "tabs"]
      },
      meta: {
        type: "Text",
        props: {
          text: `${input.filename} \xB7 ${input.mimeType} \xB7 ${input.size} bytes`,
          variant: "muted"
        },
        children: []
      },
      tabs: {
        type: "Tabs",
        props: {
          defaultValue: "hex",
          value: { $bindState: "/activeTab" },
          tabs: [
            { label: "Hex", value: "hex" },
            { label: "Notes", value: "notes" }
          ]
        },
        children: ["paneHex", "paneNotes"]
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
          value: { $bindState: "/hex" }
        },
        children: []
      },
      paneNotes: {
        type: "Alert",
        props: {
          title: "Binary / unknown",
          message: "No decodable text sample \u2014 hex preview only (host fallback).",
          type: "info"
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
  "BinaryInspector",
  "AudioPlayer",
  "VideoPlayer",
  "PdfViewer",
  "SlideViewer",
  "PixelEditor",
  "TrackerPlayer",
  "Spreadsheet",
  "WebPageViewer"
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
  const result = inventCatalog.validate(value);
  if (!result.success) {
    const issues = result.error?.issues?.slice(0, 5) ?? [];
    const detail = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    return {
      ok: false,
      error: detail || result.error?.message || "Spec failed invent catalog validation"
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
    if (!inventCatalog.componentNames.includes(el.type)) {
      return {
        ok: false,
        error: `Component not in invent catalog: ${el.type}`
      };
    }
  }
  return { ok: true, spec };
}
function acceptInventedRaw(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Parsed value is not an object" };
  }
  const rawState = "state" in parsed ? parsed.state : void 0;
  const validated = validateInventedSpec(parsed);
  if (!validated.ok) return validated;
  const withState = {
    ...validated.spec,
    state: {
      ...typeof rawState === "object" && rawState ? rawState : {},
      ...validated.spec.state ?? {}
    }
  };
  const quality = assessInventedSpecQuality(withState);
  if (quality.length > 0) {
    return { ok: false, error: formatQualityIssues(quality) };
  }
  return { ok: true, spec: withState };
}
async function callHaiku(prompt, options) {
  const anthropic = createAnthropic({ apiKey: options.apiKey });
  const result = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    abortSignal: options.signal,
    maxOutputTokens: 4096,
    prompt
  });
  return result.text;
}
async function inventViewerSpec(input, options = {}) {
  const prompt = resolveInventPrompt(input, options.prompt);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const reason = "ANTHROPIC_API_KEY not set \u2014 Haiku unavailable";
    console.warn(`[invent-viewer] ${reason} \u2014 using fallback Spec.`);
    return {
      spec: hydrateInventedSpec(buildFallbackSpec(input), input),
      source: "fallback",
      prompt,
      reason,
      modelUnavailable: true
    };
  }
  try {
    const firstRaw = await callHaiku(prompt, {
      signal: options.signal,
      apiKey
    });
    const firstParsed = parseInventedSpec(firstRaw);
    if (firstParsed) {
      const accepted = acceptInventedRaw(firstParsed);
      if (accepted.ok) {
        return {
          spec: hydrateInventedSpec(accepted.spec, input),
          source: "haiku",
          prompt
        };
      }
      console.warn(
        `[invent-viewer] first pass rejected \u2014 ${accepted.error}; attempting repair.`
      );
      const repairPrompt2 = buildInventRepairPrompt({
        basePrompt: prompt,
        previousOutput: firstRaw,
        errors: accepted.error
      });
      const repairRaw2 = await callHaiku(repairPrompt2, {
        signal: options.signal,
        apiKey
      });
      const repairParsed2 = parseInventedSpec(repairRaw2);
      if (repairParsed2) {
        const repaired = acceptInventedRaw(repairParsed2);
        if (repaired.ok) {
          console.warn("[invent-viewer] repair succeeded.");
          return {
            spec: hydrateInventedSpec(repaired.spec, input),
            source: "haiku",
            prompt,
            repaired: true
          };
        }
        console.warn(
          `[invent-viewer] repair still invalid \u2014 ${repaired.error} \u2014 fallback.`
        );
        return {
          spec: hydrateInventedSpec(buildFallbackSpec(input), input),
          source: "fallback",
          prompt,
          reason: `Invalid Spec after repair: ${repaired.error}`
        };
      }
      console.warn("[invent-viewer] repair could not parse Spec \u2014 fallback.");
      return {
        spec: hydrateInventedSpec(buildFallbackSpec(input), input),
        source: "fallback",
        prompt,
        reason: "Could not parse Spec after repair"
      };
    }
    console.warn(
      "[invent-viewer] could not parse first output \u2014 attempting repair."
    );
    console.warn(
      "[invent-viewer] raw head:",
      firstRaw.slice(0, 240).replace(/\s+/g, " ")
    );
    const repairPrompt = buildInventRepairPrompt({
      basePrompt: prompt,
      previousOutput: firstRaw,
      errors: "Could not parse Spec/SpecStream from model output"
    });
    const repairRaw = await callHaiku(repairPrompt, {
      signal: options.signal,
      apiKey
    });
    const repairParsed = parseInventedSpec(repairRaw);
    if (repairParsed) {
      const repaired = acceptInventedRaw(repairParsed);
      if (repaired.ok) {
        return {
          spec: hydrateInventedSpec(repaired.spec, input),
          source: "haiku",
          prompt,
          repaired: true
        };
      }
    }
    return {
      spec: hydrateInventedSpec(buildFallbackSpec(input), input),
      source: "fallback",
      prompt,
      reason: "Could not parse Spec/SpecStream from model output"
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
      modelUnavailable: true
    };
  }
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
  compose: { max: 60, windowMs: 60 * 6e4 }
  // 60 / hour
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
  if (!process.env.VERCEL) return "local";
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  const last = forwarded?.[forwarded.length - 1];
  if (last) return last;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
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
  const site = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (site === "cross-site") {
    return errorResponse(403, "Cross-site requests are not allowed.", {
      code: "blocked"
    });
  }
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
var MAX_JSON_BODY_CHARS = 15e5;
async function readJsonBody(request) {
  const text = await request.text();
  if (!text) return {};
  if (text.length > MAX_JSON_BODY_CHARS) {
    throw new Error(
      `Request body is too large (${text.length} chars; max ${MAX_JSON_BODY_CHARS}).`
    );
  }
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
          title: (body.title ?? body.filename).slice(0, 300),
          filename: body.filename.slice(0, 300),
          mimeType: body.mimeType.slice(0, 200),
          size: body.size ?? 0,
          sampleText: body.sampleText?.slice(0, 8e3) ?? null,
          hexPreview: body.hexPreview.slice(0, 4e3),
          sourceUrl: body.sourceUrl?.slice(0, 2e3) ?? null
        },
        {
          signal: AbortSignal.timeout(9e4),
          prompt: body.prompt?.slice(0, 24e3)
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
