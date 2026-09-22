import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { composeForFile } from "./compose-lib";
import type { LoadedFile } from "./files";

const samples: LoadedFile[] = [
  {
    kind: "audio",
    title: "Night Drive",
    filename: "night-drive.mp3",
    mimeType: "audio/mpeg",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    durationLabel: "3:42",
  },
  {
    kind: "image",
    title: "Sunset",
    filename: "sunset.jpg",
    mimeType: "image/jpeg",
    src: "https://picsum.photos/640/360",
    width: 640,
    height: 360,
  },
  {
    kind: "json",
    title: "Profile",
    filename: "profile.json",
    mimeType: "application/json",
    data: {
      name: "Maya Chen",
      email: "maya@example.com",
      notifications: true,
      role: "Designer",
    },
  },
  {
    kind: "csv",
    title: "Orders",
    filename: "orders.csv",
    mimeType: "text/csv",
    columns: ["Status", "Orders"],
    rows: [
      ["Fulfilled", "312"],
      ["Processing", "54"],
      ["Returned", "18"],
    ],
  },
  {
    kind: "text",
    title: "Notes",
    filename: "notes.txt",
    mimeType: "text/plain",
    text: "Ship the generative UI demo.\nKeep candidates app-owned.",
  },
  {
    kind: "markdown",
    title: "Readme",
    filename: "readme.md",
    mimeType: "text/markdown",
    markdown:
      "# Filelathe\n\n- Tracker modules\n- **PDF** and video\n\n```ts\nconst ok = true;\n```\n",
  },
  {
    kind: "webpage",
    title: "Example",
    filename: "example.com",
    mimeType: "text/html",
    html: "<!doctype html><html><body><h1>Example Domain</h1><p>Snapshot preview.</p></body></html>",
    sourceUrl: "https://example.com/",
  },
  {
    kind: "pdf",
    title: "Spec",
    filename: "spec.pdf",
    mimeType: "application/pdf",
    src: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  },
  {
    kind: "video",
    title: "Clip",
    filename: "clip.mp4",
    mimeType: "video/mp4",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    durationLabel: "0:13",
    width: 480,
    height: 270,
  },
  {
    kind: "tracker",
    title: "Demo Tune",
    filename: "demo.xm",
    mimeType: "audio/x-xm",
    moduleId: "smoke-mod-1",
    format: "xm",
    channels: 8,
    moduleTitle: "Demo Tune",
  },
  {
    kind: "archive",
    title: "Report",
    filename: "report.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 20480,
    archiveId: "smoke-arc-1",
    format: "docx",
    formatLabel: "Word Document",
    entries: [
      { name: "[Content_Types].xml", size: 1312, isDir: false },
      { name: "word/", size: 0, isDir: true },
      { name: "word/document.xml", size: 4096, isDir: false },
    ],
    peekText: "Quarterly report\n\nRevenue grew 12% year over year.",
    peekXml: "<w:document><w:body><w:p>Quarterly report</w:p></w:body></w:document>",
    hexPreview:
      "000000  50 4b 03 04 14 00 06 00 08 00 00 00 21 00 00 00  PK..........!...",
  },
  {
    kind: "unknown",
    title: "Mystery",
    filename: "mystery.bin",
    mimeType: "application/octet-stream",
    size: 32,
    sampleText: null,
    hexPreview:
      "000000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f  ................",
    sourceUrl: null,
    inventedSpec: null,
    inventSource: null,
    inventPrompt: null,
  },
  {
    kind: "unknown",
    title: "Disk",
    filename: "games.dsk",
    mimeType: "application/octet-stream",
    size: 143360,
    sampleText: null,
    hexPreview:
      "000000  01 38 4e b3 00 00 00 00 00 00 00 00 00 00 00 00  .8N.............",
    sourceUrl: null,
    inventedSpec: null,
    inventSource: null,
    inventPrompt: null,
  },
];

const kind = process.argv
  .slice(2)
  .map((arg) => arg.replace(/^--kind=/, ""))
  .find((arg) => samples.some((sample) => sample.kind === arg));
const selected = kind
  ? samples.filter((sample) => sample.kind === kind)
  : samples;

if (!selected.length) {
  console.error(
    `Unknown kind. Use one of: ${samples.map((s) => s.kind).join(", ")}`,
  );
  process.exit(1);
}

for (const file of selected) {
  process.stdout.write(`\n› ${file.kind}: ${file.filename}\n`);
  const result = await composeForFile(file);
  const types = result.finalSpec
    ? [...new Set(Object.values(result.finalSpec.elements).map((e) => e.type))]
    : [];
  const ok =
    result.stopReason === "finish" &&
    Boolean(result.finalSpec?.root) &&
    (file.kind !== "audio" || types.includes("AudioPlayer")) &&
    (file.kind !== "image" || types.includes("PixelEditor")) &&
    (file.kind !== "csv" || types.includes("Spreadsheet")) &&
    (file.kind !== "text" || types.includes("Text")) &&
    (file.kind !== "markdown" || types.includes("MarkdownView")) &&
    (file.kind !== "webpage" || types.includes("WebPageViewer")) &&
    (file.kind !== "pdf" || types.includes("PdfViewer")) &&
    (file.kind !== "video" || types.includes("VideoPlayer")) &&
    (file.kind !== "tracker" || types.includes("TrackerPlayer")) &&
    (file.kind !== "archive" || types.includes("ArchiveBrowser")) &&
    (file.kind !== "unknown" ||
      types.includes("InventedViewer") ||
      types.includes("BinaryInspector")) &&
    (file.kind !== "json" ||
      types.includes("Input") ||
      types.includes("Switch"));
  console.log(
    `  ${ok ? "ok" : "FAIL"} stopReason=${result.stopReason} types=[${types.join(", ")}]${
      result.file.kind === "unknown"
        ? ` invent=${result.file.inventSource}`
        : ""
    }`,
  );
  console.log(`  prompt: ${result.prompt}`);
  if (result.finalSpec) {
    writeFileSync(
      resolve(import.meta.dirname, `../.last-spec-${file.kind}.json`),
      JSON.stringify(result.finalSpec, null, 2),
    );
  }
  if (!ok) process.exitCode = 1;
}
