/**
 * Offline routing smoke: unrecognized opaque binaries invent; planned
 * emulator formats still inspect. No API keys required (Jev fails → heuristic).
 *
 *   pnpm route-unknown-smoke
 */
import { composeForFile } from "./compose-lib";
import type { LoadedFile } from "./files";
import {
  heuristicInventOrInspect,
  routeUnknownFile,
} from "./route-unknown";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const opaqueBinary = {
  filename: "mystery.bin",
  mimeType: "application/octet-stream",
  size: 32,
  sampleText: null as string | null,
  hexPreview:
    "000000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f  ................",
  sourceUrl: null as string | null,
};

const plannedDisk = {
  filename: "games.dsk",
  mimeType: "application/octet-stream",
  size: 143360,
  sampleText: null as string | null,
  hexPreview:
    "000000  01 38 4e b3 00 00 00 00 00 00 00 00 00 00 00 00  .8N.............",
  sourceUrl: null as string | null,
};

console.log("heuristic invent-first");
{
  const opaque = heuristicInventOrInspect(
    opaqueBinary.filename,
    opaqueBinary.mimeType,
    opaqueBinary.sampleText,
  );
  check("opaque binary → invent", opaque.action === "invent", opaque.reason);

  const disk = heuristicInventOrInspect(
    plannedDisk.filename,
    plannedDisk.mimeType,
    plannedDisk.sampleText,
  );
  check(
    "planned .dsk → inspect",
    disk.action === "inspect" && disk.player?.id === "apple2-disk",
    disk.reason,
  );
}

console.log("\nrouteUnknownFile (Jev missing → heuristic)");
{
  // Ensure no live Jev key so we exercise the invent-first heuristic.
  const saved = {
    TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    JEV_AI_GATEWAY_API_KEY: process.env.JEV_AI_GATEWAY_API_KEY,
  };
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.JEV_AI_GATEWAY_API_KEY;

  const opaque = await routeUnknownFile(opaqueBinary);
  check(
    "route opaque → invent",
    opaque.action === "invent",
    `${opaque.action}: ${opaque.reason}`,
  );

  const disk = await routeUnknownFile(plannedDisk);
  check(
    "route planned → inspect",
    disk.action === "inspect",
    `${disk.action}: ${"reason" in disk ? disk.reason : ""}`,
  );

  if (saved.TYPESAFE_API_KEY !== undefined) {
    process.env.TYPESAFE_API_KEY = saved.TYPESAFE_API_KEY;
  }
  if (saved.AI_GATEWAY_API_KEY !== undefined) {
    process.env.AI_GATEWAY_API_KEY = saved.AI_GATEWAY_API_KEY;
  }
  if (saved.JEV_AI_GATEWAY_API_KEY !== undefined) {
    process.env.JEV_AI_GATEWAY_API_KEY = saved.JEV_AI_GATEWAY_API_KEY;
  }
}

console.log("\ncomposeForFile unknown binary → InventedViewer");
{
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.JEV_AI_GATEWAY_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const file: LoadedFile = {
    kind: "unknown",
    title: "Mystery",
    filename: opaqueBinary.filename,
    mimeType: opaqueBinary.mimeType,
    size: opaqueBinary.size,
    sampleText: opaqueBinary.sampleText,
    hexPreview: opaqueBinary.hexPreview,
    sourceUrl: null,
    inventedSpec: null,
    inventSource: null,
    inventPrompt: null,
    inventReason: null,
  };
  const result = await composeForFile(file);
  const types = result.finalSpec
    ? [...new Set(Object.values(result.finalSpec.elements).map((e) => e.type))]
    : [];
  check("route=invent", result.route === "invent", String(result.route));
  check(
    "InventedViewer (not BinaryInspector)",
    types.includes("InventedViewer") && !types.includes("BinaryInspector"),
    types.join(", "),
  );
  check(
    "fallback invent Spec present",
    Boolean(result.file.kind === "unknown" && result.file.inventedSpec),
  );
  check(
    "not auto-switched to inspect when Haiku down",
    result.file.kind === "unknown" &&
      (result.file.inventSource === "fallback" ||
        result.file.inventSource === "haiku"),
    result.file.kind === "unknown"
      ? String(result.file.inventSource)
      : result.file.kind,
  );
}

console.log("\ncomposeForFile planned disk → BinaryInspector");
{
  const file: LoadedFile = {
    kind: "unknown",
    title: "Disk",
    filename: plannedDisk.filename,
    mimeType: plannedDisk.mimeType,
    size: plannedDisk.size,
    sampleText: plannedDisk.sampleText,
    hexPreview: plannedDisk.hexPreview,
    sourceUrl: null,
    inventedSpec: null,
    inventSource: null,
    inventPrompt: null,
    inventReason: null,
  };
  const result = await composeForFile(file);
  const types = result.finalSpec
    ? [...new Set(Object.values(result.finalSpec.elements).map((e) => e.type))]
    : [];
  check("route=inspect", result.route === "inspect", String(result.route));
  check(
    "BinaryInspector",
    types.includes("BinaryInspector") && !types.includes("InventedViewer"),
    types.join(", "),
  );
}

if (failed) {
  console.error(`\nroute-unknown-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\nroute-unknown-smoke ok");
