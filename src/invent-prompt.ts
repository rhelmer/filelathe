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
};

export function detectContentKind(
  filename: string,
  sampleText: string | null,
): DetectedContent {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";

  if (
    name.endsWith(".edn") ||
    name.endsWith(".clj") ||
    name.endsWith(".cljs") ||
    (/^\s*[;({[]/.test(sample) && /:\w+/.test(sample))
  ) {
    return {
      kind: "edn/clojure config",
      language: "edn",
      hint: "Mini-app: Tabs Text (editable Textarea bound to /body) | Hex | Structure (Alert or Badges for top-level keys like :app/:format). Put full sample in state.body.",
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
      hint: "Mini-app: Tabs Overview (Badge/Text for section keys) | Edit (Textarea /body) | Raw. Prefer editing over a static dump.",
    };
  }
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return {
      kind: "yaml",
      language: "yaml",
      hint: "Mini-app: Tabs Overview | Edit (Textarea /body) | Raw. Surface top-level keys as Badges.",
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
      hint: "Mini-app: Tabs Overview (Metric/Badge for key fields) | Edit (Textarea with pretty JSON in /body) | Raw. Not a single Markdown dump.",
    };
  }
  if (
    name.endsWith(".xml") ||
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    name.endsWith(".svg") ||
    sample.startsWith("<")
  ) {
    return {
      kind: "markup",
      language: name.endsWith(".svg") ? "svg" : "xml",
      hint: "Mini-app: Tabs Preview (MarkdownView fenced) | Edit (Textarea /body) | Notes (Alert). Keep editable.",
    };
  }
  if (/\.lhs$/i.test(name)) {
    return {
      kind: "literate haskell",
      language: "haskell",
      hint: "Mini-app: Tabs Code (bird '>' lines stripped into Textarea /code) | Literate (full /body) | Notes (Alert). Both texts in Spec.state.",
    };
  }
  if (/\.hs$/i.test(name)) {
    return {
      kind: "haskell",
      language: "haskell",
      hint: "Mini-app: Tabs Code (Textarea /body) | Exports (Badges) | Raw.",
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
      hint: `Mini-app: Tabs Code (Textarea /body for ${language}) | Symbols (Badges) | Raw.`,
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
      hint: "Mini-app: Tabs Log (Textarea /body) | Hex | Notes (Alert with line count / size).",
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
      hint: "Mini-app: Tabs Edit (Textarea /body) | Hex | Notes. Never invent fake secrets — use the sample only.",
    };
  }
  if (sample.length > 0) {
    return {
      kind: "text",
      language: "text",
      hint: "Mini-app: Tabs Text (Textarea /body) | Hex (Text or Textarea /hex from hexPreview). Avoid a single static paragraph.",
    };
  }
  return {
    kind: "binary/unknown",
    language: "bin",
    hint: "Mini-app: Tabs Hex (Textarea /hex) | Meta (Badges for mime/size + Alert). No fake text decode.",
  };
}

/** Compact SpecStream few-shots — structure only; bodies are placeholders. */
const FEW_SHOTS = `
EXAMPLE (config / text — follow this shape; replace bodies from the real sample):
{"op":"set","path":"/state","value":{"activeTab":"text","body":"(file sample here)","hex":"(hex preview here)"}}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}
{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"text","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Text","value":"text"},{"label":"Hex","value":"hex"}]},"children":["paneText","paneHex"]}}
{"op":"add","path":"/elements/paneText","value":{"type":"Textarea","props":{"label":"Contents","name":"body","placeholder":null,"rows":12,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}
{"op":"add","path":"/elements/paneHex","value":{"type":"Textarea","props":{"label":"Hex","name":"hex","placeholder":null,"rows":10,"value":{"$bindState":"/hex"},"checks":null,"validateOn":null},"children":[]}}
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

  const catalogPrompt = inventCatalog.prompt({
    mode: "standalone",
    system:
      "You invent a small interactive json-render mini-app Spec for an unrecognized dropped file — not a static dump viewer.",
    customRules: [
      `Only use these components: ${inventCatalog.componentNames.join(", ")}.`,
      "Never invent an emulator, CPU, disk controller, ROM runner, or game console.",
      "Never use InventedViewer, BinaryInspector, AudioPlayer, VideoPlayer, PdfViewer, PixelEditor, TrackerPlayer, Spreadsheet, or WebPageViewer.",
      "Put file contents in Spec.state and bind Textarea / MarkdownView / Tabs via $bindState or $state. Every $bindState/$state path MUST appear in top-level state with a real initial value from the sample.",
      'Example state: {"activeTab":"text","body":"…","hex":"…"}.',
      "Build a MINI-APP: Tabs (preferred) or Accordion with ≥2 panes — e.g. Text|Hex, Preview|Edit, Overview|Raw.",
      "Card is only a border shell (title/description null — window chrome already shows the name).",
      "Do not invent fake file contents — copy from the sample (for .lhs Code tab, strip leading '>' bird tracks).",
      "Use Badge, Alert, Heading, Text, Separator, Metric for structure.",
      "Typical size: 6–14 elements. Forbidden: a 3-element Card→Markdown→Alert poster.",
      "Every required props field must be present (null where nullable).",
      'Textarea/Input label must be a string (use "" if unlabeled), never null.',
      'Leaf elements must include "children": [].',
    ],
  });

  return `${catalogPrompt}

---
${FEW_SHOTS}
---

TASK
Invent an interactive mini-app Spec for this file. Follow SpecStream JSONL from the catalog prompt (same shape as the examples).

Goal: inspect AND work with the file (switch views, edit text, see highlights) — not a summary card.

Detected: ${detected.kind} (language=${detected.language})
App guidance: ${detected.hint}

File metadata:
- title: ${JSON.stringify(input.title)}
- filename: ${JSON.stringify(input.filename)}
- mimeType: ${JSON.stringify(input.mimeType)}
- size: ${input.size} bytes
- sourceUrl: ${JSON.stringify(input.sourceUrl ?? null)}

Sample text (may be truncated; use as real content in state/props):
${sample || "(empty — binary or no decode)"}

Hex preview (use in a Hex tab when useful):
${hex || "(empty)"}
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

Emit a corrected SpecStream JSONL only. Keep Tabs (≥2) + Textarea bound to Spec.state with real sample/hex values. No poster Card→Markdown dumps.
`;
}
