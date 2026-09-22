/**
 * Higher-fidelity Office content extractors.
 *
 * Classic OLE (.doc/.xls) and ZIP packages (.docx/.xlsx/.odt/.ods) can be
 * promoted out of ArchiveBrowser into the same viewers used for markdown/CSV:
 *   - documents → markdown (prose typography via MarkdownView)
 *   - spreadsheets → csv (Spreadsheet grid)
 *
 * Bytes stay client-side. Falls back to null when extraction fails so the
 * caller can keep the archive inspector path.
 */
import * as CFB from "cfb";
import * as XLSX from "xlsx";
import {
  type ArchiveFormat,
  readArchive,
  scrapeOleReadableText,
} from "./archive";

const MAX_DOC_CHARS = 100_000;
const MAX_SHEET_ROWS = 100;
const MAX_SHEET_COLS = 40;

const DOCUMENT_FORMATS = new Set(["doc", "docx", "odt"]);
const SHEET_FORMATS = new Set(["xls", "xlsx", "ods"]);

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function cfbContentToBytes(
  content: number[] | Uint8Array | undefined,
): Uint8Array {
  if (!content) return new Uint8Array();
  if (content instanceof Uint8Array) return content;
  return new Uint8Array(content);
}

function findOleStream(bytes: Uint8Array, name: string): Uint8Array | null {
  try {
    const cfb = CFB.parse(bytes);
    const entry = CFB.find(cfb, name);
    if (!entry || entry.type !== 2) return null;
    const data = cfbContentToBytes(entry.content);
    return data.length ? data : null;
  } catch {
    return null;
  }
}

/** ANSI / CP1252 specials used by compressed Word pieces (MS-DOC FcCompressed). */
const WORD_ANSI_MAP: Record<number, string> = {
  0x82: "\u201A",
  0x83: "\u0192",
  0x84: "\u201E",
  0x85: "\u2026",
  0x86: "\u2020",
  0x87: "\u2021",
  0x88: "\u02C6",
  0x89: "\u2030",
  0x8A: "\u0160",
  0x8B: "\u2039",
  0x8C: "\u0152",
  0x91: "\u2018",
  0x92: "\u2019",
  0x93: "\u201C",
  0x94: "\u201D",
  0x95: "\u2022",
  0x96: "\u2013",
  0x97: "\u2014",
  0x98: "\u02DC",
  0x99: "\u2122",
  0x9A: "\u0161",
  0x9B: "\u203A",
  0x9C: "\u0153",
  0x9F: "\u0178",
};

function decodeWordAnsiChar(code: number): string {
  if (WORD_ANSI_MAP[code]) return WORD_ANSI_MAP[code]!;
  if (code === 0x0d || code === 0x07) return "\n"; // paragraph / cell mark
  if (code === 0x0b) return "\n"; // line break
  if (code === 0x09) return "\t";
  if (code < 0x20) return "";
  return String.fromCharCode(code);
}

/**
 * Word 97–2003 piece-table text extraction (MS-DOC Clx / PlcPcd).
 * Falls back to null when FIB/CLX is missing or corrupt.
 */
export function extractWordBinaryText(bytes: Uint8Array): string | null {
  const wordDoc = findOleStream(bytes, "WordDocument");
  if (!wordDoc || wordDoc.length < 0x4c) return null;
  if (readU16(wordDoc, 0) !== 0xa5ec) return null;

  const flags = readU16(wordDoc, 0x0a);
  const use1Table = (flags & 0x0200) !== 0;
  const table = findOleStream(bytes, use1Table ? "1Table" : "0Table");
  if (!table) return null;

  // Walk FIB to FibRgFcLcb97.fcClx (index 66) and ccpText (fibRgLw index 3).
  let o = 32;
  if (o + 2 > wordDoc.length) return null;
  const csw = readU16(wordDoc, o);
  o += 2 + 2 * csw;
  if (o + 2 > wordDoc.length) return null;
  const cslw = readU16(wordDoc, o);
  o += 2;
  if (cslw < 4 || o + 4 * cslw > wordDoc.length) return null;
  const ccpText = readU32(wordDoc, o + 3 * 4);
  o += 4 * cslw;
  if (o + 2 > wordDoc.length) return null;
  const cbRgFcLcb = readU16(wordDoc, o);
  o += 2;
  if (cbRgFcLcb <= 66 || o + (66 + 1) * 8 > wordDoc.length) return null;
  const fcClx = readU32(wordDoc, o + 66 * 8);
  const lcbClx = readU32(wordDoc, o + 66 * 8 + 4);
  if (!lcbClx || fcClx + lcbClx > table.length) return null;

  const clx = table.subarray(fcClx, fcClx + lcbClx);
  let pos = 0;
  while (pos < clx.length && clx[pos] === 0x01) {
    if (pos + 3 > clx.length) return null;
    const cb = readU16(clx, pos + 1);
    const advance = 3 + cb;
    if (advance <= 0) return null;
    pos += advance;
  }
  if (pos >= clx.length || clx[pos] !== 0x02) return null;
  pos += 1;
  if (pos + 4 > clx.length) return null;
  const lcbPcd = readU32(clx, pos);
  pos += 4;
  if (lcbPcd < 16 || pos + lcbPcd > clx.length) return null;

  const nPieces = Math.floor((lcbPcd - 4) / 12);
  if (nPieces <= 0) return null;

  const cps: number[] = [];
  for (let i = 0; i < nPieces + 1; i++) {
    cps.push(readU32(clx, pos + i * 4));
  }
  const pcdArrayStart = pos + (nPieces + 1) * 4;
  const parts: string[] = [];
  let chars = 0;

  for (let i = 0; i < nPieces; i++) {
    if (ccpText > 0 && chars >= ccpText) break;
    const pieceChars = cps[i + 1]! - cps[i]!;
    if (pieceChars <= 0) continue;
    const take = ccpText > 0 ? Math.min(pieceChars, ccpText - chars) : pieceChars;
    const fcValue = readU32(clx, pcdArrayStart + i * 8 + 2);
    const compressed = (fcValue & 0x40000000) !== 0;
    const fc = fcValue & 0x3fffffff;

    if (compressed) {
      const start = fc >>> 1;
      const end = Math.min(start + take, wordDoc.length);
      let chunk = "";
      for (let j = start; j < end; j++) {
        chunk += decodeWordAnsiChar(wordDoc[j]!);
      }
      parts.push(chunk);
    } else {
      const start = fc;
      const end = Math.min(start + take * 2, wordDoc.length);
      let chunk = "";
      for (let j = start; j + 1 < end; j += 2) {
        const code = wordDoc[j]! | (wordDoc[j + 1]! << 8);
        if (code === 0x0d || code === 0x07 || code === 0x0b) chunk += "\n";
        else if (code === 0x09) chunk += "\t";
        else if (code >= 0x20 && code !== 0xfeff) chunk += String.fromCharCode(code);
      }
      parts.push(chunk);
    }
    chars += take;
  }

  const text = parts
    .join("")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, MAX_DOC_CHARS) : null;
}

/** Normalize extracted prose into markdown-friendly paragraphs. */
export function proseToMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, "  \n").trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_DOC_CHARS);
}

/** Extract plain/markdown body for document formats. */
export async function extractDocumentMarkdown(
  bytes: Uint8Array,
  format: ArchiveFormat,
): Promise<string | null> {
  if (format.id === "doc") {
    const fromPieces = extractWordBinaryText(bytes);
    if (fromPieces) return proseToMarkdown(fromPieces);
    const wordDoc = findOleStream(bytes, "WordDocument");
    const scraped = wordDoc ? scrapeOleReadableText(wordDoc, MAX_DOC_CHARS) : null;
    return scraped ? proseToMarkdown(scraped) : null;
  }

  if (format.id === "docx" || format.id === "odt") {
    const peek = await readArchive(bytes, format, `peek.${format.id}`);
    return peek.peekText ? proseToMarkdown(peek.peekText) : null;
  }

  return null;
}

function cellString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

/**
 * Parse .xls / .xlsx / .ods into the same columns/rows shape CSV uses.
 * Uses SheetJS (xlsx) — reads BIFF OLE and OOXML/ODF packages.
 */
export function extractSpreadsheetGrid(
  bytes: Uint8Array,
  _format: ArchiveFormat,
): { columns: string[]; rows: string[][] } | null {
  try {
    const wb = XLSX.read(bytes, {
      type: "array",
      raw: false,
      cellDates: true,
      dense: false,
    });
    const name = wb.SheetNames[0];
    if (!name) return null;
    const sheet = wb.Sheets[name];
    if (!sheet) return null;

    const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
      sheet,
      {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      },
    );
    if (!aoa.length) return null;

    const width = Math.min(
      MAX_SHEET_COLS,
      Math.max(...aoa.map((row) => (Array.isArray(row) ? row.length : 0)), 1),
    );
    const normalize = (row: unknown): string[] => {
      const cells = Array.isArray(row) ? row : [];
      const out: string[] = [];
      for (let c = 0; c < width; c++) out.push(cellString(cells[c]));
      return out;
    };

    const header = normalize(aoa[0]);
    // If the first row is entirely empty, synthesize A/B/C headers.
    const columns = header.some((c) => c.trim())
      ? header.map((c, i) => c.trim() || colLabel(i))
      : Array.from({ length: width }, (_, i) => colLabel(i));

    const dataRows = header.some((c) => c.trim()) ? aoa.slice(1) : aoa;
    const rows = dataRows
      .slice(0, MAX_SHEET_ROWS)
      .map(normalize)
      .filter((row) => row.some((c) => c.trim()));

    if (!columns.length) return null;
    return { columns, rows };
  } catch (error) {
    console.warn(
      "[office] spreadsheet parse failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function colLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export type OfficePromotion =
  | {
      kind: "markdown";
      markdown: string;
      mimeType: string;
    }
  | {
      kind: "csv";
      columns: string[];
      rows: string[][];
      mimeType: string;
    };

/**
 * Try to promote an archive/OLE Office format into markdown or spreadsheet.
 * Returns null to keep the ArchiveBrowser path (zip listing, ppt, etc.).
 */
export async function promoteOfficeFormat(
  bytes: Uint8Array,
  format: ArchiveFormat,
): Promise<OfficePromotion | null> {
  if (DOCUMENT_FORMATS.has(format.id)) {
    const markdown = await extractDocumentMarkdown(bytes, format);
    if (!markdown?.trim()) return null;
    return {
      kind: "markdown",
      markdown,
      mimeType:
        format.id === "doc"
          ? "application/msword"
          : format.id === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/vnd.oasis.opendocument.text",
    };
  }

  if (SHEET_FORMATS.has(format.id)) {
    const grid = extractSpreadsheetGrid(bytes, format);
    if (!grid || (!grid.rows.length && !grid.columns.some((c) => c.trim()))) {
      return null;
    }
    return {
      kind: "csv",
      columns: grid.columns,
      rows: grid.rows,
      mimeType:
        format.id === "xls"
          ? "application/vnd.ms-excel"
          : format.id === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/vnd.oasis.opendocument.spreadsheet",
    };
  }

  return null;
}

export function isDocumentOfficeFormat(id: string): boolean {
  return DOCUMENT_FORMATS.has(id);
}

export function isSheetOfficeFormat(id: string): boolean {
  return SHEET_FORMATS.has(id);
}
