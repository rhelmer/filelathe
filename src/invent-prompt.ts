import { catalog } from "./catalog";

export type InventInput = {
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  sampleText: string | null;
  hexPreview: string;
  sourceUrl?: string | null;
};

export function detectContentKind(
  filename: string,
  sampleText: string | null,
): {
  kind: string;
  hint: string;
  language: string;
} {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";

  if (
    name.endsWith(".toml") ||
    name.endsWith(".ini") ||
    name.endsWith(".cfg")
  ) {
    return {
      kind: "toml/ini config",
      language: "toml",
      hint: "Mini-app: Tabs for Overview (parsed key highlights as Badge/Text) | Edit (Textarea with full sample in state) | Raw. Prefer editing over a static dump.",
    };
  }
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return {
      kind: "yaml",
      language: "yaml",
      hint: "Mini-app: Tabs Overview | Edit (Textarea bound to state) | Raw. Surface top-level keys as Badges.",
    };
  }
  if (
    name.endsWith(".json") ||
    name.endsWith(".jsonl") ||
    sample.startsWith("{") ||
    sample.startsWith("[")
  ) {
    return {
      kind: "json",
      language: "json",
      hint: "Mini-app: Tabs Overview (Metrics/Badges for key fields) | Edit (Textarea with pretty JSON in state) | Raw. Not a single Markdown dump.",
    };
  }
  if (
    name.endsWith(".xml") ||
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    sample.startsWith("<")
  ) {
    return {
      kind: "markup",
      language: "xml",
      hint: "Mini-app: Tabs Preview (MarkdownView fenced) | Edit (Textarea) | Structure notes (Alert). Keep editable.",
    };
  }
  if (/\.lhs$/i.test(name)) {
    return {
      kind: "literate haskell",
      language: "haskell",
      hint: "Mini-app for literate Haskell: Tabs — Code (only lines starting with '>' stripped of the bird track, in a Textarea or fenced MarkdownView) | Literate (full sample) | Notes (Alert explaining bird-style '>' code vs prose). Put both views' text in Spec.state. Do NOT only show one static card with a tip.",
    };
  }
  if (/\.hs$/i.test(name)) {
    return {
      kind: "haskell",
      language: "haskell",
      hint: "Mini-app: Tabs Code (Textarea/Markdown fence) | Exports (Badges for module/imports if present) | Raw. Editable source in state.",
    };
  }
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|swift|sql|css|scss|sh|bash|zsh)$/i.test(
      name,
    )
  ) {
    const language = name.split(".").pop() || "code";
    return {
      kind: "source code",
      language,
      hint: `Mini-app: Tabs Code (editable Textarea or Markdown fence for ${language}) | Symbols (Badges for imports/exports/functions if obvious from sample) | Raw. Source must live in Spec.state so it can be edited.`,
    };
  }
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return {
      kind: "markdown",
      language: "markdown",
      hint: "Mini-app: Tabs Preview (MarkdownView) | Edit (Textarea bound to same markdown state). Two-way feel via shared state path.",
    };
  }
  if (sample.length > 0) {
    return {
      kind: "text",
      language: "text",
      hint: "Mini-app: Tabs Text (editable Textarea) | Hex (Text with hexPreview). Avoid a single static paragraph.",
    };
  }
  return {
    kind: "binary/unknown",
    language: "bin",
    hint: "Mini-app: metadata Stack + Hex Textarea/Text + Alert that no text decode was possible. Optional Badge for mime/size.",
  };
}

/**
 * Prompt Haiku to invent a json-render Spec using the live catalog.
 */
export function buildInventPrompt(input: InventInput): string {
  const sample = (input.sampleText ?? "").slice(0, 2400);
  const hex = input.hexPreview.slice(0, 800);
  const detected = detectContentKind(input.filename, input.sampleText);

  const catalogPrompt = catalog.prompt({
    mode: "standalone",
    system:
      "You invent a small interactive json-render mini-app Spec for an unrecognized dropped file — not a static dump viewer.",
    customRules: [
      "Never invent an emulator, CPU, disk controller, ROM runner, or game console. If the file needs one, the host will use BinaryInspector or a registered player instead.",
      "Never use InventedViewer or BinaryInspector (host wrappers).",
      "Do not use AudioPlayer, VideoPlayer, PdfViewer, PixelEditor, TrackerPlayer, Spreadsheet, or WebPageViewer unless the file data clearly fits and you inline all required props.",
      "Put file contents in Spec.state and bind Textarea / MarkdownView / Tabs via $bindState or $state. Every $bindState/$state path MUST appear in the top-level state object with a real initial value from the file sample.",
      'Example state: {"activeTab":"code","codeExtracted":"...","literateSource":"..."}.',
      "Build a MINI-APP, not a poster: prefer Tabs (or Accordion) with at least two panes — e.g. Preview/Code + Edit, or Overview + Raw.",
      "Card is only a border shell (title/description null — window chrome already shows the name).",
      "Do not invent fake file contents — copy from the sample (for .lhs Code tab, strip leading '>' bird tracks).",
      "Use Badge, Alert, Heading, Text, Separator for structure. Buttons are fine for secondary chrome (even if actions are no-ops).",
      "Typical size: 6–14 elements. Avoid a 3-element Card→Markdown→Alert dump.",
      "Every props field required by the catalog must be present (use null where nullable).",
      'Textarea/Input label must be a string (use "" if unlabeled), never null.',
      'Leaf elements must include "children": [].',
      "Nullable prop omissions: always include nullable keys with null rather than omitting them.",
    ],
  });

  return `${catalogPrompt}

---

TASK
Invent an interactive mini-app Spec for this file. Follow SpecStream JSONL from the catalog prompt.

Goal: someone who dropped this file should be able to inspect AND work with it (switch views, edit text, see structured highlights) — not just read a summary card.

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
