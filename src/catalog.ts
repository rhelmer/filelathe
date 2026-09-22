import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

/** Playground-style dashboard widgets + media (not in @json-render/shadcn). */
const dashboardExtras = {
  Metric: {
    props: z.object({
      label: z.string(),
      value: z.string(),
      change: z.string().nullable(),
      changeType: z.enum(["positive", "negative", "neutral"]).nullable(),
      prefix: z.string().nullable(),
      suffix: z.string().nullable(),
    }),
    description: "Key metric / KPI display for dashboards",
  },
  BarGraph: {
    props: z.object({
      title: z.string().nullable(),
      data: z.array(z.object({ label: z.string(), value: z.number() })),
    }),
    description: "Vertical bar chart",
  },
  AudioPlayer: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable(),
      autoplay: z.boolean().nullable(),
    }),
    events: ["play", "pause", "ended"],
    description:
      "HTML audio player with native transport controls for a loaded track",
  },
  PixelEditor: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable(),
    }),
    description:
      "Canvas pixel editor for a loaded image: brush, colors, reset, download PNG",
  },
  Spreadsheet: {
    props: z.object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
      caption: z.string().nullable(),
    }),
    description:
      "Editable spreadsheet for CSV data: edit cells, add rows/columns, download CSV",
  },
  PdfViewer: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable(),
    }),
    description: "Embedded PDF viewer with open-in-new-tab link",
  },
  VideoPlayer: {
    props: z.object({
      src: z.string(),
      title: z.string().nullable(),
    }),
    description: "HTML video player with native transport controls",
  },
  TrackerPlayer: {
    props: z.object({
      moduleId: z.string(),
      title: z.string().nullable(),
      format: z.string(),
      channels: z.number().nullable(),
    }),
    description:
      "libopenmpt / chiptune3 player for XM, MOD, IT, S3M and other tracker modules",
  },
  MarkdownView: {
    props: z.object({
      markdown: z.string(),
      title: z.string().nullable(),
    }),
    description:
      "Rendered Markdown document with GFM (tables, strikethrough, task lists)",
  },
  WebPageViewer: {
    props: z.object({
      html: z.string(),
      sourceUrl: z.string().nullable(),
      title: z.string().nullable(),
    }),
    description:
      "Fetched HTML webpage snapshot: sandboxed Preview iframe + Source tab + open-original link",
  },
  BinaryInspector: {
    props: z.object({
      filename: z.string(),
      mimeType: z.string(),
      size: z.number(),
      hexPreview: z.string(),
      sampleText: z.string().nullable(),
      note: z.string().nullable(),
      playerHint: z.string().nullable(),
    }),
    description:
      "Hex/metadata inspector for opaque binaries and for formats whose emulator is planned but not wired. Never a fake emulator.",
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
          isDir: z.boolean(),
        }),
      ),
      peekText: z.string().nullable(),
      peekXml: z.string().nullable(),
      hexPreview: z.string(),
      note: z.string().nullable(),
    }),
    description:
      "Browser for compressed containers (ZIP/ODT/DOCX/XLSX/PPTX/EPUB/gzip/tar): entry listing, extracted document text, click-to-open an entry as its own window. Container bytes stay client-side; never invent this.",
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
        sourceUrl: z.string().nullable(),
      }),
    }),
    description:
      "Host wrapper: editable Haiku invent prompt + nested Renderer for an invented catalog Spec (pass Spec as specJson string). Do not nest InventedViewer inside invented Specs.",
  },
};

/** className is `.nullable()` but not optional — omit it for composition validation. */
function withoutClassName(
  definitions: typeof shadcnComponentDefinitions,
): typeof shadcnComponentDefinitions {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => {
      const props = definition.props as z.ZodObject<z.ZodRawShape>;
      if (!props.shape || !("className" in props.shape)) {
        return [name, definition];
      }
      return [name, { ...definition, props: props.omit({ className: true }) }];
    }),
  ) as typeof shadcnComponentDefinitions;
}

export const catalog = defineCatalog(schema, {
  components: {
    ...withoutClassName(shadcnComponentDefinitions),
    ...dashboardExtras,
  },
  actions: {
    formSubmit: {
      description:
        "Validate form fields and show a demo toast (does not send data)",
      params: z.object({ formName: z.string() }),
    },
  },
});
