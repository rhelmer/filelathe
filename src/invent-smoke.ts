/**
 * Offline invent quality smoke (no API keys).
 *
 *   pnpm invent-smoke
 */
import {
  assessInventedSpecQuality,
  formatQualityIssues,
} from "./invent-quality";
import { analyzeFileSample, detectContentKind } from "./invent-prompt";
import {
  buildFallbackSpec,
  parseInventedSpec,
  validateInventedSpec,
} from "./invent-viewer";
import { hydrateInventedSpec } from "./invent-hydrate";
import { rewriteHtmlForSnapshot, safeHttpUrl } from "./resource-utils";
import { scrubPromptForContrib, scrubSpecForContrib } from "./contrib-scrub";
import { contribFilename } from "./github-contrib";
import type { InventInput } from "./invent-prompt";
import {
  dedupeSandboxRecords,
  orderedSandboxLookupKeys,
  sandboxDialectKey,
  sandboxTemplateTarget,
  type SandboxRecord,
} from "./sandbox-store";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const sitemapSample = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.filelathe.com/</loc></url>
  <url><loc>https://www.filelathe.com/formats/</loc></url>
</urlset>`;

const fixtures: InventInput[] = [
  {
    title: "orbit",
    filename: "orbit-config.edn",
    mimeType: "text/plain",
    size: 140,
    sampleText:
      ';; demo\n{:app "filelathe" :format :edn :widgets [{:id 1 :label "orbit"}]}',
    hexPreview: "000000  3b 3b 20 64 65 6d 6f",
  },
  {
    title: "readme",
    filename: "README.md",
    mimeType: "text/markdown",
    size: 40,
    sampleText: "# Hi\n\nHello **world**.",
    hexPreview: "000000  23 20 48 69",
  },
  {
    title: "blob",
    filename: "mystery.bin",
    mimeType: "application/octet-stream",
    size: 32,
    sampleText: null,
    hexPreview: "000000  00 01 02 03 04 05 ff fe",
  },
  {
    title: "sitemap",
    filename: "sitemap.xml",
    mimeType: "application/xml",
    size: sitemapSample.length,
    sampleText: sitemapSample,
    hexPreview: "000000  3c 3f 78 6d 6c",
  },
];

console.log("detectContentKind");
check(
  "edn",
  detectContentKind("orbit-config.edn", fixtures[0]!.sampleText).kind.includes(
    "edn",
  ),
);
check(
  "markdown",
  detectContentKind("README.md", fixtures[1]!.sampleText).language ===
    "markdown",
);
check(
  "binary",
  detectContentKind("mystery.bin", null).kind.includes("binary"),
);
check(
  "sitemap",
  detectContentKind("sitemap.xml", sitemapSample).kind.includes("sitemap"),
);
check(
  "sitemap no hex",
  detectContentKind("sitemap.xml", sitemapSample).wantHex === false,
);

console.log("analyzeFileSample");
const sitemapAnalysis = analyzeFileSample("sitemap.xml", sitemapSample, 200);
check("sitemap identity", /sitemap/i.test(sitemapAnalysis.identity));
check(
  "sitemap loc facts",
  sitemapAnalysis.facts.some((f) => /loc/i.test(f)),
);
check(
  "sitemap summary",
  /sitemap/i.test(sitemapAnalysis.summaryMarkdown) &&
    sitemapAnalysis.summaryMarkdown.includes("filelathe.com"),
);

console.log("pointer safety");
{
  const seeded = hydrateInventedSpec(
    {
      root: "x",
      elements: {
        x: {
          type: "Text",
          props: {
            text: { $bindState: "/__proto__/polluted" },
            variant: "body",
          },
          children: [],
        },
      },
    },
    fixtures[0]!,
  );
  const probe = {} as { polluted?: unknown };
  check(
    "bind path does not pollute Object.prototype",
    probe.polluted === undefined &&
      !Object.prototype.hasOwnProperty("polluted"),
  );
  check(
    "dangerous pointer not stored",
    !JSON.stringify(seeded.state ?? {}).includes("__proto__"),
  );
  check("safe http url", safeHttpUrl("https://filelathe.com/a")?.startsWith("https://") === true);
  check("reject javascript url", safeHttpUrl("javascript:alert(1)") === null);
  const rewritten = rewriteHtmlForSnapshot("<html><head></head></html>", "javascript:alert(1)");
  check("no base from javascript url", !/javascript:/i.test(rewritten));
}

console.log("fallback Specs");
for (const input of fixtures) {
  const spec = hydrateInventedSpec(buildFallbackSpec(input), input);
  const v = validateInventedSpec(spec);
  const q = assessInventedSpecQuality(spec);
  check(
    `fallback ${input.filename}`,
    v.ok && q.length === 0,
    v.ok ? formatQualityIssues(q) : v.error,
  );
}

console.log("poster rejection");
const poster = {
  root: "card",
  state: {},
  elements: {
    card: {
      type: "Card",
      props: {
        title: null,
        description: null,
        maxWidth: "full",
        centered: null,
      },
      children: ["md"],
    },
    md: {
      type: "MarkdownView",
      props: { markdown: "# only a poster", title: null },
      children: [],
    },
  },
};
const posterIssues = assessInventedSpecQuality(poster as never);
check(
  "poster flagged",
  posterIssues.some((i) => i.code === "poster" || i.code === "no_panes"),
);

console.log("parse SpecStream overview shape");
const stream = [
  '{"op":"set","path":"/state","value":{"activeTab":"overview","summary":"## Sitemap\\n\\nOK","body":"<urlset/>"}}',
  '{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}',
  '{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"overview","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Overview","value":"overview"},{"label":"Source","value":"source"}]},"children":["paneOverview","paneSource"]}}',
  '{"op":"add","path":"/elements/paneOverview","value":{"type":"MarkdownView","props":{"markdown":{"$bindState":"/summary"},"title":null},"children":[]}}',
  '{"op":"add","path":"/elements/paneSource","value":{"type":"Textarea","props":{"label":"Source","name":"body","placeholder":null,"rows":8,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}',
  '{"op":"add","path":"/root","value":"card"}',
].join("\n");
const parsed = parseInventedSpec(stream);
check("parse stream", parsed != null);
if (parsed) {
  const v = validateInventedSpec(parsed);
  check("validate stream", v.ok, v.ok ? "" : v.error);
  if (v.ok) {
    const q = assessInventedSpecQuality(v.spec);
    check("quality stream", q.length === 0, formatQualityIssues(q));
  }
}

console.log("reject text|hex dump");
const dumpStream = [
  '{"op":"set","path":"/state","value":{"activeTab":"text","body":"hi","hex":"00"}}',
  '{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}',
  '{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"text","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Text","value":"text"},{"label":"Hex","value":"hex"}]},"children":["paneText","paneHex"]}}',
  '{"op":"add","path":"/elements/paneText","value":{"type":"Textarea","props":{"label":"Contents","name":"body","placeholder":null,"rows":8,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}',
  '{"op":"add","path":"/elements/paneHex","value":{"type":"Textarea","props":{"label":"Hex","name":"hex","placeholder":null,"rows":8,"value":{"$bindState":"/hex"},"checks":null,"validateOn":null},"children":[]}}',
  '{"op":"add","path":"/root","value":"card"}',
].join("\n");
const dumpParsed = parseInventedSpec(dumpStream);
check("parse dump", dumpParsed != null);
if (dumpParsed) {
  const q = assessInventedSpecQuality(dumpParsed as never);
  check(
    "text_hex flagged",
    q.some((i) => i.code === "text_hex_dump"),
    formatQualityIssues(q),
  );
}

console.log("contrib scrub");
const dirty = buildFallbackSpec(fixtures[0]!);
const scrubbed = scrubSpecForContrib(dirty);
const blob = JSON.stringify(scrubbed);
check("scrub removes sample", !blob.includes("filelathe"));
const prompt = `Sample text (may be truncated; use as real content in state/props):\nSECRET_TOKEN=abc\n\nHex preview (use in a Hex tab when useful):\n000000  ff\n`;
const scrubbedPrompt = scrubPromptForContrib(prompt)!;
check("scrub prompt", !scrubbedPrompt.includes("SECRET_TOKEN"));

console.log("dialect cache keys");
const genericXml = `<?xml version="1.0"?><config><name>filelathe</name></config>`;
check(
  "sitemap dialect key",
  sandboxDialectKey({
    filename: "sitemap.xml",
    sampleText: sitemapSample,
  }) === "kind:xml-sitemap",
);
check(
  "generic xml has no dialect",
  sandboxDialectKey({ filename: "config.xml", sampleText: genericXml }) ===
    null,
);
check(
  "rss dialect key",
  sandboxDialectKey({
    filename: "feed.xml",
    sampleText: `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`,
  }) === "kind:rss-atom",
);
check(
  "svg-in-xml dialect key",
  sandboxDialectKey({
    filename: "drawing.xml",
    sampleText: `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
  }) === "kind:svg",
);
check(
  "robots dialect key",
  sandboxDialectKey({
    filename: "robots.txt",
    sampleText: "User-agent: *\nDisallow:\n",
  }) === "kind:robots-txt",
);

const sitemapTemplate = sandboxTemplateTarget({
  filename: "sitemap.xml",
  mimeType: "application/xml",
  sampleText: sitemapSample,
});
check(
  "sitemap saves as dialect, not extension",
  sitemapTemplate.scope === "dialect" &&
    sitemapTemplate.key === "kind:xml-sitemap",
);
const xmlTemplate = sandboxTemplateTarget({
  filename: "config.xml",
  mimeType: "application/xml",
  sampleText: genericXml,
});
check(
  "generic xml saves as extension",
  xmlTemplate.scope === "extension" &&
    xmlTemplate.key === "ext:xml:application/xml",
);

const sitemapLookup = orderedSandboxLookupKeys({
  contentKey: "content:sitemap",
  filename: "sitemap.xml",
  mimeType: "application/xml",
  sampleText: sitemapSample,
});
check(
  "sitemap lookup prefers dialect over extension",
  sitemapLookup[0] === "content:sitemap" &&
    sitemapLookup[1] === "kind:xml-sitemap" &&
    sitemapLookup[2] === "ext:xml:application/xml",
);
const xmlLookup = orderedSandboxLookupKeys({
  contentKey: "content:config",
  filename: "config.xml",
  mimeType: "application/xml",
  sampleText: genericXml,
});
check(
  "generic xml lookup is content then extension",
  xmlLookup.length === 2 &&
    xmlLookup[0] === "content:config" &&
    xmlLookup[1] === "ext:xml:application/xml",
);

const emptySpec = { root: "main", elements: {} } as SandboxRecord["spec"];
function record(
  partial: Pick<SandboxRecord, "key" | "scope" | "savedAt"> &
    Partial<SandboxRecord>,
): SandboxRecord {
  return {
    extension: "xml",
    mimeType: "application/xml",
    filenameHint: "example.xml",
    spec: emptySpec,
    inventedBy: "haiku",
    ...partial,
  };
}
const listed = dedupeSandboxRecords([
  record({
    key: "content:sitemap",
    scope: "content",
    dialect: "xml-sitemap",
    savedAt: 2,
  }),
  record({
    key: "kind:xml-sitemap",
    scope: "dialect",
    dialect: "xml-sitemap",
    savedAt: 3,
  }),
  record({
    key: "ext:xml:application/xml",
    scope: "extension",
    filenameHint: "config.xml",
    savedAt: 1,
  }),
  record({
    key: "content:config",
    scope: "content",
    filenameHint: "config.xml",
    savedAt: 4,
  }),
]);
check(
  "saved list keeps dialect and generic xml content",
  listed.map((r) => r.key).join(",") === "content:config,kind:xml-sitemap",
);
const listedDialectOnly = dedupeSandboxRecords([
  record({
    key: "kind:xml-sitemap",
    scope: "dialect",
    dialect: "xml-sitemap",
    savedAt: 3,
  }),
  record({
    key: "ext:xml:application/xml",
    scope: "extension",
    savedAt: 1,
  }),
]);
check(
  "dialect does not hide the extension template",
  listedDialectOnly.map((r) => r.key).join(",") ===
    "kind:xml-sitemap,ext:xml:application/xml",
);
check(
  "dialect contrib filename is the dialect id",
  contribFilename(
    record({
      key: "kind:xml-sitemap",
      scope: "dialect",
      dialect: "xml-sitemap",
      savedAt: 3,
    }),
  ) === "xml-sitemap.json",
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\ninvent-smoke ok");
