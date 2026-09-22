/**
 * Offline archive sniff / OLE peek smoke (no API keys).
 *
 *   pnpm archive-smoke
 */
import * as CFB from "cfb";
import {
  formatFromId,
  isOleMagic,
  readArchive,
  scrapeOleReadableText,
  sniffArchiveFormat,
} from "./archive";

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

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\narchive-smoke ok");
