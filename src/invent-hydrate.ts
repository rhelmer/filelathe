import type { Spec } from "@json-render/core";
import type { InventInput } from "./invent-prompt";

function extractBirdCode(sample: string): string {
  return sample
    .split("\n")
    .filter((line) => line.startsWith(">"))
    .map((line) => line.replace(/^>\s?/, ""))
    .join("\n");
}

function fenceAs(language: string, body: string): string {
  const safe = body.replace(/```/g, "'''");
  return "```" + language + "\n" + safe + "\n```";
}

function collectStatePaths(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectStatePaths(item, into);
    return;
  }
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(obj)) {
    if (
      (key === "$bindState" || key === "$state") &&
      typeof child === "string" &&
      child.startsWith("/")
    ) {
      into.add(child);
    } else {
      collectStatePaths(child, into);
    }
  }
}

function getByPointer(state: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  let cur: unknown = state;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function setByPointer(
  state: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return;
  let cur: Record<string, unknown> = state;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = cur[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function defaultTabValue(spec: Spec): string {
  for (const el of Object.values(spec.elements ?? {})) {
    if (el.type !== "Tabs") continue;
    const props = el.props as {
      defaultValue?: string | null;
      tabs?: Array<{ value: string }>;
    };
    if (props.defaultValue) return props.defaultValue;
    if (props.tabs?.[0]?.value) return props.tabs[0].value;
  }
  return "code";
}

function seedValueForPath(
  path: string,
  input: InventInput,
  tabDefault: string,
): unknown {
  const leaf = path.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
  const sample = input.sampleText ?? "";
  const bird = extractBirdCode(sample);
  const lang = input.filename.includes(".")
    ? input.filename.split(".").pop() || "text"
    : "text";

  if (/^(active)?tab$/i.test(leaf) || leaf === "selectedtab") return tabDefault;
  if (/hex/i.test(leaf)) return input.hexPreview;
  if (
    /extract|bird/i.test(leaf) ||
    (leaf.includes("code") && !leaf.includes("source"))
  ) {
    return bird || sample;
  }
  if (
    /literate|raw|full|source|content|text|body|edit|markdown|sample|code/i.test(
      leaf,
    )
  ) {
    if (/markdown|preview/i.test(leaf) && sample) {
      return fenceAs(
        lang === "lhs" || lang === "hs" ? "haskell" : lang,
        sample,
      );
    }
    return sample || input.hexPreview;
  }
  return sample || tabDefault;
}

/**
 * Haiku often wires $bindState/$state but omits Spec.state — without seeds,
 * Tabs visibility and Textareas are empty/non-functional. Fill gaps from the file.
 */
export function hydrateInventedSpec(spec: Spec, input: InventInput): Spec {
  const paths = new Set<string>();
  collectStatePaths(spec, paths);
  collectStatePaths(spec.elements, paths);

  const state: Record<string, unknown> = {
    ...((spec.state as Record<string, unknown> | undefined) ?? {}),
  };
  const tabDefault = defaultTabValue(spec);

  for (const path of paths) {
    const existing = getByPointer(state, path);
    const leaf = path.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
    const forceLhsCode =
      /\.lhs$/i.test(input.filename) && /code|extract|bird/i.test(leaf);
    const forceFileContent =
      /source|code|text|content|raw|literate|markdown|body|edit|sample/i.test(
        leaf,
      ) &&
      typeof existing === "string" &&
      existing.length === 0;
    if (
      forceLhsCode ||
      forceFileContent ||
      existing === undefined ||
      existing === ""
    ) {
      setByPointer(state, path, seedValueForPath(path, input, tabDefault));
    }
  }

  const elements = { ...spec.elements };
  for (const [key, el] of Object.entries(elements)) {
    const props = { ...(el.props as Record<string, unknown>) };
    if (
      (el.type === "Textarea" || el.type === "Input") &&
      (props.label === null || props.label === undefined)
    ) {
      props.label = "";
    }
    if (
      (el.type === "Textarea" || el.type === "Input") &&
      props.checks === undefined
    ) {
      props.checks = null;
    }
    elements[key] = {
      ...el,
      props,
      children: el.children ?? [],
    };
  }

  return {
    ...spec,
    elements,
    state: Object.keys(state).length > 0 ? state : spec.state,
  };
}
