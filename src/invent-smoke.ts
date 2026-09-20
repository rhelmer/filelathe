/**
 * Offline invent quality smoke (no API keys).
 *
 *   pnpm invent-smoke
 */
import {
  assessInventedSpecQuality,
  formatQualityIssues,
} from "./invent-quality";
import { detectContentKind } from "./invent-prompt";
import {
  buildFallbackSpec,
  parseInventedSpec,
  validateInventedSpec,
} from "./invent-viewer";
import { hydrateInventedSpec } from "./invent-hydrate";
import { scrubPromptForContrib, scrubSpecForContrib } from "./contrib-scrub";
import type { InventInput } from "./invent-prompt";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

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
check("poster flagged", posterIssues.some((i) => i.code === "poster" || i.code === "no_panes"));

console.log("parse SpecStream few-shot shape");
const stream = [
  '{"op":"set","path":"/state","value":{"activeTab":"text","body":"hi","hex":"00"}}',
  '{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}',
  '{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"text","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Text","value":"text"},{"label":"Hex","value":"hex"}]},"children":["paneText","paneHex"]}}',
  '{"op":"add","path":"/elements/paneText","value":{"type":"Textarea","props":{"label":"Contents","name":"body","placeholder":null,"rows":8,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}',
  '{"op":"add","path":"/elements/paneHex","value":{"type":"Textarea","props":{"label":"Hex","name":"hex","placeholder":null,"rows":8,"value":{"$bindState":"/hex"},"checks":null,"validateOn":null},"children":[]}}',
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

console.log("contrib scrub");
const dirty = buildFallbackSpec(fixtures[0]!);
const scrubbed = scrubSpecForContrib(dirty);
const blob = JSON.stringify(scrubbed);
check("scrub removes sample", !blob.includes("filelathe"));
const prompt = `Sample text (may be truncated; use as real content in state/props):\nSECRET_TOKEN=abc\n\nHex preview (use in a Hex tab when useful):\n000000  ff\n`;
const scrubbedPrompt = scrubPromptForContrib(prompt)!;
check("scrub prompt", !scrubbedPrompt.includes("SECRET_TOKEN"));

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\ninvent-smoke ok");
