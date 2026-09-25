/**
 * Offline container sniff smoke: ZIP/OLE archives + Doom WAD directories
 * (no API keys).
 *
 *   pnpm archive-smoke
 */
import * as CFB from "cfb";
import { strToU8, zipSync } from "fflate";
import {
  formatFromId,
  isOleMagic,
  readArchive,
  scrapeOleReadableText,
  sniffArchiveFormat,
  unzipBounded,
} from "./archive";
import { composeForFile } from "./compose-lib";
import { loadDroppedFile } from "./files";
import { parseWad } from "./wad";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function buildOleDoc(): Uint8Array {
  const fib = new Uint8Array(256);
  fib[0] = 0xec;
  fib[1] = 0xa5;
  const text = "Quarterly report for classic DOC\rSecond paragraph here.";
  const u16 = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    u16[i * 2] = text.charCodeAt(i) & 0xff;
    u16[i * 2 + 1] = 0;
  }
  const word = new Uint8Array(fib.length + u16.length);
  word.set(fib, 0);
  word.set(u16, fib.length);
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "WordDocument", word);
  CFB.utils.cfb_add(cfb, "1Table", new Uint8Array(32));
  return new Uint8Array(CFB.write(cfb, { type: "array" }));
}

function buildOleXls(): Uint8Array {
  const book = new Uint8Array(128);
  const label = "Revenue";
  for (let i = 0; i < label.length; i++) {
    book[40 + i * 2] = label.charCodeAt(i);
    book[40 + i * 2 + 1] = 0;
  }
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "Workbook", book);
  return new Uint8Array(CFB.write(cfb, { type: "array" }));
}

console.log("OLE magic / sniff");
{
  const doc = buildOleDoc();
  check("isOleMagic(.doc fixture)", isOleMagic(doc));
  const sniffed = sniffArchiveFormat(
    doc,
    "report.doc",
    "application/msword",
  );
  check(
    "sniff .doc → ole/doc",
    sniffed?.container === "ole" && sniffed.id === "doc",
    sniffed ? `${sniffed.container}/${sniffed.id}` : "null",
  );
  check(
    "formatFromId(doc) is ole",
    formatFromId("doc").container === "ole",
  );
}

console.log("OLE peek text");
{
  const doc = buildOleDoc();
  const peek = await readArchive(
    doc,
    { id: "doc", container: "ole", label: "Word 97–2003" },
    "report.doc",
  );
  check(
    "lists WordDocument stream",
    peek.entries.some((e) => /worddocument/i.test(e.name)),
    peek.entries.map((e) => e.name).join(","),
  );
  check(
    "peeks classic DOC text",
    Boolean(peek.peekText?.includes("Quarterly report")),
    peek.peekText?.slice(0, 80) ?? "null",
  );
}

console.log("XLS sniff by stream refine");
{
  const xls = buildOleXls();
  const sniffed = sniffArchiveFormat(xls, "book.bin", "application/octet-stream");
  check(
    "magic-only OLE with Workbook → xls",
    sniffed?.id === "xls",
    sniffed ? sniffed.id : "null",
  );
  const scraped = scrapeOleReadableText(
    new Uint8Array(CFB.find(CFB.parse(xls), "Workbook")!.content as number[]),
  );
  check(
    "scrape Workbook unicode",
    Boolean(scraped?.includes("Revenue")),
    scraped ?? "null",
  );
}

console.log("OOXML still ZIP (not OLE)");
{
  // Minimal ZIP local-file header magic
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  const sniffed = sniffArchiveFormat(
    zip,
    "report.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  check(
    ".docx → zip/docx",
    sniffed?.container === "zip" && sniffed.id === "docx",
    sniffed ? `${sniffed.container}/${sniffed.id}` : "null",
  );
  check("docx is not OLE magic", !isOleMagic(zip));
}

function i32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

function name8(name: string): Uint8Array {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < Math.min(8, name.length); i++) {
    bytes[i] = name.charCodeAt(i);
  }
  return bytes;
}

function buildPwad(): Uint8Array {
  const mapLumps = [
    "THINGS",
    "LINEDEFS",
    "SIDEDEFS",
    "VERTEXES",
    "SEGS",
    "SSECTORS",
    "NODES",
    "SECTORS",
    "REJECT",
    "BLOCKMAP",
  ];
  const textBytes = new TextEncoder().encode(
    "Patch File for DeHackEd v3.0\nChex Quest\n",
  );
  const entries: Array<{ name: string; data: Uint8Array }> = [
    { name: "E1M1", data: new Uint8Array(0) },
    ...mapLumps.map((name) => ({ name, data: new Uint8Array([1, 2]) })),
    { name: "DEHACKED", data: textBytes },
    { name: "DSPISTOL", data: new Uint8Array([0, 3, 0, 0, 255]) },
  ];

  let cursor = 12;
  const placed = entries.map((entry) => {
    const offset = entry.data.length === 0 ? 0 : cursor;
    if (entry.data.length) cursor += entry.data.length;
    return { ...entry, offset };
  });
  const infotableofs = cursor;
  const out = new Uint8Array(infotableofs + entries.length * 16);
  out.set([0x50, 0x57, 0x41, 0x44], 0);
  out.set(i32(entries.length), 4);
  out.set(i32(infotableofs), 8);
  for (const entry of placed) {
    if (entry.data.length) out.set(entry.data, entry.offset);
  }
  placed.forEach((entry, index) => {
    const at = infotableofs + index * 16;
    out.set(i32(entry.offset), at);
    out.set(i32(entry.data.length), at + 4);
    out.set(name8(entry.name), at + 8);
  });
  return out;
}

console.log("Doom WAD directory");
{
  const bytes = buildPwad();
  const wad = parseWad(bytes);
  check("parses PWAD", wad?.identification === "PWAD");
  check("13 lumps", wad?.lumps.length === 13, String(wad?.lumps.length));
  check("map E1M1", wad?.maps.join(",") === "E1M1", wad?.maps.join(","));
  check(
    "DEHACKED is text",
    wad?.lumps.find((lump) => lump.name === "DEHACKED")?.role === "text",
  );
  check(
    "random bytes rejected",
    parseWad(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) == null,
  );
  const iwad = buildPwad();
  iwad.set([0x49, 0x57, 0x41, 0x44], 0);
  check("IWAD label", parseWad(iwad)?.label === "Doom IWAD");

  const file = new File([bytes as BlobPart], "chex.wad", {
    type: "application/octet-stream",
  });
  const loaded = await loadDroppedFile(file);
  check("load kind wad", loaded.kind === "wad", loaded.kind);
  if (loaded.kind === "wad") {
    const composed = await composeForFile(loaded);
    const types = composed.finalSpec
      ? Object.values(composed.finalSpec.elements).map((e) => e.type)
      : [];
    check("compose route wad", composed.route === "wad", composed.route);
    check("WadBrowser", types.includes("WadBrowser"), types.join(","));
    check("not BinaryInspector", !types.includes("BinaryInspector"));
  }
}

console.log("zip inflate cap");
{
  const payload = new Uint8Array(80_000);
  const packed = zipSync({ "note.txt": strToU8("hello archive") });
  const opened = unzipBounded(packed);
  check("small zip extracts", opened["note.txt"]?.length === 13);
  let capped = false;
  try {
    unzipBounded(zipSync({ "big.txt": payload }), undefined, 1000);
  } catch (error) {
    capped = error instanceof Error && /exceeds/.test(error.message);
  }
  check("oversized inflate rejected", capped);
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\narchive-smoke ok");
