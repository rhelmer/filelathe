/**
 * Offline office promotion smoke (doc → markdown, xls → spreadsheet).
 *
 *   pnpm office-smoke
 */
import * as CFB from "cfb";
import * as XLSX from "xlsx";
import { sniffArchiveFormat } from "./archive";
import {
  extractSpreadsheetGrid,
  extractWordBinaryText,
  promoteOfficeFormat,
  proseToMarkdown,
} from "./office";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function buildScrapeDoc(): Uint8Array {
  const fib = new Uint8Array(256);
  fib[0] = 0xec;
  fib[1] = 0xa5;
  const text =
    "Quarterly report for classic DOC\rSecond paragraph here.\rClosing.";
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

function buildGridXls(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Item", "Q1", "Q2", "Total"],
    ["Widgets", "10", "12", "22"],
    ["Gadgets", "5", "8", "13"],
    ["Revenue", "100", "140", "240"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return new Uint8Array(XLSX.write(wb, { bookType: "xls", type: "array" }));
}

console.log("promote .doc → markdown");
{
  const doc = buildScrapeDoc();
  const format = sniffArchiveFormat(doc, "report.doc", "application/msword");
  check("sniff doc", format?.id === "doc", format?.id ?? "null");
  const promoted = await promoteOfficeFormat(doc, format!);
  check("kind markdown", promoted?.kind === "markdown", promoted?.kind);
  if (promoted?.kind === "markdown") {
    check(
      "has quarterly text",
      /Quarterly report/i.test(promoted.markdown),
      promoted.markdown.slice(0, 80),
    );
    check(
      "markdown paragraphs",
      promoted.markdown.includes("\n\n") ||
        promoted.markdown.includes("Second paragraph"),
      promoted.markdown.slice(0, 120),
    );
  }
  // Piece table may fail on synthetic FIB; scrape fallback must still work
  const pieces = extractWordBinaryText(doc);
  check(
    "piece table or scrape path yields text via promote",
    promoted?.kind === "markdown" && Boolean(promoted.markdown.trim()),
    pieces ? `pieces=${pieces.slice(0, 40)}` : "pieces=null (scrape used)",
  );
}

console.log("promote .xls → spreadsheet");
{
  const xls = buildGridXls();
  const format = sniffArchiveFormat(xls, "book.xls", "application/vnd.ms-excel");
  check("sniff xls", format?.id === "xls", format?.id ?? "null");
  const grid = extractSpreadsheetGrid(xls, format!);
  check(
    "grid headers",
    Boolean(grid && grid.columns[0] === "Item" && grid.columns[3] === "Total"),
    grid?.columns.join(",") ?? "null",
  );
  check(
    "grid row Widgets",
    Boolean(grid?.rows.some((r) => r[0] === "Widgets" && r[1] === "10")),
    JSON.stringify(grid?.rows?.[0]),
  );
  const promoted = await promoteOfficeFormat(xls, format!);
  check("kind csv", promoted?.kind === "csv", promoted?.kind);
  if (promoted?.kind === "csv") {
    check(
      "promoted Revenue row",
      promoted.rows.some((r) => r[0] === "Revenue" && r[3] === "240"),
      JSON.stringify(promoted.rows),
    );
  }
}

console.log("promote .pptx → slides");
{
  const { readFileSync } = await import("node:fs");
  const pptx = new Uint8Array(
    readFileSync("/tmp/filelathe-fixtures/demo-deck.pptx"),
  );
  const format = sniffArchiveFormat(
    pptx,
    "demo-deck.pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  check("sniff pptx", format?.id === "pptx", format?.id ?? "null");
  const promoted = await promoteOfficeFormat(pptx, format!);
  check("kind slides", promoted?.kind === "slides", promoted?.kind);
}

console.log("xlsx charts");
{
  const { readFileSync } = await import("node:fs");
  const { extractXlsxCharts } = await import("./office");
  const xlsx = new Uint8Array(
    readFileSync("/tmp/filelathe-fixtures/charted-book.xlsx"),
  );
  const charts = extractXlsxCharts(xlsx);
  check("found chart", charts.length >= 1, String(charts.length));
  check(
    "chart has Widgets",
    Boolean(charts[0]?.data.some((d) => d.label === "Widgets" && d.value === 10)),
    JSON.stringify(charts[0]),
  );
  const format = sniffArchiveFormat(
    xlsx,
    "charted-book.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const promoted = await promoteOfficeFormat(xlsx, format!);
  check(
    "promoted csv includes charts",
    promoted?.kind === "csv" && Boolean(promoted.charts?.length),
    promoted?.kind === "csv" ? String(promoted.charts?.length) : promoted?.kind,
  );
}

console.log("proseToMarkdown");
{
  const md = proseToMarkdown("Hello\n\nWorld\nline");
  check("paragraph split", md.includes("Hello") && md.includes("World"), md);
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\noffice-smoke ok");
