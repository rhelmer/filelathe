/**
 * Compressed-container inspection: sniff ZIP / gzip / tar, list entries, peek
 * readable document text, and extract a single entry on demand.
 *
 * Raw bytes stay client-side (archive-store) — nothing here is sent to compose
 * or Jev. Browser-only APIs (DecompressionStream) are used inside functions so
 * this module still imports safely on the server (types/labels only).
 */
import { unzipSync, type UnzipFileInfo } from "fflate";

export type ArchiveEntry = {
  name: string;
  size: number;
  isDir: boolean;
};

export type ArchivePeek = {
  entries: ArchiveEntry[];
  /** Extracted plain-text preview (document body or entry samples). */
  peekText: string | null;
  /** Short raw XML sample for ZIP packages (secondary detail). */
  peekXml: string | null;
};

export type ArchiveFormat = {
  /** Specific id: zip, docx, xlsx, pptx, odt, ods, odp, epub, jar, gzip, tar, tgz. */
  id: string;
  /** Underlying container family. */
  container: "zip" | "gzip" | "tar";
  /** Human badge label. */
  label: string;
};

const MAX_ENTRIES = 200;
const MAX_PEEK_BYTES = 4 * 1024 * 1024;
const MAX_PEEK_TEXT = 20_000;
const MAX_SAMPLE_FILES = 8;

/** ZIP-based package types keyed by extension. */
const ZIP_PACKAGES: Record<string, { id: string; label: string }> = {
  odt: { id: "odt", label: "OpenDocument Text" },
  ods: { id: "ods", label: "OpenDocument Sheet" },
  odp: { id: "odp", label: "OpenDocument Slides" },
  docx: { id: "docx", label: "Word Document" },
  xlsx: { id: "xlsx", label: "Excel Workbook" },
  pptx: { id: "pptx", label: "PowerPoint" },
  epub: { id: "epub", label: "EPUB Book" },
  jar: { id: "jar", label: "Java Archive" },
  war: { id: "jar", label: "Java Web Archive" },
  apk: { id: "zip", label: "Android Package" },
  zip: { id: "zip", label: "Zip Archive" },
};

const ZIP_PACKAGE_MIME: Record<string, { id: string; label: string }> = {
  "application/zip": ZIP_PACKAGES.zip!,
  "application/vnd.oasis.opendocument.text": ZIP_PACKAGES.odt!,
  "application/vnd.oasis.opendocument.spreadsheet": ZIP_PACKAGES.ods!,
  "application/vnd.oasis.opendocument.presentation": ZIP_PACKAGES.odp!,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ZIP_PACKAGES.docx!,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    ZIP_PACKAGES.xlsx!,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ZIP_PACKAGES.pptx!,
  "application/epub+zip": ZIP_PACKAGES.epub!,
  "application/java-archive": ZIP_PACKAGES.jar!,
};

/** Extensions that route to the archive kind (magic still takes priority). */
export const ARCHIVE_EXTS =
  /\.(zip|jar|war|apk|odt|ods|odp|docx|xlsx|pptx|epub|gz|tgz|tar)$/i;

function extOf(name: string): string {
  return name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
}

/** Detect an archive by magic bytes first, then extension / MIME. */
export function sniffArchiveFormat(
  bytes: Uint8Array,
  name: string,
  mime: string,
): ArchiveFormat | null {
  const lower = name.toLowerCase();
  const ext = extOf(lower);
  const type = mime.toLowerCase();

  const isZipMagic =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08));
  const isGzipMagic =
    bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const isTarMagic =
    bytes.length >= 265 &&
    String.fromCharCode(bytes[257]!, bytes[258]!, bytes[259]!, bytes[260]!, bytes[261]!) ===
      "ustar";

  // gzip family (handle .tar.gz / .tgz before plain gzip)
  if (isGzipMagic || ext === "gz" || ext === "tgz") {
    if (ext === "tgz" || /\.tar\.gz$/i.test(lower)) {
      return { id: "tgz", container: "tar", label: "Gzipped Tar" };
    }
    return { id: "gzip", container: "gzip", label: "Gzip" };
  }

  if (isTarMagic || ext === "tar") {
    return { id: "tar", container: "tar", label: "Tar Archive" };
  }

  if (isZipMagic || ZIP_PACKAGES[ext] || ZIP_PACKAGE_MIME[type]) {
    const pkg = ZIP_PACKAGES[ext] ?? ZIP_PACKAGE_MIME[type] ?? ZIP_PACKAGES.zip!;
    return { id: pkg.id, container: "zip", label: pkg.label };
  }

  return null;
}

function isJunk(name: string): boolean {
  return (
    name.startsWith("__MACOSX/") ||
    name.endsWith("/.DS_Store") ||
    name === ".DS_Store" ||
    name.endsWith("/Thumbs.db")
  );
}

function isTextish(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  return (
    /\.(xml|xhtml|html?|opf|rels|txt|md|markdown|json|csv|tsv|ya?ml|toml|ini|cfg|conf|log|svg|properties)$/i.test(
      name,
    ) || /^(readme|license|licence|changelog|notice|authors)$/i.test(base)
  );
}

const XML_ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
};

/** Strip XML/HTML tags to readable plain text with paragraph breaks. */
export function xmlToText(xml: string | null): string | null {
  if (!xml) return null;
  const text = xml
    .replace(/<\/(w:p|text:p|a:p|p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<(br|w:br|text:line-break)\b[^>]*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCharCode(parseInt(n, 16)),
    )
    .replace(/&(lt|gt|amp|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, MAX_PEEK_TEXT) : null;
}

function decodeUtf8(bytes: Uint8Array | undefined): string | null {
  if (!bytes) return null;
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Which decompressed inner file holds the document text, per package. */
function packageMainXml(
  format: string,
  files: Record<string, Uint8Array>,
): { text: string | null; xml: string | null } {
  const get = (name: string) => decodeUtf8(files[name]);

  if (format === "odt" || format === "ods" || format === "odp") {
    const xml = get("content.xml");
    return { text: xmlToText(xml), xml: xml?.slice(0, 1500) ?? null };
  }
  if (format === "docx") {
    const xml = get("word/document.xml");
    return { text: xmlToText(xml), xml: xml?.slice(0, 1500) ?? null };
  }
  if (format === "xlsx") {
    const shared = get("xl/sharedStrings.xml");
    return { text: xmlToText(shared), xml: shared?.slice(0, 1500) ?? null };
  }
  if (format === "pptx") {
    const slides = Object.keys(files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
        const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
        return na - nb;
      })
      .slice(0, 5);
    const parts = slides
      .map((n) => xmlToText(get(n)))
      .filter((t): t is string => Boolean(t));
    const firstXml = slides.length ? get(slides[0]!) : null;
    return {
      text: parts.length ? parts.join("\n\n").slice(0, MAX_PEEK_TEXT) : null,
      xml: firstXml?.slice(0, 1500) ?? null,
    };
  }
  if (format === "epub") {
    const container = get("META-INF/container.xml");
    const opfPath = container?.match(/full-path="([^"]+)"/i)?.[1] ?? null;
    const opf = opfPath ? get(opfPath) : null;
    let firstDoc: string | null = null;
    if (opf && opfPath) {
      const href = opf.match(
        /href="([^"]+\.x?html?)"[^>]*media-type="application\/xhtml\+xml"/i,
      )?.[1];
      const base = opfPath.includes("/")
        ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
        : "";
      const docPath = href ? `${base}${href}` : null;
      if (docPath) firstDoc = get(docPath);
    }
    if (!firstDoc) {
      const anyDoc = Object.keys(files).find((n) => /\.x?html?$/i.test(n));
      firstDoc = anyDoc ? get(anyDoc) : null;
    }
    return { text: xmlToText(firstDoc), xml: opf?.slice(0, 1500) ?? null };
  }
  return { text: null, xml: null };
}

/** Concatenate short samples of the first few text-ish entries. */
function sampleEntries(files: Record<string, Uint8Array>): string | null {
  const parts: string[] = [];
  for (const name of Object.keys(files)) {
    if (parts.length >= MAX_SAMPLE_FILES) break;
    if (isJunk(name) || name.endsWith("/") || !isTextish(name)) continue;
    const text = decodeUtf8(files[name]);
    if (!text) continue;
    const trimmed = text.trim();
    if (!trimmed) continue;
    parts.push(`=== ${name} ===\n${trimmed.slice(0, 2000)}`);
  }
  const joined = parts.join("\n\n");
  return joined ? joined.slice(0, MAX_PEEK_TEXT) : null;
}

function readZipPeek(bytes: Uint8Array, format: ArchiveFormat): ArchivePeek {
  const entries: ArchiveEntry[] = [];
  const isPackage = format.id !== "zip" && format.id !== "jar";
  const decoded = unzipSync(bytes, {
    filter(info: UnzipFileInfo) {
      const isDir = info.name.endsWith("/");
      if (!isJunk(info.name)) {
        entries.push({ name: info.name, size: info.originalSize, isDir });
      }
      return (
        !isDir &&
        !isJunk(info.name) &&
        info.originalSize <= MAX_PEEK_BYTES &&
        isTextish(info.name)
      );
    },
  });

  const peek = isPackage
    ? packageMainXml(format.id, decoded)
    : { text: sampleEntries(decoded), xml: null };

  return {
    entries: entries.slice(0, MAX_ENTRIES),
    peekText: peek.text ?? sampleEntries(decoded),
    peekXml: peek.xml,
  };
}

type TarRecord = ArchiveEntry & { data: Uint8Array };

function readTarString(block: Uint8Array, start: number, len: number): string {
  let out = "";
  for (let i = start; i < start + len; i++) {
    const code = block[i];
    if (!code) break;
    out += String.fromCharCode(code);
  }
  return out;
}

function parseTar(bytes: Uint8Array): TarRecord[] {
  const records: TarRecord[] = [];
  let off = 0;
  while (off + 512 <= bytes.length) {
    const block = bytes.subarray(off, off + 512);
    let allZero = true;
    for (let i = 0; i < 512; i++) {
      if (block[i] !== 0) {
        allZero = false;
        break;
      }
    }
    if (allZero) break;

    const name = readTarString(block, 0, 100);
    const prefix = readTarString(block, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeOctal = readTarString(block, 124, 12).trim();
    const size = parseInt(sizeOctal, 8) || 0;
    const type = String.fromCharCode(block[156] || 0);
    off += 512;
    const data = bytes.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;

    if (!fullName) continue;
    // Skip pax/gnu extended headers; keep files and dirs.
    if (type !== "0" && type !== "\0" && type !== "5") continue;
    const isDir = type === "5" || fullName.endsWith("/");
    records.push({ name: fullName, size, isDir, data });
  }
  return records;
}

function tarPeek(records: TarRecord[]): ArchivePeek {
  const files: Record<string, Uint8Array> = {};
  const entries: ArchiveEntry[] = [];
  for (const rec of records) {
    if (isJunk(rec.name)) continue;
    entries.push({ name: rec.name, size: rec.size, isDir: rec.isDir });
    if (!rec.isDir && rec.size <= MAX_PEEK_BYTES && isTextish(rec.name)) {
      files[rec.name] = rec.data;
    }
  }
  return {
    entries: entries.slice(0, MAX_ENTRIES),
    peekText: sampleEntries(files),
    peekXml: null,
  };
}

async function gzipPeek(bytes: Uint8Array, name: string): Promise<ArchivePeek> {
  const innerName = name.toLowerCase().endsWith(".gz")
    ? name.slice(0, -3)
    : `${name}.out`;
  const inner = await gunzip(bytes);
  const entry: ArchiveEntry = {
    name: innerName.split("/").pop() ?? innerName,
    size: inner.length,
    isDir: false,
  };
  const text = isTextish(entry.name) ? decodeUtf8(inner) : null;
  return {
    entries: [entry],
    peekText: text ? text.slice(0, MAX_PEEK_TEXT) : null,
    peekXml: null,
  };
}

/** List entries and peek readable text for a detected archive. */
export async function readArchive(
  bytes: Uint8Array,
  format: ArchiveFormat,
  name: string,
): Promise<ArchivePeek> {
  try {
    if (format.container === "zip") return readZipPeek(bytes, format);
    if (format.container === "gzip") return await gzipPeek(bytes, name);
    // tar family
    const raw = format.id === "tgz" ? await gunzip(bytes) : bytes;
    return tarPeek(parseTar(raw));
  } catch (error) {
    console.warn(
      "[archive] peek failed:",
      error instanceof Error ? error.message : error,
    );
    return { entries: [], peekText: null, peekXml: null };
  }
}

/** Extract a single entry's bytes (for click-to-open / nested archives). */
export async function extractEntry(
  bytes: Uint8Array,
  format: ArchiveFormat,
  entryName: string,
): Promise<Uint8Array | null> {
  try {
    if (format.container === "zip") {
      const out = unzipSync(bytes, { filter: (f) => f.name === entryName });
      return out[entryName] ?? null;
    }
    if (format.container === "gzip") {
      return await gunzip(bytes);
    }
    const raw = format.id === "tgz" ? await gunzip(bytes) : bytes;
    const rec = parseTar(raw).find((r) => r.name === entryName && !r.isDir);
    // Copy out of the shared buffer view so the slice is standalone.
    return rec ? rec.data.slice() : null;
  } catch (error) {
    console.warn(
      "[archive] extract failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

const MIME_BY_EXT: Record<string, string> = {
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
};

/** Best-effort MIME for an extracted entry so it re-detects on open. */
export function guessMimeForName(name: string): string {
  return MIME_BY_EXT[extOf(name)] ?? "application/octet-stream";
}

/** Rebuild an ArchiveFormat descriptor from a stored format id. */
export function formatFromId(id: string): ArchiveFormat {
  if (id === "gzip") return { id, container: "gzip", label: "Gzip" };
  if (id === "tar") return { id, container: "tar", label: "Tar Archive" };
  if (id === "tgz") return { id, container: "tar", label: "Gzipped Tar" };
  const label =
    Object.values(ZIP_PACKAGES).find((p) => p.id === id)?.label ??
    "Zip Archive";
  return { id, container: "zip", label };
}
