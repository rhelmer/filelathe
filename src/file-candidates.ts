import type {
  Experimental_CompositionCandidate,
  UIElement,
} from "@json-render/core";
import { flattenJsonFields, type LoadedFile } from "./files";

export const MAX_ELEMENTS = 14;
export type Candidate = Experimental_CompositionCandidate;

/** Focused candidate set for a loaded file — Jev only lays these out. */
export function buildFileCandidates(file: LoadedFile): Candidate[] {
  const candidates: Candidate[] = [];
  function add(
    id: string,
    description: string,
    type: string,
    props: Record<string, unknown>,
    resource?: string,
    on?: UIElement["on"],
    root = false,
  ) {
    candidates.push({
      id,
      description,
      resource,
      root,
      maxUses: ["Card", "Stack"].includes(type) ? MAX_ELEMENTS : 1,
      element: { type, props, ...(on ? { on } : {}) },
    });
  }

  add(
    "card",
    "Card: bordered container for the file content only (no title — the window chrome already shows name/type).",
    "Card",
    {
      title: null,
      description: null,
      maxWidth: "md",
      centered: true,
    },
    "layout:card",
    undefined,
    true,
  );
  add(
    "stack_vertical",
    "Stack: vertical layout for primary content only.",
    "Stack",
    { direction: "vertical", gap: "md", align: "stretch", justify: "start" },
    "layout:stack",
    undefined,
    true,
  );

  if (file.kind === "audio") {
    const durationBit = file.durationLabel ? ` (${file.durationLabel})` : "";
    add(
      "audio_player",
      `AudioPlayer: native controls for loaded track ${JSON.stringify(file.title)}${durationBit}. Always include for audio files.`,
      "AudioPlayer",
      {
        src: { $state: "/file/src" },
        title: null,
        autoplay: false,
      },
      "data:player",
    );
    add(
      "local_note",
      "Alert: audio is played locally in the browser.",
      "Alert",
      {
        title: "Local playback",
        message: "This track is played from a local blob URL in your browser.",
        type: "info",
      },
      "data:note",
    );
  }

  if (file.kind === "video") {
    const durationBit = file.durationLabel ? ` (${file.durationLabel})` : "";
    add(
      "video_player",
      `VideoPlayer: native controls for loaded clip ${JSON.stringify(file.title)}${durationBit}. Always include for video files.`,
      "VideoPlayer",
      {
        src: { $state: "/file/src" },
        title: null,
      },
      "data:player",
    );
  }

  if (file.kind === "pdf") {
    add(
      "pdf_viewer",
      `PdfViewer: embedded PDF for ${JSON.stringify(file.title)}. Always include for PDF files.`,
      "PdfViewer",
      {
        src: { $state: "/file/src" },
        title: null,
      },
      "data:pdf",
    );
  }

  if (file.kind === "tracker") {
    const channelBit =
      file.channels != null ? `, ${file.channels} channels` : "";
    add(
      "tracker_player",
      `TrackerPlayer: libopenmpt player for ${file.format.toUpperCase()} module ${JSON.stringify(file.title)}${channelBit}. Always include for tracker modules.`,
      "TrackerPlayer",
      {
        moduleId: { $state: "/file/moduleId" },
        title: { $state: "/file/title" },
        format: file.format,
        channels: file.channels,
      },
      "data:player",
    );
    add(
      "local_note",
      "Alert: tracker modules are decoded locally via libopenmpt WASM.",
      "Alert",
      {
        title: "Local module playback",
        message:
          "XM/MOD/IT/S3M and other libopenmpt formats play in your browser — bytes never leave this tab.",
        type: "info",
      },
      "data:note",
    );
  }

  if (file.kind === "image") {
    add(
      "pixel_editor",
      `PixelEditor: paint on loaded image ${JSON.stringify(file.title)}. Always include for image files.`,
      "PixelEditor",
      {
        src: { $state: "/file/src" },
        title: null,
      },
      "data:pixel_editor",
    );
  }

  if (file.kind === "text") {
    add(
      "document",
      "Text: body of the loaded document. Always include for text files.",
      "Text",
      { text: { $state: "/file/text" }, variant: "body" },
      "data:document",
    );
  }

  if (file.kind === "markdown") {
    add(
      "markdown",
      `MarkdownView: rendered Markdown for ${JSON.stringify(file.title)}. Always include for markdown files. Do not add extra titles — window chrome already shows the name.`,
      "MarkdownView",
      {
        markdown: { $state: "/file/markdown" },
        title: null,
      },
      "data:markdown",
    );
  }

  if (file.kind === "webpage") {
    add(
      "webpage",
      "WebPageViewer: sandboxed HTML snapshot preview + source for a fetched web page. Always include.",
      "WebPageViewer",
      {
        html: { $state: "/file/html" },
        sourceUrl: { $state: "/file/sourceUrl" },
        title: null,
      },
      "data:webpage",
    );
  }

  if (file.kind === "csv") {
    add(
      "spreadsheet",
      `Spreadsheet: editable grid with columns ${JSON.stringify(file.columns)}. Always include for CSV files.`,
      "Spreadsheet",
      {
        columns: file.columns,
        rows: file.rows,
        caption: null,
      },
      "data:spreadsheet",
    );
  }

  if (file.kind === "unknown") {
    add(
      "invented",
      "InventedViewer: host-rendered Spec invented by Haiku from the catalog, with editable prompt. Always include.",
      "InventedViewer",
      {
        specJson: JSON.stringify(
          file.inventedSpec ?? {
            root: "empty",
            elements: {
              empty: {
                type: "Text",
                props: { text: "Inventing…", variant: "muted" },
                children: [],
              },
            },
          },
        ),
        note: { $state: "/file/inventNote" },
        prompt: { $state: "/file/inventPrompt" },
        invent: {
          title: file.title,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          sampleText: file.sampleText,
          hexPreview: file.hexPreview,
          sourceUrl: file.sourceUrl,
        },
      },
      "data:invented",
    );
  }

  if (file.kind === "json") {
    for (const { path, value } of flattenJsonFields(file.data)) {
      const statePath = `/file/data/${path.replaceAll(".", "/")}`;
      const id = `field_${path.replaceAll(".", "_")}`;
      if (typeof value === "boolean") {
        add(
          id,
          `Switch: edit boolean field ${path} from the loaded JSON.`,
          "Switch",
          {
            name: path,
            label: path,
            checked: { $bindState: statePath },
            validateOn: null,
            checks: null,
          },
          `field:${path}`,
        );
      } else {
        add(
          id,
          `Input: edit field ${path} from the loaded JSON.`,
          "Input",
          {
            name: path,
            label: path,
            type: "text",
            placeholder: null,
            value: { $bindState: statePath },
            validateOn: null,
            checks: null,
          },
          `field:${path}`,
        );
      }
    }
    add(
      "save",
      "Button: Save changes to the loaded JSON editor (local demo).",
      "Button",
      { label: "Save changes", variant: "primary", disabled: false },
      "action:save",
      {
        press: {
          action: "setState",
          params: {
            statePath: "/status",
            value: "JSON changes saved locally.",
          },
        },
      },
    );
    add(
      "status",
      "Text: save status for the JSON editor.",
      "Text",
      { text: { $state: "/status" }, variant: "muted" },
      "data:status",
    );
  }

  return candidates;
}

export function stateForFile(file: LoadedFile) {
  const base = {
    status: "No changes saved yet.",
    file: {
      kind: file.kind,
      title: file.title,
      filename: file.filename,
      mimeType: file.mimeType,
    } as Record<string, unknown>,
  };

  if (
    file.kind === "audio" ||
    file.kind === "image" ||
    file.kind === "video" ||
    file.kind === "pdf"
  ) {
    base.file.src = file.src;
  }
  if (file.kind === "audio") base.file.durationLabel = file.durationLabel;
  if (file.kind === "image") {
    base.file.width = file.width;
    base.file.height = file.height;
  }
  if (file.kind === "video") {
    base.file.durationLabel = file.durationLabel;
    base.file.width = file.width;
    base.file.height = file.height;
  }
  if (file.kind === "tracker") {
    base.file.moduleId = file.moduleId;
    base.file.format = file.format;
    base.file.channels = file.channels;
  }
  if (file.kind === "text") base.file.text = file.text;
  if (file.kind === "markdown") base.file.markdown = file.markdown;
  if (file.kind === "webpage") {
    base.file.html = file.html;
    base.file.sourceUrl = file.sourceUrl;
  }
  if (file.kind === "csv") {
    base.file.columns = file.columns;
    base.file.rows = file.rows;
  }
  if (file.kind === "unknown") {
    base.file.size = file.size;
    base.file.sampleText = file.sampleText;
    base.file.hexPreview = file.hexPreview;
    base.file.sourceUrl = file.sourceUrl;
    base.file.inventPrompt = file.inventPrompt ?? "";
    base.file.inventNote =
      file.inventSource === "haiku"
        ? "Haiku invented a json-render Spec from the catalog."
        : file.inventSource === "cache"
          ? "Spec restored from browser storage."
          : file.inventSource === "fallback"
            ? "Fallback Spec (Haiku unavailable or invalid output)."
            : "Preparing invented Spec…";
  }
  if (file.kind === "json") {
    const data: Record<string, unknown> = {};
    for (const { path, value } of flattenJsonFields(file.data)) {
      const parts = path.split(".");
      const stored =
        typeof value === "boolean" || value === null ? value : String(value);
      if (parts.length === 1) data[parts[0]!] = stored;
      else {
        const root = parts[0]!;
        const child = parts[1]!;
        const nested =
          (data[root] as Record<string, unknown> | undefined) ?? {};
        nested[child] = stored;
        data[root] = nested;
      }
    }
    base.file.data = data;
  }
  return base;
}
