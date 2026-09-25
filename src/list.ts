import { buildFileCandidates } from "./file-candidates";
import type { LoadedFile } from "./files";

const samples: LoadedFile[] = [
  {
    kind: "audio",
    title: "Night Drive",
    filename: "night-drive.mp3",
    mimeType: "audio/mpeg",
    src: "blob:sample",
    durationLabel: "3:42",
  },
  {
    kind: "image",
    title: "Sunset",
    filename: "sunset.jpg",
    mimeType: "image/jpeg",
    src: "blob:sample",
    width: 640,
    height: 360,
  },
  {
    kind: "json",
    title: "Profile",
    filename: "profile.json",
    mimeType: "application/json",
    data: { name: "Maya", notifications: true },
  },
  {
    kind: "csv",
    title: "Orders",
    filename: "orders.csv",
    mimeType: "text/csv",
    columns: ["A", "B"],
    rows: [["1", "2"]],
  },
  {
    kind: "text",
    title: "Notes",
    filename: "notes.txt",
    mimeType: "text/plain",
    text: "Hello",
  },
  {
    kind: "markdown",
    title: "Readme",
    filename: "readme.md",
    mimeType: "text/markdown",
    markdown: "# Hello\n\nWorld",
  },
  {
    kind: "webpage",
    title: "Example",
    filename: "example.com",
    mimeType: "text/html",
    html: "<!doctype html><html><body><h1>Hello</h1></body></html>",
    sourceUrl: "https://example.com/",
  },
  {
    kind: "pdf",
    title: "Spec",
    filename: "spec.pdf",
    mimeType: "application/pdf",
    src: "blob:sample",
  },
  {
    kind: "video",
    title: "Clip",
    filename: "clip.mp4",
    mimeType: "video/mp4",
    src: "blob:sample",
    durationLabel: "0:13",
    width: 480,
    height: 270,
  },
  {
    kind: "tracker",
    title: "Demo",
    filename: "demo.xm",
    mimeType: "audio/x-xm",
    moduleId: "sample-mod",
    format: "xm",
    channels: 8,
    moduleTitle: "Demo",
  },
  {
    kind: "unknown",
    title: "Mystery",
    filename: "mystery.bin",
    mimeType: "application/octet-stream",
    size: 12,
    sampleText: null,
    hexPreview: "000000  deadbeef",
    sourceUrl: null,
    inventedSpec: {
      root: "t",
      elements: {
        t: { type: "Text", props: { text: "preview", variant: "body" } },
      },
    },
    inventSource: "fallback",
    inventPrompt: "preview prompt",
  },
];

console.log("Filelathe");
console.log("---------");
console.log("1. pnpm dev → open the URL → drop a file.");
console.log(
  "2. pnpm file-smoke  (or --kind=audio|image|json|csv|text|markdown|pdf|video|tracker|unknown)",
);
console.log("3. This command lists the candidates minted per file type.\n");

for (const file of samples) {
  const candidates = buildFileCandidates(file);
  console.log(`${file.kind} → ${candidates.length} candidates`);
  for (const candidate of candidates) {
    console.log(`  - ${candidate.id}: ${candidate.element.type}`);
  }
  console.log();
}
