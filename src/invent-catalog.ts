/**
 * Slim catalog for Haiku invent prompts — layout + text chrome only.
 * Keeps SpecStream schemas small and steers away from media/host wrappers.
 */

import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

const INVENT_SHADCN = [
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
  "Link",
] as const;

function pickShadcn(names: readonly string[]) {
  const all = shadcnComponentDefinitions as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const def = all[name];
    if (!def) continue;
    const props = (def as { props?: z.ZodObject<z.ZodRawShape> }).props;
    if (props?.shape && "className" in props.shape) {
      out[name] = { ...def, props: props.omit({ className: true }) };
    } else {
      out[name] = def;
    }
  }
  return out;
}

const inventExtras = {
  MarkdownView: {
    props: z.object({
      markdown: z.string(),
      title: z.string().nullable(),
    }),
    description:
      "Rendered Markdown (GFM). Prefer for Preview panes; put body in Spec.state and $bindState when editable elsewhere.",
  },
  Metric: {
    props: z.object({
      label: z.string(),
      value: z.string(),
      change: z.string().nullable(),
      changeType: z.enum(["positive", "negative", "neutral"]).nullable(),
      prefix: z.string().nullable(),
      suffix: z.string().nullable(),
    }),
    description: "Small KPI chip for Overview panes (file size, key count, etc.)",
  },
};

export const inventCatalog = defineCatalog(schema, {
  components: {
    ...pickShadcn(INVENT_SHADCN),
    ...inventExtras,
  },
  actions: {
    formSubmit: {
      description: "Demo form toast (no network)",
      params: z.object({ formName: z.string() }),
    },
  },
});

export const INVENT_COMPONENT_NAMES = inventCatalog.componentNames;
