import type { Spec } from "@json-render/core";

export type InventQualityIssue = {
  code: string;
  message: string;
};

/**
 * Reject “poster” Specs and generic Text|Hex dumps for structured text.
 * Haiku should build Overview/Structure/Source-style mini-apps.
 */
export function assessInventedSpecQuality(spec: Spec): InventQualityIssue[] {
  const issues: InventQualityIssue[] = [];
  const elements = Object.values(spec.elements ?? {});
  const types = new Set(elements.map((el) => el.type));
  const n = elements.length;

  if (n < 4) {
    issues.push({
      code: "too_small",
      message: `Only ${n} elements — need a mini-app (≥4), not a poster.`,
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
      message: "Missing Tabs or Accordion — need at least two panes.",
    });
  }

  const interactive =
    hasTextarea || types.has("Input") || hasTabs || hasAccordion;
  if (!interactive) {
    issues.push({
      code: "not_interactive",
      message: "No interactive controls (Tabs/Accordion/Textarea/Input).",
    });
  }

  // Classic poster: Card → MarkdownView/Text/Alert only
  const leafTypes = [...types].filter(
    (t) => !["Card", "Stack", "Grid", "Separator"].includes(t),
  );
  const onlyStatic =
    leafTypes.length > 0 &&
    leafTypes.every((t) =>
      ["MarkdownView", "Text", "Alert", "Heading", "Badge", "Metric"].includes(
        t,
      ),
    );
  if (onlyStatic && !hasTabs && !hasAccordion && !hasTextarea) {
    issues.push({
      code: "poster",
      message:
        "Looks like a static dump (Card/Markdown/Text only). Add Tabs + Edit Textarea bound to Spec.state.",
    });
  }

  // Generic dump: only Text + Hex tab labels
  if (hasTabs) {
    for (const el of elements) {
      if (el.type !== "Tabs") continue;
      const tabs = (
        el.props as { tabs?: Array<{ label?: string; value?: string }> }
      ).tabs;
      if (!Array.isArray(tabs) || tabs.length < 2) {
        issues.push({
          code: "tabs_thin",
          message: "Tabs must list at least two panes.",
        });
        continue;
      }
      const labels = tabs.map((t) =>
        String(t.label ?? t.value ?? "").toLowerCase(),
      );
      const onlyTextHex =
        labels.length === 2 &&
        labels.some((l) => /^(text|source|raw|body|contents)$/.test(l)) &&
        labels.some((l) => /^hex/.test(l));
      if (onlyTextHex) {
        issues.push({
          code: "text_hex_dump",
          message:
            "Tabs are only Text|Hex — for structured files use Overview (what/checks) + Structure + Source instead of a hex dump.",
        });
      }
      const kids = el.children ?? [];
      if (kids.length < 2) {
        issues.push({
          code: "tabs_no_children",
          message:
            "Tabs must include ≥2 child element ids (one panel per tab).",
        });
      }
    }
  }

  const state = (spec.state ?? {}) as Record<string, unknown>;
  const stateKeys = Object.keys(state);
  const hasBind =
    JSON.stringify(spec.elements ?? {}).includes('"$bindState"') ||
    JSON.stringify(spec.elements ?? {}).includes('"$state"');
  if (!hasBind && stateKeys.length === 0) {
    issues.push({
      code: "no_state",
      message:
        "No Spec.state and no $bindState/$state — put file contents in state and bind panes.",
    });
  }

  // Soft nudge: structured mini-apps should explain themselves
  if (
    hasTabs &&
    hasTextarea &&
    !hasMarkdown &&
    !hasMetricOrBadge &&
    !types.has("Alert")
  ) {
    issues.push({
      code: "no_overview",
      message:
        "Add an Overview (MarkdownView /summary) or Structure Metrics/Badges/Alert explaining what the file is and basic checks.",
    });
  }

  return issues;
}

export function formatQualityIssues(issues: InventQualityIssue[]): string {
  return issues.map((i) => `${i.code}: ${i.message}`).join("; ");
}
