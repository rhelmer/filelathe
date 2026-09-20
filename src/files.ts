import type { Spec } from "@json-render/core";
import { buildInventPrompt } from "./invent-prompt";
import { deleteModule, nextModuleId, putModule } from "./module-store";
import { filenameFromUrl, toHexPreview, tryDecodeText } from "./resource-utils";

/** Normalized payload produced from a dropped/selected file. */
export type LoadedFile =
  | {
      kind: "audio";
      title: string;
      filename: string;
      mimeType: string;
      src: string;
      durationLabel: string | null;
    }
  | {
      kind: "image";
      title: string;
      filename: string;
      mimeType: string;
      src: string;
      width: number | null;
      height: number | null;
    }
  | {
      kind: "json";
      title: string;
      filename: string;
      mimeType: string;
      data: Record<string, unknown>;
    }
  | {
      kind: "csv";
      title: string;
      filename: string;
      mimeType: string;
      columns: string[];
      rows: string[][];
    }
  | {
      kind: "text";
      title: string;
      filename: string;
      mimeType: string;
      text: string;
    }
  | {
      kind: "markdown";
      title: string;
      filename: string;
      mimeType: string;
      markdown: string;
    }
  | {
      kind: "webpage";
      title: string;
      filename: string;
      mimeType: string;
      html: string;
      sourceUrl: string | null;
    }
  | {
      kind: "video";
      title: string;
      filename: string;
      mimeType: string;
      src: string;
      durationLabel: string | null;
      width: number | null;
      height: number | null;
    }
  | {
      kind: "pdf";
      title: string;
      filename: string;
      mimeType: string;
      src: string;
    }
  | {
      kind: "tracker";
      title: string;
      filename: string;
      mimeType: string;
      moduleId: string;
      format: string;
      channels: number | null;
      moduleTitle: string | null;
    }
  | {
      kind: "unknown";
      title: string;
      filename: string;
      mimeType: string;
      size: number;
      sampleText: string | null;
      hexPreview: string;
      sourceUrl: string | null;
      /** Spec invented by Haiku / fallback / cache */
      inventedSpec: Spec | null;
      inventSource: "haiku" | "fallback" | "cache" | null;
      /** Prompt shown/edited in the invent window (sent to Haiku). */
      inventPrompt: string | null;
      /** Why invent fell back (shown in the note). */
      inventReason?: string | null;
    };

export type FileKind = LoadedFile["kind"];

const TRACKER_EXTS =
  /\.(xm|mod|it|s3m|mtm|umx|okt|669|far|med|stm|ult|amf|dmf|ptm|psm)$/i;

export function titleFromFilename(filename: string) {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || filename
  );
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const whole = Math.round(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function detectKind(file: File): FileKind | "unknown" {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    TRACKER_EXTS.test(name) ||
    type.includes("modplug") ||
    type.includes("x-mod")
  )
    return "tracker";
  if (type.startsWith("video/") || /\.(mp4|webm|ogv|mov|m4v|mkv)$/i.test(name))
    return "video";
  if (
    type.startsWith("audio/") ||
    /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus)$/i.test(name)
  )
    return "audio";
  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(name)
  )
    return "image";
  if (
    type === "application/json" ||
    name.endsWith(".json") ||
    name.endsWith(".jsonl")
  )
    return "json";
  if (
    type === "text/csv" ||
    type === "text/tab-separated-values" ||
    type === "application/vnd.ms-excel" ||
    name.endsWith(".csv") ||
    name.endsWith(".tsv")
  )
    return "csv";
  if (
    type === "text/markdown" ||
    type === "text/x-markdown" ||
    /\.(md|markdown|mdx)$/i.test(name)
  )
    return "markdown";

  // HTML pages → dedicated viewer (not plain text dump)
  if (
    type === "text/html" ||
    type === "application/xhtml+xml" ||
    type.includes("html") ||
    /\.html?$/i.test(name)
  )
    return "webpage";

  // Source / config / markup → unknown so Haiku invents a catalog Spec
  // (plain "text" is reserved for prose .txt/.log).
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|less|xml|ya?ml|toml|ini|cfg|conf|sh|bash|zsh|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|sql|env|vue|svelte|php|swift|m|mm|r|lua|pl|pm|ex|exs|clj|scala|zig|nim|dart|proto|graphql|gql|hs|lhs)$/i.test(
      name,
    ) ||
    /^(dockerfile|makefile)$/i.test(name.split("/").pop() ?? "")
  )
    return "unknown";

  if (type.startsWith("text/") || /\.(txt|log)$/i.test(name)) return "text";
  return "unknown";
}

function parseDelimited(
  text: string,
  delimiter: string,
): { columns: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, 51);
  if (!lines.length) return { columns: ["Column"], rows: [] };
  const split = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current);
        current = "";
      } else current += ch;
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
  };
  const columns = split(lines[0]!);
  const rows = lines.slice(1, 21).map((line) => {
    const cells = split(line);
    while (cells.length < columns.length) cells.push("");
    return cells.slice(0, columns.length);
  });
  return { columns, rows };
}

function flattenJsonFields(
  data: Record<string, unknown>,
): Array<{ path: string; value: unknown }> {
  const fields: Array<{ path: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(data).slice(0, 12)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      fields.push({ path: key, value });
    } else if (typeof value === "object" && !Array.isArray(value)) {
      for (const [child, childValue] of Object.entries(
        value as Record<string, unknown>,
      ).slice(0, 6)) {
        if (
          childValue === null ||
          typeof childValue === "string" ||
          typeof childValue === "number" ||
          typeof childValue === "boolean"
        ) {
          fields.push({ path: `${key}.${child}`, value: childValue });
        }
      }
    }
  }
  return fields;
}

async function readImageSize(
  src: string,
): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: null, height: null });
    image.src = src;
  });
}

async function readAudioDuration(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = src;
    const done = (label: string | null) => {
      audio.removeAttribute("src");
      audio.load();
      resolve(label);
    };
    audio.onloadedmetadata = () => done(formatDuration(audio.duration));
    audio.onerror = () => done(null);
  });
}

async function readVideoMeta(src: string): Promise<{
  durationLabel: string | null;
  width: number | null;
  height: number | null;
}> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = src;
    const done = (result: {
      durationLabel: string | null;
      width: number | null;
      height: number | null;
    }) => {
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    video.onloadedmetadata = () =>
      done({
        durationLabel: formatDuration(video.duration),
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
    video.onerror = () =>
      done({ durationLabel: null, width: null, height: null });
  });
}

function sniffTracker(buffer: ArrayBuffer, filename: string) {
  const bytes = new Uint8Array(buffer);
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...bytes.slice(start, start + len));
  const ext = (filename.match(/\.([^.]+)$/)?.[1] ?? "mod").toLowerCase();

  let format = ext;
  let channels: number | null = null;
  let moduleTitle: string | null = null;

  if (ascii(0, 17) === "Extended Module: ") {
    format = "xm";
    moduleTitle = cleanTitle(ascii(17, 20));
    if (bytes.length > 68) channels = bytes[68] ?? null;
  } else if (ascii(0, 4) === "IMPM") {
    format = "it";
    moduleTitle = cleanTitle(ascii(4, 26));
  } else if (bytes.length > 48 && ascii(44, 4) === "SCRM") {
    format = "s3m";
    moduleTitle = cleanTitle(ascii(0, 28));
  } else if (bytes.length > 1084) {
    const sig = ascii(1080, 4);
    if (
      ["M.K.", "M!K!", "4CHN", "6CHN", "8CHN", "FLT4", "FLT8"].includes(sig) ||
      /^\dCHN$/.test(sig) ||
      /^\d\dCH$/.test(sig)
    ) {
      format = "mod";
      moduleTitle = cleanTitle(ascii(0, 20));
      if (sig === "6CHN") channels = 6;
      else if (sig === "8CHN" || sig === "FLT8") channels = 8;
      else if (/^\dCHN$/.test(sig)) channels = Number(sig[0]);
      else if (/^\d\dCH$/.test(sig)) channels = Number(sig.slice(0, 2));
      else channels = 4;
    }
  }

  return { format, channels, moduleTitle };
}

function cleanTitle(raw: string) {
  const trimmed = raw.replace(/\0/g, "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * macOS Finder "Recents" (and iCloud placeholders) often hand the browser a
 * File that looks selectable but cannot be read — size 0, or arrayBuffer()
 * throws NotReadableError — with no useful OS error. Fail early with guidance.
 */
export async function ensureReadableBrowserFile(file: File): Promise<void> {
  const recentsHint =
    "macOS Recents / iCloud picks often fail in the browser. Choose the file from Downloads, Documents, or its real folder instead (download it first if it shows a cloud icon).";

  if (file.size === 0) {
    // Probe: some Recents stubs report size 0 even when the real file isn't empty.
    let probed = 0;
    try {
      probed = (await file.slice(0, 64).arrayBuffer()).byteLength;
    } catch {
      throw new Error(`Couldn't read “${file.name}”. ${recentsHint}`);
    }
    if (probed === 0) {
      throw new Error(
        `“${file.name}” arrived empty (0 bytes). ${recentsHint}`,
      );
    }
  }

  try {
    const probe = await file.slice(0, Math.min(file.size, 64)).arrayBuffer();
    if (file.size > 0 && probe.byteLength === 0) {
      throw new Error(`Couldn't read “${file.name}”. ${recentsHint}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Recents")) throw error;
    const name = error instanceof Error ? error.name : "";
    if (
      name === "NotReadableError" ||
      name === "NotFoundError" ||
      name === "SecurityError"
    ) {
      throw new Error(`Couldn't read “${file.name}”. ${recentsHint}`);
    }
    throw error;
  }
}

/** Read a browser File into a typed payload the composer can use. */
export async function loadDroppedFile(file: File): Promise<LoadedFile> {
  await ensureReadableBrowserFile(file);
  const kind = detectKind(file);
  const title = titleFromFilename(file.name);
  const mimeType = file.type || "application/octet-stream";

  if (kind === "audio") {
    const src = URL.createObjectURL(file);
    return {
      kind: "audio",
      title,
      filename: file.name,
      mimeType,
      src,
      durationLabel: await readAudioDuration(src),
    };
  }

  if (kind === "image") {
    const src = URL.createObjectURL(file);
    const size = await readImageSize(src);
    return {
      kind: "image",
      title,
      filename: file.name,
      mimeType,
      src,
      width: size.width,
      height: size.height,
    };
  }

  if (kind === "video") {
    const src = URL.createObjectURL(file);
    const meta = await readVideoMeta(src);
    return {
      kind: "video",
      title,
      filename: file.name,
      mimeType,
      src,
      durationLabel: meta.durationLabel,
      width: meta.width,
      height: meta.height,
    };
  }

  if (kind === "pdf") {
    const src = URL.createObjectURL(file);
    return {
      kind: "pdf",
      title,
      filename: file.name,
      mimeType:
        mimeType === "application/octet-stream" ? "application/pdf" : mimeType,
      src,
    };
  }

  if (kind === "tracker") {
    const buffer = await file.arrayBuffer();
    const sniffed = sniffTracker(buffer, file.name);
    const moduleId = nextModuleId();
    putModule(moduleId, buffer);
    return {
      kind: "tracker",
      title: sniffed.moduleTitle ?? title,
      filename: file.name,
      mimeType,
      moduleId,
      format: sniffed.format,
      channels: sniffed.channels,
      moduleTitle: sniffed.moduleTitle,
    };
  }

  if (kind === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON file must contain a top-level object.");
    }
    return {
      kind: "json",
      title,
      filename: file.name,
      mimeType: mimeType || "application/json",
      data: parsed as Record<string, unknown>,
    };
  }

  if (kind === "csv") {
    const text = await file.text();
    const delimiter = file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",";
    const { columns, rows } = parseDelimited(text, delimiter);
    return {
      kind: "csv",
      title,
      filename: file.name,
      mimeType:
        mimeType ||
        (delimiter === "\t" ? "text/tab-separated-values" : "text/csv"),
      columns,
      rows,
    };
  }

  if (kind === "markdown") {
    const markdown = await file.text();
    return {
      kind: "markdown",
      title,
      filename: file.name,
      mimeType: mimeType || "text/markdown",
      markdown: markdown.slice(0, 100_000),
    };
  }

  if (kind === "webpage") {
    const html = await file.text();
    return {
      kind: "webpage",
      title,
      filename: file.name,
      mimeType: mimeType || "text/html",
      html: html.slice(0, 500_000),
      sourceUrl: null,
    };
  }

  if (kind === "text") {
    const text = await file.text();
    return {
      kind: "text",
      title,
      filename: file.name,
      mimeType: mimeType || "text/plain",
      text: text.slice(0, 8000),
    };
  }

  // Unknown: keep a small sample for Haiku / fallback Spec invent
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const sampleText = tryDecodeText(bytes.slice(0, 4000));
  const hexPreview = toHexPreview(bytes, 256);
  const inventInput = {
    title,
    filename: file.name,
    mimeType,
    size: file.size,
    sampleText,
    hexPreview,
    sourceUrl: null as string | null,
  };
  return {
    kind: "unknown",
    ...inventInput,
    inventedSpec: null,
    inventSource: null,
    inventPrompt: buildInventPrompt(inventInput),
  };
}

export function revokeLoadedFile(file: LoadedFile | null) {
  if (!file) return;
  if (
    (file.kind === "audio" ||
      file.kind === "image" ||
      file.kind === "video" ||
      file.kind === "pdf") &&
    file.src.startsWith("blob:")
  ) {
    URL.revokeObjectURL(file.src);
  }
  if (file.kind === "tracker") {
    deleteModule(file.moduleId);
  }
}

/** Internal prompt used by auto-compose (not shown to the user). */
export function promptForFile(file: LoadedFile): string {
  switch (file.kind) {
    case "audio":
      return "Show an audio player for the loaded track";
    case "image":
      return "Show a pixel editor for the loaded image";
    case "json":
      return "Create an editor form for the loaded record fields with Save changes";
    case "csv":
      return "Show a spreadsheet editor for the loaded CSV";
    case "text":
      return "Show the loaded document text";
    case "markdown":
      return "Show the rendered Markdown document only";
    case "webpage":
      return "Show the webpage snapshot viewer for the fetched HTML";
    case "video":
      return "Show a video player for the loaded clip";
    case "pdf":
      return "Show a PDF viewer for the loaded document";
    case "tracker":
      return "Show a tracker player for the loaded module";
    case "unknown":
      return "Show the invented catalog Spec viewer for this unrecognized resource";
  }
}

export function labelForKind(kind: FileKind) {
  switch (kind) {
    case "audio":
      return "Audio player";
    case "image":
      return "Pixel editor";
    case "json":
      return "JSON form";
    case "csv":
      return "Spreadsheet";
    case "text":
      return "Text document";
    case "markdown":
      return "Markdown";
    case "webpage":
      return "Web page";
    case "video":
      return "Video player";
    case "pdf":
      return "PDF viewer";
    case "tracker":
      return "Tracker player";
    case "unknown":
      return "Invented Spec";
  }
}

export function jsonFlatState(data: Record<string, unknown>) {
  const flat: Record<string, string | number | boolean | null> = {};
  for (const { path, value } of flattenJsonFields(data)) {
    flat[path.replaceAll(".", "/")] =
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? value
        : String(value);
  }
  return flat;
}

export { flattenJsonFields };
