import { inventCatalog } from "./invent-catalog";

export type InventInput = {
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  sampleText: string | null;
  hexPreview: string;
  sourceUrl?: string | null;
};

export type DetectedContent = {
  kind: string;
  hint: string;
  language: string;
  /** Prefer Hex tab? Only for binary / undecodable. */
  wantHex: boolean;
};

export type SampleAnalysis = {
  /** Short label e.g. "XML sitemap (urlset)" */
  identity: string;
  /** Bullet facts for the prompt (and for Overview state). */
  facts: string[];
  /** Validation notes: well-formed? missing required bits? */
  checks: string[];
  /** Suggested Metrics / Badges for Overview. */
  metrics: Array<{ label: string; value: string }>;
  /** Markdown Overview body Haiku should put in state.summary (may edit). */
  summaryMarkdown: string;
};

function countMatches(sample: string, re: RegExp): number {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return [...sample.matchAll(new RegExp(re.source, flags))].length;
}

function xmlRootTag(sample: string): string | null {
  const m = sample.match(/<\s*([A-Za-z_][\w:.-]*)\b/);
  return m?.[1]?.toLowerCase() ?? null;
}

function xmlLocalName(tag: string | null): string | null {
  if (!tag) return null;
  const i = tag.indexOf(":");
  return i >= 0 ? tag.slice(i + 1) : tag;
}

/** Cheap static analysis so Haiku invents around real structure, not a hex dump. */
export function analyzeFileSample(
  filename: string,
  sampleText: string | null,
  size: number,
): SampleAnalysis {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";
  const facts: string[] = [`Filename: ${filename}`, `Size: ${size} bytes`];
  const checks: string[] = [];
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Size", value: `${size} B` },
  ];

  if (!sample) {
    return {
      identity: "binary or empty sample",
      facts: [...facts, "No decodable text sample in the first bytes."],
      checks: [
        "Cannot validate structure without a text decode — use Hex + Meta only.",
      ],
      metrics,
      summaryMarkdown:
        "## Unknown / binary\n\nNo text sample was decoded. Use the Hex tab for a byte preview.",
    };
  }

  const root = xmlRootTag(sample);
  const local = xmlLocalName(root);

  // --- XML sitemap ---
  if (
    name.includes("sitemap") ||
    local === "urlset" ||
    local === "sitemapindex" ||
    /xmlns=["']https?:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(
      sample,
    )
  ) {
    const isIndex = local === "sitemapindex" || /<sitemapindex\b/i.test(sample);
    const urlCount = countMatches(sample, /<url\b/i);
    const sitemapCount = countMatches(sample, /<sitemap\b/i);
    const locCount = countMatches(sample, /<loc\b/i);
    const hasNs = /sitemaps\.org\/schemas\/sitemap/i.test(sample);
    const locs = [...sample.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
      .map((m) => m[1]!.trim())
      .slice(0, 8);

    facts.push(
      isIndex
        ? "Looks like a sitemap index (sitemapindex)."
        : "Looks like a URL sitemap (urlset).",
      hasNs
        ? "Declares the standard sitemaps.org 0.9 namespace."
        : "Missing or non-standard sitemaps.org namespace.",
      `Counted <loc>: ${locCount}; <url>: ${urlCount}; <sitemap>: ${sitemapCount}.`,
    );
    if (locs.length) {
      facts.push(`First locations: ${locs.join(" · ")}`);
    }

    if (!hasNs) {
      checks.push(
        "Warn: sitemap protocol usually uses xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\".",
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
        "Sample may be truncated — closing root tag not seen; treat counts as lower bounds.",
      );
    }
    checks.push(
      sample.startsWith("<") || sample.startsWith("<?xml")
        ? "Opens like XML (good)."
        : "Does not start with XML prologue or < — may be malformed.",
    );

    metrics.push(
      { label: "Type", value: isIndex ? "index" : "urlset" },
      { label: "URLs", value: String(isIndex ? sitemapCount : Math.max(urlCount, locCount)) },
      { label: "locs", value: String(locCount) },
    );

    const identity = isIndex ? "XML sitemap index" : "XML sitemap (urlset)";
    const summaryMarkdown = [
      `## ${identity}`,
      "",
      isIndex
        ? "A **sitemap index** lists other sitemap files for crawlers (Google Search Console, etc.)."
        : "A **urlset sitemap** lists page URLs for search-engine crawlers.",
      "",
      "### Checks",
      ...checks.map((c) => `- ${c}`),
      "",
      "### Sample locations",
      ...(locs.length ? locs.map((u) => `- ${u}`) : ["- (none in sample)"]),
    ].join("\n");

    return { identity, facts, checks, metrics, summaryMarkdown };
  }

  // --- RSS / Atom ---
  if (
    local === "rss" ||
    local === "feed" ||
    /<rss\b/i.test(sample) ||
    /<feed\b[^>]*xmlns=["'][^"']*Atom/i.test(sample)
  ) {
    const isAtom = local === "feed" || /<feed\b/i.test(sample);
    const items = isAtom
      ? countMatches(sample, /<entry\b/i)
      : countMatches(sample, /<item\b/i);
    const title =
      sample.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i)?.[1]?.trim() ?? null;
    facts.push(
      isAtom ? "Looks like an Atom feed." : "Looks like an RSS feed.",
      `Entry/item count in sample: ${items}.`,
    );
    if (title) facts.push(`Feed title: ${title}`);
    checks.push(
      items > 0
        ? "Contains entries/items in the sample."
        : "No entries/items visible — empty feed or truncated sample.",
    );
    metrics.push(
      { label: "Format", value: isAtom ? "Atom" : "RSS" },
      { label: "Items", value: String(items) },
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
        ...checks.map((c) => `- ${c}`),
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  // --- SVG ---
  if (name.endsWith(".svg") || local === "svg") {
    const w = sample.match(/\bwidth=["']([^"']+)["']/i)?.[1];
    const h = sample.match(/\bheight=["']([^"']+)["']/i)?.[1];
    const vb = sample.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
    facts.push("Scalable Vector Graphics document.");
    if (w || h) facts.push(`width=${w ?? "?"} height=${h ?? "?"}`);
    if (vb) facts.push(`viewBox=${vb}`);
    checks.push(
      /<svg\b/i.test(sample)
        ? "Has an <svg> root."
        : "Missing <svg> root in sample.",
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
        ...checks.map((c) => `- ${c}`),
      ].join("\n"),
    };
  }

  // --- Generic XML ---
  if (
    name.endsWith(".xml") ||
    name.endsWith(".plist") ||
    sample.startsWith("<?xml") ||
    (sample.startsWith("<") && /<\/[A-Za-z_][\w:.-]*>/.test(sample))
  ) {
    const tags = [
      ...new Set(
        [...sample.matchAll(/<\s*([A-Za-z_][\w:.-]*)\b/g)].map((m) =>
          m[1]!.toLowerCase(),
        ),
      ),
    ].slice(0, 12);
    facts.push(
      root ? `Root / first tag: <${root}>` : "No clear root tag.",
      tags.length ? `Tags seen: ${tags.join(", ")}` : "Few tags parsed.",
    );
    checks.push(
      sample.includes("<?xml")
        ? "Has XML declaration."
        : "No XML declaration (optional but common).",
    );
    if (root && !sample.includes(`</${root.split(":").pop()}`)) {
      checks.push("Closing root tag not found — sample may be truncated.");
    }
    metrics.push(
      { label: "Root", value: root ?? "?" },
      { label: "Tags", value: String(tags.length) },
    );
    return {
      identity: root ? `XML document (<${root}>)` : "XML document",
      facts,
      checks,
      metrics,
      summaryMarkdown: [
        `## XML${root ? ` — \`<${root}>\`` : ""}`,
        "",
        "Explain what this dialect is if recognizable (config, export, feed, …). Surface structure on Overview; keep full markup on Source.",
        "",
        "### Checks",
        ...checks.map((c) => `- ${c}`),
        "",
        "### Tags in sample",
        tags.map((t) => `- \`${t}\``).join("\n") || "- (none)",
      ].join("\n"),
    };
  }

  // --- robots.txt ---
  if (name === "robots.txt" || /^user-agent:/im.test(sample)) {
    const agents = countMatches(sample, /^user-agent:/im);
    const sitemaps = [
      ...sample.matchAll(/^sitemap:\s*(\S+)/gim),
    ].map((m) => m[1]!);
    facts.push(`User-agent directives: ${agents}.`);
    if (sitemaps.length) facts.push(`Sitemap refs: ${sitemaps.join(", ")}`);
    checks.push(
      agents > 0
        ? "Has User-agent rules."
        : "No User-agent line — may be incomplete.",
    );
    metrics.push(
      { label: "Agents", value: String(agents) },
      { label: "Sitemaps", value: String(sitemaps.length) },
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
        ...(sitemaps.length
          ? ["", "### Sitemap references", ...sitemaps.map((u) => `- ${u}`)]
          : []),
      ].join("\n"),
    };
  }

  // --- JSON ---
  if (
    name.endsWith(".json") ||
    name.endsWith(".jsonl") ||
    name.endsWith(".jsonc") ||
    sample.startsWith("{") ||
    sample.startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(sample) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed as object).slice(0, 16);
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
        ...facts.map((f) => `- ${f}`),
      ].join("\n"),
    };
  }

  // --- EDN-ish ---
  if (
    name.endsWith(".edn") ||
    name.endsWith(".clj") ||
    (/^\s*[;({[]/.test(sample) && /:\w+/.test(sample))
  ) {
    const keys = [
      ...new Set(
        [...sample.matchAll(/:([a-zA-Z_][\w-]*)/g)].map((m) => `:${m[1]}`),
      ),
    ].slice(0, 16);
    facts.push(
      keys.length
        ? `Keyword-like keys: ${keys.join(", ")}`
        : "EDN/Clojure-like text.",
    );
    checks.push("Not validated by a full EDN parser — structural skim only.");
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
        ...checks.map((c) => `- ${c}`),
      ].join("\n"),
    };
  }

  // default text
  const lines = sample.split(/\r?\n/).length;
  facts.push(`~${lines} lines in sample.`, `First line: ${sample.split(/\r?\n/)[0]?.slice(0, 80) ?? ""}`);
  metrics.push({ label: "Lines", value: String(lines) });
  return {
    identity: "text document",
    facts,
    checks: ["No specialized dialect detected — still prefer Overview + Source over Hex."],
    metrics,
    summaryMarkdown: [
      "## Text file",
      "",
      ...facts.map((f) => `- ${f}`),
    ].join("\n"),
  };
}

export function detectContentKind(
  filename: string,
  sampleText: string | null,
): DetectedContent {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";
  const root = xmlLocalName(xmlRootTag(sample));

  if (
    name.includes("sitemap") ||
    root === "urlset" ||
    root === "sitemapindex" ||
    /sitemaps\.org\/schemas\/sitemap/i.test(sample)
  ) {
    return {
      kind: "XML sitemap",
      language: "xml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview | Structure | Source. Overview = MarkdownView bound to /summary (what a sitemap is + Checks + first <loc> URLs as a list). Structure = Badges/Metrics for urlset vs index, URL count, namespace OK/warn Alerts. Source = Textarea /body with full sample. DO NOT add a Hex tab.",
    };
  }
  if (
    root === "rss" ||
    root === "feed" ||
    /<rss\b/i.test(sample) ||
    /<feed\b/i.test(sample)
  ) {
    return {
      kind: "RSS/Atom feed",
      language: "xml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary: feed title, item count, checks) | Items (Badges or Text list of titles from sample) | Source (Textarea /body). No Hex.",
    };
  }
  if (name.endsWith(".svg") || root === "svg") {
    return {
      kind: "SVG",
      language: "svg",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (size/viewBox Metrics + Alert) | Source (Textarea /body). No Hex.",
    };
  }
  if (name === "robots.txt" || /^user-agent:/im.test(sample)) {
    return {
      kind: "robots.txt",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary: agents + sitemap URLs) | Edit (Textarea /body). No Hex.",
    };
  }
  if (
    name.endsWith(".edn") ||
    name.endsWith(".clj") ||
    name.endsWith(".cljs") ||
    (/^\s*[;({[]/.test(sample) && /:\w+/.test(sample))
  ) {
    return {
      kind: "edn/clojure config",
      language: "edn",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary + Badges for :keys) | Edit (Textarea /body) | Notes (Alert with checks). Put sample in state.body and analysis summary in state.summary. No Hex unless binary.",
    };
  }
  if (
    name.endsWith(".toml") ||
    name.endsWith(".ini") ||
    name.endsWith(".cfg") ||
    name.endsWith(".conf") ||
    name.endsWith(".properties")
  ) {
    return {
      kind: "toml/ini config",
      language: name.endsWith(".properties") ? "properties" : "toml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (section keys as Badges + checks Alert) | Edit (Textarea /body) | Raw optional. Prefer editing over a static dump. No Hex.",
    };
  }
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return {
      kind: "yaml",
      language: "yaml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (top-level keys Badges + MarkdownView /summary) | Edit (Textarea /body). No Hex.",
    };
  }
  if (
    name.endsWith(".json") ||
    name.endsWith(".jsonl") ||
    name.endsWith(".jsonc") ||
    sample.startsWith("{") ||
    sample.startsWith("[")
  ) {
    return {
      kind: "json",
      language: "json",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (Metric/Badge for key fields + MarkdownView /summary with checks) | Edit (Textarea pretty JSON /body). Not a single Markdown dump. No Hex.",
    };
  }
  if (
    name.endsWith(".xml") ||
    name.endsWith(".plist") ||
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    sample.startsWith("<") ||
    sample.startsWith("<?xml")
  ) {
    return {
      kind: "markup/xml",
      language: name.endsWith(".html") || name.endsWith(".htm") ? "html" : "xml",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary explaining the dialect + checks) | Structure (Badges for root/tags) | Source (Textarea /body). Hex is wrong for XML — omit it.",
    };
  }
  if (/\.lhs$/i.test(name)) {
    return {
      kind: "literate haskell",
      language: "haskell",
      wantHex: false,
      hint: "Mini-app: Tabs Overview | Code (bird '>' lines stripped into Textarea /code) | Literate (full /body). Both texts in Spec.state.",
    };
  }
  if (/\.hs$/i.test(name)) {
    return {
      kind: "haskell",
      language: "haskell",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (exports as Badges) | Code (Textarea /body).",
    };
  }
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|swift|sql|css|scss|sh|bash|zsh|lua|r|pl)$/i.test(
      name,
    )
  ) {
    const language = name.split(".").pop() || "code";
    return {
      kind: "source code",
      language,
      wantHex: false,
      hint: `Mini-app: Tabs Overview (language + rough symbols as Badges) | Code (Textarea /body for ${language}). No Hex.`,
    };
  }
  if (
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".rst") ||
    name.endsWith(".adoc")
  ) {
    return {
      kind: "markdown",
      language: "markdown",
      wantHex: false,
      hint: "Mini-app: Tabs Preview (MarkdownView bound to /body) | Edit (Textarea same /body).",
    };
  }
  if (
    name.endsWith(".log") ||
    name.endsWith(".out") ||
    /\d{4}-\d{2}-\d{2}[ t]\d{2}:\d{2}/i.test(sample.slice(0, 400))
  ) {
    return {
      kind: "log",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (line count / size Metrics + Alert) | Log (Textarea /body).",
    };
  }
  if (
    name.endsWith(".plist") ||
    name.endsWith(".strings") ||
    name.endsWith(".env") ||
    name.endsWith(".env.example")
  ) {
    return {
      kind: "env/plist",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (checks Alert) | Edit (Textarea /body). Never invent fake secrets — use the sample only.",
    };
  }
  if (sample.length > 0) {
    return {
      kind: "text",
      language: "text",
      wantHex: false,
      hint: "Mini-app: Tabs Overview (MarkdownView /summary) | Text (Textarea /body). Avoid Hex for readable text.",
    };
  }
  return {
    kind: "binary/unknown",
    language: "bin",
    wantHex: true,
    hint: "Mini-app: Tabs Hex (Textarea /hex) | Meta (Badges for mime/size + Alert). No fake text decode.",
  };
}

/** Compact SpecStream few-shots — structure only; bodies are placeholders. */
const FEW_SHOTS = `
EXAMPLE (structured document like sitemap/XML/JSON — Overview + Source; NO Hex):
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

EXAMPLE (markdown — Preview + Edit sharing state):
{"op":"set","path":"/state","value":{"activeTab":"preview","body":"# Title\\n\\nBody from sample."}}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}
{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"preview","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Preview","value":"preview"},{"label":"Edit","value":"edit"}]},"children":["preview","edit"]}}
{"op":"add","path":"/elements/preview","value":{"type":"MarkdownView","props":{"markdown":{"$bindState":"/body"},"title":null},"children":[]}}
{"op":"add","path":"/elements/edit","value":{"type":"Textarea","props":{"label":"Markdown","name":"body","placeholder":null,"rows":14,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}
{"op":"add","path":"/root","value":"card"}
`;

/**
 * Prompt Haiku to invent a json-render Spec using the invent-only catalog.
 */
export function buildInventPrompt(input: InventInput): string {
  const sample = (input.sampleText ?? "").slice(0, 2400);
  const hex = input.hexPreview.slice(0, 800);
  const detected = detectContentKind(input.filename, input.sampleText);
  const analysis = analyzeFileSample(
    input.filename,
    input.sampleText,
    input.size,
  );

  const catalogPrompt = inventCatalog.prompt({
    mode: "standalone",
    system:
      "You invent a useful interactive json-render mini-app for an unrecognized file — explain what it is, validate what you can, and surface the important bits. Never ship a generic text/hex dump when the file is structured text.",
    customRules: [
      `Only use these components: ${inventCatalog.componentNames.join(", ")}.`,
      "Never invent an emulator, CPU, disk controller, ROM runner, or game console.",
      "Never use InventedViewer, BinaryInspector, AudioPlayer, VideoPlayer, PdfViewer, SlideViewer, PixelEditor, TrackerPlayer, Spreadsheet, or WebPageViewer.",
      "Put derived explanation in state.summary (Markdown) and file body in state.body; bind MarkdownView→/summary and Textarea→/body. Every $bindState/$state path MUST exist in top-level state with real values from ANALYSIS / sample.",
      'Example state: {"activeTab":"overview","summary":"## …","body":"…"}.',
      "Preferred panes: Overview (what it is + checks) | Structure or Highlights (Metrics/Badges/Alerts) | Source (editable Textarea). Hex ONLY when ANALYSIS says binary / no text.",
      "Card is only a border shell (title/description null — window chrome already shows the name).",
      "Do not invent fake file contents — copy body from the sample; copy/adapt summary from ANALYSIS.summaryMarkdown.",
      "Use Badge, Alert, Heading, Text, Separator, Metric for structure and validation status.",
      "Typical size: 8–16 elements. Forbidden: Card→Markdown poster only; Forbidden for XML/JSON/YAML/sitemap: Tabs that are only Text|Hex.",
      "Every required props field must be present (null where nullable).",
      'Textarea/Input label must be a string (use "" if unlabeled), never null.',
      'Leaf elements must include "children": [].',
    ],
  });

  const hexSection = detected.wantHex
    ? `Hex preview (include a Hex tab):\n${hex || "(empty)"}`
    : `Hex preview (DO NOT add a Hex tab for this file — structured/readable text):\n${hex.slice(0, 120) || "(empty)"}`;

  return `${catalogPrompt}

---
${FEW_SHOTS}
---

TASK
Invent an interactive mini-app Spec for this file. Follow SpecStream JSONL from the catalog prompt (same shape as the examples).

Goal: a domain-aware tool — name the format, run the listed checks, show pertinent counts/fields, and keep the full sample editable on Source. Not a summary card and not a hex dump.

Detected: ${detected.kind} (language=${detected.language})
App guidance: ${detected.hint}

ANALYSIS (use these facts — put summaryMarkdown into state.summary, metrics into Metric/Badge props):
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
${sample || "(empty — binary or no decode)"}

${hexSection}
`;
}

/** Second-pass prompt when validate/quality fails. */
export function buildInventRepairPrompt(options: {
  basePrompt: string;
  previousOutput: string;
  errors: string;
}): string {
  return `${options.basePrompt}

---

REPAIR
Your previous Spec was rejected:
${options.errors}

Previous output (truncate if needed — fix the issues, do not explain):
${options.previousOutput.slice(0, 3500)}

Emit a corrected SpecStream JSONL only. Prefer Overview + Structure + Source with state.summary + state.body from ANALYSIS/sample. No poster dumps; no Text|Hex-only for structured text.
`;
}
