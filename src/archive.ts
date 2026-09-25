/**
 * Container inspection: sniff ZIP / gzip / tar / OLE (CFB), list entries, peek
 * readable document text, and extract a single entry on demand.
 *
 * Classic Office (.doc / .xls / .ppt / .msg) are OLE Compound Files — not ZIP —
 * so without this path they fall through as unknown and Jev routes them to the
 * hex inspector. OOXML/ODF packages stay on the ZIP path.
 *
 * Raw bytes stay client-side (archive-store) — nothing here is sent to compose
 * or Jev. Browser-only APIs (DecompressionStream) are used inside functions so
 * this module still imports safely on the server (types/labels only).
 */
import * as CFB from "cfb";
import { Inflate, Unzip, UnzipPassThrough, type UnzipFileInfo } from "fflate";

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
  /** Specific id: zip, docx, xlsx, pptx, odt, ods, odp, epub, jar, gzip, tar, tgz, doc, xls, ppt, msg, ole. */
  id: string;
  /** Underlying container family. */
  container: "zip" | "gzip" | "tar" | "ole";
  /** Human badge label. */
  label: string;
};

const MAX_ENTRIES = 200;
const MAX_PEEK_BYTES = 4 * 1024 * 1024;
/** Hard cap on bytes produced by inflate/gunzip (zip-bomb guard). */
export const MAX_INFLATE_BYTES = 32 * 1024 * 1024;
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

/**
 * Classic OLE Compound File packages (magic D0 CF 11 E0…).
 * Distinct from OOXML (.docx/.xlsx/.pptx) which are ZIP.
 */
const OLE_PACKAGES: Record<string, { id: string; label: string }> = {
  doc: { id: "doc", label: "Word 97–2003" },
  dot: { id: "doc", label: "Word 97–2003 Template" },
  xls: { id: "xls", label: "Excel 97–2003" },
  xlt: { id: "xls", label: "Excel 97–2003 Template" },
  xlm: { id: "xls", label: "Excel 97–2003" },
  ppt: { id: "ppt", label: "PowerPoint 97–2003" },
  pot: { id: "ppt", label: "PowerPoint 97–2003 Template" },
  pps: { id: "ppt", label: "PowerPoint 97–2003 Show" },
  msg: { id: "msg", label: "Outlook Message" },
  msi: { id: "ole", label: "Windows Installer" },
};

const OLE_PACKAGE_MIME: Record<string, { id: string; label: string }> = {
  "application/msword": OLE_PACKAGES.doc!,
  "application/vnd.ms-word": OLE_PACKAGES.doc!,
  "application/vnd.ms-excel": OLE_PACKAGES.xls!,
  "application/vnd.ms-powerpoint": OLE_PACKAGES.ppt!,
  "application/vnd.ms-outlook": OLE_PACKAGES.msg!,
  "application/x-msi": OLE_PACKAGES.msi!,
};

/** Extensions that route to the archive kind (magic still takes priority). */
export const ARCHIVE_EXTS =
  /\.(zip|jar|war|apk|odt|ods|odp|docx|xlsx|pptx|epub|gz|tgz|tar|doc|dot|xls|xlt|ppt|pot|pps|msg|msi)$/i;

/** OLE Compound File magic: D0 CF 11 E0 A1 B1 1A E1 */
export function isOleMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

function extOf(name: string): string {
  return name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
}

/** Refine generic OLE using well-known stream names inside the CFB. */
function refineOleFromStreams(
  bytes: Uint8Array,
): { id: string; label: string } | null {
  try {
    const cfb = CFB.parse(bytes);
    const names = cfb.FullPaths.map((p) =>
      p.replace(/^Root Entry\/?/i, "").toLowerCase(),
    );
    if (names.some((n) => n === "worddocument" || n.endsWith("/worddocument")))
      return OLE_PACKAGES.doc!;
    if (
      names.some(
        (n) =>
          n === "workbook" ||
          n.endsWith("/workbook") ||
          n === "book" ||
          n.endsWith("/book"),
      )
    )
      return OLE_PACKAGES.xls!;
    if (
      names.some(
        (n) =>
          n === "powerpoint document" ||
          n.endsWith("/powerpoint document"),
      )
    )
      return OLE_PACKAGES.ppt!;
    if (
      names.some(
        (n) =>
          n.includes("__substg1.0_") ||
          n.includes("__properties_version1.0"),
      )
    )
      return OLE_PACKAGES.msg!;
  } catch {
    /* ignore — treat as generic OLE */
  }
  return null;
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
  const oleMagic = isOleMagic(bytes);

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

  // ZIP / OOXML / ODF before OLE — .docx is ZIP; .doc is OLE.
  if (isZipMagic || ZIP_PACKAGES[ext] || ZIP_PACKAGE_MIME[type]) {
    const pkg = ZIP_PACKAGES[ext] ?? ZIP_PACKAGE_MIME[type] ?? ZIP_PACKAGES.zip!;
    return { id: pkg.id, container: "zip", label: pkg.label };
  }

  // Classic Office + other Compound File Binary containers
  if (oleMagic || OLE_PACKAGES[ext] || OLE_PACKAGE_MIME[type]) {
    let pkg =
      OLE_PACKAGES[ext] ??
      OLE_PACKAGE_MIME[type] ??
      ({ id: "ole", label: "OLE Compound File" } as const);
    if (pkg.id === "ole" && oleMagic) {
      pkg = refineOleFromStreams(bytes) ?? pkg;
    }
    return { id: pkg.id, container: "ole", label: pkg.label };
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

async function gunzip(
  bytes: Uint8Array,
  maxBytes = MAX_INFLATE_BYTES,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(
          `Uncompressed data exceeds ${maxBytes} bytes.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Unzip with a running output cap. Declared originalSize is not trusted —
 * inflate stops once the decompressed total crosses `maxBytes`.
 */
/** Sync inflate that rethrows so a size cap can stop the rest of the stream. */
class CappedInflate {
  static compression = 8;
  ondata: (
    err: Error | null,
    data: Uint8Array | null,
    final: boolean,
  ) => void = () => {};
  private inflator: Inflate;
  private dead = false;

  constructor(_filename?: string, _size?: number, _originalSize?: number) {
    this.inflator = new Inflate((data, final) => {
      this.ondata(null, data, final);
    });
  }

  push(chunk: Uint8Array, final: boolean) {
    if (this.dead) return;
    try {
      this.inflator.push(chunk, final);
    } catch (error) {
      this.dead = true;
      throw error;
    }
  }
}

export function unzipBounded(
  data: Uint8Array,
  filter?: (info: UnzipFileInfo) => boolean,
  maxBytes = MAX_INFLATE_BYTES,
): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  let total = 0;
  let aborted: Error | null = null;
  const unzipper = new Unzip();
  unzipper.register(UnzipPassThrough);
  unzipper.register(CappedInflate);
  unzipper.onfile = (file) => {
    if (aborted) return;
    const info: UnzipFileInfo = {
      name: file.name,
      size: file.size ?? 0,
      originalSize: file.originalSize ?? 0,
      compression: file.compression,
    };
    if (filter && !filter(info)) return;
    const chunks: Uint8Array[] = [];
    let local = 0;
    file.ondata = (err, chunk, final) => {
      if (aborted) return;
      if (err) {
        aborted = err instanceof Error ? err : new Error(String(err));
        throw aborted;
      }
      if (chunk?.length) {
        local += chunk.length;
        total += chunk.length;
        if (total > maxBytes) {
          aborted = new Error(`Uncompressed data exceeds ${maxBytes} bytes.`);
          throw aborted;
        }
        chunks.push(chunk);
      }
      if (final) {
        const merged = new Uint8Array(local);
        let offset = 0;
        for (const part of chunks) {
          merged.set(part, offset);
          offset += part.length;
        }
        out[file.name] = merged;
      }
    };
    try {
      file.start();
    } catch (error) {
      aborted =
        aborted ??
        (error instanceof Error ? error : new Error(String(error)));
    }
  };
  try {
    unzipper.push(data, true);
  } catch (error) {
    aborted =
      aborted ?? (error instanceof Error ? error : new Error(String(error)));
  }
  if (aborted) throw aborted;
  return out;
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
  const decoded = unzipBounded(bytes, (info: UnzipFileInfo) => {
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

function cfbContentToBytes(content: number[] | Uint8Array | undefined): Uint8Array {
  if (!content) return new Uint8Array();
  if (content instanceof Uint8Array) return content;
  return new Uint8Array(content);
}

function streamBasename(fullPath: string): string {
  const trimmed = fullPath.replace(/\/$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
}

/** Prefer streams that usually hold document text for classic Office. */
function olePrimaryStreamNames(formatId: string): string[] {
  switch (formatId) {
    case "doc":
      return ["WordDocument"];
    case "xls":
      return ["Workbook", "Book"];
    case "ppt":
      return ["PowerPoint Document"];
    case "msg":
      return []; // many __substg body streams — scrape broadly
    default:
      return ["WordDocument", "Workbook", "Book", "PowerPoint Document"];
  }
}

function isMostlyPrintable(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
  if (code < 0x20 || code === 0x7f) return false;
  if (code >= 0xd800 && code <= 0xdfff) return false; // surrogates
  if (code === 0xfffe || code === 0xffff) return false;
  return code < 0xfffe;
}

/**
 * Best-effort plain text from OLE streams: UTF-16LE runs (Word Unicode) plus
 * ASCII runs (ANSI Word / BIFF labels). Not a full FIB/piece-table or BIFF
 * parser — enough for ArchiveBrowser peek without shipping SheetJS/mammoth.
 */
export function scrapeOleReadableText(
  bytes: Uint8Array,
  max = MAX_PEEK_TEXT,
): string | null {
  const parts: string[] = [];
  const pushRun = (run: string) => {
    const cleaned = run.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (cleaned.length >= 4) parts.push(cleaned);
  };

  // UTF-16LE runs
  let u16 = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i]! | (bytes[i + 1]! << 8);
    if (code === 0) {
      pushRun(u16);
      u16 = "";
    } else if (isMostlyPrintable(code)) {
      u16 += String.fromCharCode(code);
      if (u16.length >= 8000) {
        pushRun(u16);
        u16 = "";
      }
    } else {
      pushRun(u16);
      u16 = "";
    }
  }
  pushRun(u16);

  // ASCII / Latin-1 runs (skip if we already have plenty of Unicode text)
  if (parts.join("\n").length < 200) {
    let asc = "";
    for (let i = 0; i < bytes.length; i++) {
      const code = bytes[i]!;
      if (code === 0) {
        pushRun(asc);
        asc = "";
      } else if (
        code === 0x09 ||
        code === 0x0a ||
        code === 0x0d ||
        (code >= 0x20 && code < 0x7f)
      ) {
        asc += String.fromCharCode(code);
        if (asc.length >= 8000) {
          pushRun(asc);
          asc = "";
        }
      } else {
        pushRun(asc);
        asc = "";
      }
    }
    pushRun(asc);
  }

  // Prefer longer unique runs; drop near-duplicates
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const part of parts.sort((a, b) => b.length - a.length)) {
    const key = part.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    // Skip runs that look like CLSID / hex noise
    if (/^[0-9a-f.\-{}]+$/i.test(part) && part.length < 64) continue;
    if ((part.match(/[a-zA-Z]/g) ?? []).length < Math.min(4, part.length / 4))
      continue;
    seen.add(key);
    ordered.push(part);
    if (ordered.join("\n").length >= max) break;
  }
  const text = ordered.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return text ? text.slice(0, max) : null;
}

function findCfbStream(
  cfb: CFB.CFB$Container,
  wanted: string,
): Uint8Array | null {
  const entry = CFB.find(cfb, wanted);
  if (!entry || entry.type !== 2 /* stream */) return null;
  const data = cfbContentToBytes(entry.content);
  return data.length ? data : null;
}

function readOlePeek(bytes: Uint8Array, format: ArchiveFormat): ArchivePeek {
  const cfb = CFB.parse(bytes);
  const entries: ArchiveEntry[] = [];
  const streams = new Map<string, Uint8Array>();

  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const fullPath = cfb.FullPaths[i]!;
    const entry = cfb.FileIndex[i]!;
    if (!entry) continue;
    // type: 2 = stream, 1 = storage (dir), 5 = root
    if (entry.type === 5) continue;
    const name = fullPath.replace(/^Root Entry\/?/i, "") || entry.name;
    if (!name || name === "Root Entry") continue;
    const isDir = entry.type === 1 || fullPath.endsWith("/");
    const data = isDir ? null : cfbContentToBytes(entry.content);
    const size = data?.length ?? 0;
    if (name.includes("\x01Sh33tJ5")) continue; // cfb write marker
    entries.push({ name: name.replace(/\/$/, ""), size, isDir });
    if (data && size > 0 && size <= MAX_PEEK_BYTES) {
      streams.set(streamBasename(name), data);
      streams.set(name.replace(/\/$/, ""), data);
    }
  }

  const primaryNames = olePrimaryStreamNames(format.id);
  let peekText: string | null = null;
  for (const streamName of primaryNames) {
    const data =
      streams.get(streamName) ?? findCfbStream(cfb, streamName);
    if (!data) continue;
    peekText = scrapeOleReadableText(data);
    if (peekText) break;
  }

  // MSG / generic: scrape a few largest streams
  if (!peekText) {
    const largest = [...streams.entries()]
      .filter(([n]) => !/checksum|documentsummary|summaryinformation/i.test(n))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);
    const chunks: string[] = [];
    for (const [, data] of largest) {
      const text = scrapeOleReadableText(data, 6000);
      if (text) chunks.push(text);
      if (chunks.join("\n").length >= MAX_PEEK_TEXT) break;
    }
    peekText = chunks.length
      ? chunks.join("\n\n").slice(0, MAX_PEEK_TEXT)
      : null;
  }

  return {
    entries: entries.slice(0, MAX_ENTRIES),
    peekText,
    peekXml: null,
  };
}

function extractOleEntry(
  bytes: Uint8Array,
  entryName: string,
): Uint8Array | null {
  const cfb = CFB.parse(bytes);
  const wanted = entryName.replace(/^Root Entry\/?/i, "").replace(/\/$/, "");
  const direct = CFB.find(cfb, wanted) ?? CFB.find(cfb, entryName);
  if (direct && direct.type === 2) {
    const data = cfbContentToBytes(direct.content);
    return data.length ? data.slice() : null;
  }
  // Match by basename or full path suffix
  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const fullPath = cfb.FullPaths[i]!.replace(/^Root Entry\/?/i, "");
    const entry = cfb.FileIndex[i]!;
    if (!entry || entry.type !== 2) continue;
    if (
      fullPath === wanted ||
      fullPath.replace(/\/$/, "") === wanted ||
      streamBasename(fullPath) === wanted
    ) {
      const data = cfbContentToBytes(entry.content);
      return data.length ? data.slice() : null;
    }
  }
  return null;
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
    if (format.container === "ole") return readOlePeek(bytes, format);
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
      const out = unzipBounded(bytes, (f) => f.name === entryName);
      return out[entryName] ?? null;
    }
    if (format.container === "gzip") {
      return await gunzip(bytes);
    }
    if (format.container === "ole") {
      return extractOleEntry(bytes, entryName);
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
  const ole = Object.values(OLE_PACKAGES).find((p) => p.id === id);
  if (ole || id === "ole") {
    return {
      id,
      container: "ole",
      label: ole?.label ?? "OLE Compound File",
    };
  }
  const label =
    Object.values(ZIP_PACKAGES).find((p) => p.id === id)?.label ??
    "Zip Archive";
  return { id, container: "zip", label };
}
