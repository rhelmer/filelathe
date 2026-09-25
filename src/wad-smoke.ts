/**
 * Offline Doom WAD directory smoke (no API keys).
 *
 *   pnpm wad-smoke
 */
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
  const text = "Patch File for DeHackEd v3.0\nChex Quest\n";
  const textBytes = new TextEncoder().encode(text);
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
  out.set([0x50, 0x57, 0x41, 0x44], 0); // PWAD
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

console.log("parse PWAD");
{
  const bytes = buildPwad();
  const wad = parseWad(bytes);
  check("parses", wad != null);
  check("identification PWAD", wad?.identification === "PWAD");
  check("13 lumps", wad?.lumps.length === 13, String(wad?.lumps.length));
  check("map E1M1", wad?.maps.join(",") === "E1M1", wad?.maps.join(","));
  const dehacked = wad?.lumps.find((lump) => lump.name === "DEHACKED");
  check("DEHACKED is text", dehacked?.role === "text", dehacked?.role);
  const pistol = wad?.lumps.find((lump) => lump.name === "DSPISTOL");
  check("DSPISTOL is sound", pistol?.role === "sound", pistol?.role);
  check("THINGS belongs to E1M1", wad?.lumps.find((l) => l.name === "THINGS")?.map === "E1M1");
}

console.log("reject non-wads");
{
  check("random bytes", parseWad(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) == null);
  const truncated = new Uint8Array(12);
  truncated.set([0x50, 0x57, 0x41, 0x44]);
  truncated.set(i32(10), 4);
  truncated.set(i32(12), 8);
  check("truncated directory", parseWad(truncated) == null);
  const iwad = buildPwad();
  iwad.set([0x49, 0x57, 0x41, 0x44], 0);
  check("IWAD label", parseWad(iwad)?.label === "Doom IWAD");
}

console.log("load + compose skips Jev inspect");
{
  const bytes = buildPwad();
  const file = new File([bytes as BlobPart], "chex.wad", {
    type: "application/octet-stream",
  });
  const loaded = await loadDroppedFile(file);
  check("kind wad", loaded.kind === "wad", loaded.kind);
  if (loaded.kind === "wad") {
    check("format Doom PWAD", loaded.formatLabel === "Doom PWAD");
    const composed = await composeForFile(loaded);
    const types = composed.finalSpec
      ? Object.values(composed.finalSpec.elements).map((element) => element.type)
      : [];
    check("route wad", composed.route === "wad", composed.route);
    check("WadBrowser", types.includes("WadBrowser"), types.join(","));
    check("not BinaryInspector", !types.includes("BinaryInspector"));
  }
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nwad-smoke passed");
