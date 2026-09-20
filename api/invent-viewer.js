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

// src/invent-prompt.ts
function detectContentKind(filename, sampleText) {
  const name = filename.toLowerCase();
  const sample = sampleText?.trim() ?? "";
  if (name.endsWith(".edn") || name.endsWith(".clj") || name.endsWith(".cljs") || /^\s*[;({[]/.test(sample) && /:\w+/.test(sample)) {
    return {
      kind: "edn/clojure config",
      language: "edn",
      hint: "Mini-app: Tabs Text (editable Textarea bound to /body) | Hex | Structure (Alert or Badges for top-level keys like :app/:format). Put full sample in state.body."
    };
  }
  if (name.endsWith(".toml") || name.endsWith(".ini") || name.endsWith(".cfg") || name.endsWith(".conf") || name.endsWith(".properties")) {
    return {
      kind: "toml/ini config",
      language: name.endsWith(".properties") ? "properties" : "toml",
      hint: "Mini-app: Tabs Overview (Badge/Text for section keys) | Edit (Textarea /body) | Raw. Prefer editing over a static dump."
    };
  }
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return {
      kind: "yaml",
      language: "yaml",
      hint: "Mini-app: Tabs Overview | Edit (Textarea /body) | Raw. Surface top-level keys as Badges."
    };
  }
  if (name.endsWith(".json") || name.endsWith(".jsonl") || name.endsWith(".jsonc") || sample.startsWith("{") || sample.startsWith("[")) {
    return {
      kind: "json",
      language: "json",
      hint: "Mini-app: Tabs Overview (Metric/Badge for key fields) | Edit (Textarea with pretty JSON in /body) | Raw. Not a single Markdown dump."
    };
  }
  if (name.endsWith(".xml") || name.endsWith(".html") || name.endsWith(".htm") || name.endsWith(".svg") || sample.startsWith("<")) {
    return {
      kind: "markup",
      language: name.endsWith(".svg") ? "svg" : "xml",
      hint: "Mini-app: Tabs Preview (MarkdownView fenced) | Edit (Textarea /body) | Notes (Alert). Keep editable."
    };
  }
  if (/\.lhs$/i.test(name)) {
    return {
      kind: "literate haskell",
      language: "haskell",
      hint: "Mini-app: Tabs Code (bird '>' lines stripped into Textarea /code) | Literate (full /body) | Notes (Alert). Both texts in Spec.state."
    };
  }
  if (/\.hs$/i.test(name)) {
    return {
      kind: "haskell",
      language: "haskell",
      hint: "Mini-app: Tabs Code (Textarea /body) | Exports (Badges) | Raw."
    };
  }
  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|swift|sql|css|scss|sh|bash|zsh|lua|r|pl)$/i.test(
    name
  )) {
    const language = name.split(".").pop() || "code";
    return {
      kind: "source code",
      language,
      hint: `Mini-app: Tabs Code (Textarea /body for ${language}) | Symbols (Badges) | Raw.`
    };
  }
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".rst") || name.endsWith(".adoc")) {
    return {
      kind: "markdown",
      language: "markdown",
      hint: "Mini-app: Tabs Preview (MarkdownView bound to /body) | Edit (Textarea same /body)."
    };
  }
  if (name.endsWith(".log") || name.endsWith(".out") || /\d{4}-\d{2}-\d{2}[ t]\d{2}:\d{2}/i.test(sample.slice(0, 400))) {
    return {
      kind: "log",
      language: "text",
      hint: "Mini-app: Tabs Log (Textarea /body) | Hex | Notes (Alert with line count / size)."
    };
  }
  if (name.endsWith(".plist") || name.endsWith(".strings") || name.endsWith(".env") || name.endsWith(".env.example")) {
    return {
      kind: "env/plist",
      language: "text",
      hint: "Mini-app: Tabs Edit (Textarea /body) | Hex | Notes. Never invent fake secrets \u2014 use the sample only."
    };
  }
  if (sample.length > 0) {
    return {
      kind: "text",
      language: "text",
      hint: "Mini-app: Tabs Text (Textarea /body) | Hex (Text or Textarea /hex from hexPreview). Avoid a single static paragraph."
    };
  }
  return {
    kind: "binary/unknown",
    language: "bin",
    hint: "Mini-app: Tabs Hex (Textarea /hex) | Meta (Badges for mime/size + Alert). No fake text decode."
  };
}
var FEW_SHOTS = `
EXAMPLE (config / text \u2014 follow this shape; replace bodies from the real sample):
{"op":"set","path":"/state","value":{"activeTab":"text","body":"(file sample here)","hex":"(hex preview here)"}}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":null,"description":null,"maxWidth":"full","centered":null},"children":["tabs"]}}
{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"defaultValue":"text","value":{"$bindState":"/activeTab"},"tabs":[{"label":"Text","value":"text"},{"label":"Hex","value":"hex"}]},"children":["paneText","paneHex"]}}
{"op":"add","path":"/elements/paneText","value":{"type":"Textarea","props":{"label":"Contents","name":"body","placeholder":null,"rows":12,"value":{"$bindState":"/body"},"checks":null,"validateOn":null},"children":[]}}
{"op":"add","path":"/elements/paneHex","value":{"type":"Textarea","props":{"label":"Hex","name":"hex","placeholder":null,"rows":10,"value":{"$bindState":"/hex"},"checks":null,"validateOn":null},"children":[]}}
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
  const catalogPrompt = inventCatalog.prompt({
    mode: "standalone",
    system: "You invent a small interactive json-render mini-app Spec for an unrecognized dropped file \u2014 not a static dump viewer.",
    customRules: [
      `Only use these components: ${inventCatalog.componentNames.join(", ")}.`,
      "Never invent an emulator, CPU, disk controller, ROM runner, or game console.",
      "Never use InventedViewer, BinaryInspector, AudioPlayer, VideoPlayer, PdfViewer, PixelEditor, TrackerPlayer, Spreadsheet, or WebPageViewer.",
      "Put file contents in Spec.state and bind Textarea / MarkdownView / Tabs via $bindState or $state. Every $bindState/$state path MUST appear in top-level state with a real initial value from the sample.",
      'Example state: {"activeTab":"text","body":"\u2026","hex":"\u2026"}.',
      "Build a MINI-APP: Tabs (preferred) or Accordion with \u22652 panes \u2014 e.g. Text|Hex, Preview|Edit, Overview|Raw.",
      "Card is only a border shell (title/description null \u2014 window chrome already shows the name).",
      "Do not invent fake file contents \u2014 copy from the sample (for .lhs Code tab, strip leading '>' bird tracks).",
      "Use Badge, Alert, Heading, Text, Separator, Metric for structure.",
      "Typical size: 6\u201314 elements. Forbidden: a 3-element Card\u2192Markdown\u2192Alert poster.",
      "Every required props field must be present (null where nullable).",
      'Textarea/Input label must be a string (use "" if unlabeled), never null.',
      'Leaf elements must include "children": [].'
    ]
  });
  return `${catalogPrompt}

---
${FEW_SHOTS}
---

TASK
Invent an interactive mini-app Spec for this file. Follow SpecStream JSONL from the catalog prompt (same shape as the examples).

Goal: inspect AND work with the file (switch views, edit text, see highlights) \u2014 not a summary card.

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
function buildInventRepairPrompt(options) {
  return `${options.basePrompt}

---

REPAIR
Your previous Spec was rejected:
${options.errors}

Previous output (truncate if needed \u2014 fix the issues, do not explain):
${options.previousOutput.slice(0, 3500)}

Emit a corrected SpecStream JSONL only. Keep Tabs (\u22652) + Textarea bound to Spec.state with real sample/hex values. No poster Card\u2192Markdown dumps.
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
  const pretty = tryPrettyJson(sample);
  if (/^(active)?tab$/i.test(leaf) || leaf === "selectedtab") return tabDefault;
  if (/hex/i.test(leaf)) return input.hexPreview;
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
  const state = spec.state ?? {};
  const stateKeys = Object.keys(state);
  const hasBind = JSON.stringify(spec.elements ?? {}).includes('"$bindState"') || JSON.stringify(spec.elements ?? {}).includes('"$state"');
  if (!hasBind && stateKeys.length === 0) {
    issues.push({
      code: "no_state",
      message: "No Spec.state and no $bindState/$state \u2014 put file contents in state and bind panes."
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
  if (hasText) {
    return {
      root: "card",
      state: {
        activeTab: "text",
        body,
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
            defaultValue: "text",
            value: { $bindState: "/activeTab" },
            tabs: [
              { label: "Text", value: "text" },
              { label: "Hex", value: "hex" }
            ]
          },
          children: ["paneText", "paneHex"]
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
            value: { $bindState: "/body" }
          },
          children: []
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
            value: { $bindState: "/hex" }
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
