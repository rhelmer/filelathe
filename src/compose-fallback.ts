/**
 * Deterministic Specs when Jev is unavailable or compose fails.
 * Prefer the real viewer for each kind; default to a text/hex-style dump.
 */

import type { Spec } from "@json-render/core";
import { stateForFile } from "./file-candidates";
import type { LoadedFile } from "./files";

function cardWith(
  childId: string,
  child: Spec["elements"][string],
  state: Spec["state"],
  extras?: Spec["elements"],
): Spec {
  return {
    root: "card",
    state,
    elements: {
      card: {
        type: "Card",
        props: {
          title: null,
          description: null,
          maxWidth: "md",
          centered: true,
        },
        children: extras ? [childId, ...Object.keys(extras)] : [childId],
      },
      [childId]: child,
      ...extras,
    },
  };
}

function alertNote(id: string, message: string): Spec["elements"][string] {
  return {
    type: "Alert",
    props: {
      title: "Fallback layout",
      message,
      type: "info",
    },
    children: [],
  };
}

/**
 * Hardcoded layout switch for known (and unknown) file kinds.
 * Unknown without an invented Spec uses BinaryInspector.
 */
export function buildFallbackComposeSpec(
  file: LoadedFile,
  reason: string,
): Spec {
  const state = stateForFile(file);
  const note = `Jev unavailable — ${reason}`;

  switch (file.kind) {
    case "audio":
      return cardWith(
        "player",
        {
          type: "AudioPlayer",
          props: {
            src: { $state: "/file/src" },
            title: null,
            autoplay: false,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "video":
      return cardWith(
        "player",
        {
          type: "VideoPlayer",
          props: {
            src: { $state: "/file/src" },
            title: null,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "pdf":
      return cardWith(
        "pdf",
        {
          type: "PdfViewer",
          props: {
            src: { $state: "/file/src" },
            title: null,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "image":
      return cardWith(
        "editor",
        {
          type: "PixelEditor",
          props: {
            src: { $state: "/file/src" },
            title: null,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "tracker":
      return cardWith(
        "player",
        {
          type: "TrackerPlayer",
          props: {
            moduleId: { $state: "/file/moduleId" },
            title: { $state: "/file/title" },
            format: file.format,
            channels: file.channels,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "csv":
      return cardWith(
        "sheet",
        {
          type: "Spreadsheet",
          props: {
            columns: file.columns,
            rows: file.rows,
            caption: null,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "markdown":
      return cardWith(
        "md",
        {
          type: "MarkdownView",
          props: {
            markdown: { $state: "/file/markdown" },
            title: null,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "webpage":
      return cardWith(
        "page",
        {
          type: "WebPageViewer",
          props: {
            html: { $state: "/file/html" },
            sourceUrl: { $state: "/file/sourceUrl" },
            title: null,
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "text":
      return cardWith(
        "body",
        {
          type: "Text",
          props: {
            text: { $state: "/file/text" },
            variant: "body",
          },
          children: [],
        },
        state,
        { note: alertNote("note", note) },
      );

    case "json": {
      const pretty = JSON.stringify(file.data, null, 2);
      const jsonState = {
        ...state,
        file: {
          ...(state?.file as Record<string, unknown>),
          jsonDump: `\`\`\`json\n${pretty}\n\`\`\``,
        },
      };
      return cardWith(
        "json",
        {
          type: "MarkdownView",
          props: {
            markdown: { $state: "/file/jsonDump" },
            title: null,
          },
          children: [],
        },
        jsonState,
        { note: alertNote("note", note) },
      );
    }

    case "unknown":
      return {
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
            children: ["inspector"],
          },
          inspector: {
            type: "BinaryInspector",
            props: {
              filename: file.filename,
              mimeType: file.mimeType,
              size: file.size,
              hexPreview: file.hexPreview,
              sampleText: file.sampleText,
              note,
              playerHint: null,
            },
            children: [],
          },
        },
      };

    default: {
      const _exhaustive: never = file;
      return _exhaustive;
    }
  }
}
