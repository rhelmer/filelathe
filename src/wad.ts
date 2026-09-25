/**
 * Doom / Heretic / Hexen / Strife WAD directory.
 *
 * IWAD and PWAD are named lump containers, not emulators. Recognizing the
 * 12-byte header keeps them off the unknown path so Jev never chooses inspect.
 * Bytes stay client-side; this module only reads the directory and lump slices.
 */

export type WadIdentification = "IWAD" | "PWAD";

export type WadRole =
  | "map"
  | "mapdata"
  | "script"
  | "text"
  | "marker"
  | "palette"
  | "sound"
  | "music"
  | "demo"
  | "lump";

export type WadLump = {
  index: number;
  name: string;
  offset: number;
  size: number;
  role: WadRole;
  /** Map marker this lump belongs to, when it sits inside a map sequence. */
  map: string | null;
};

export type WadDirectory = {
  identification: WadIdentification;
  label: string;
  lumps: WadLump[];
  maps: string[];
};

const MAP_CORE = [
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
] as const;

const MAP_FOLLOW = new Set<string>([
  ...MAP_CORE,
  "BEHAVIOR",
  "SCRIPTS",
  "DIALOGUE",
  "ZNODES",
  "LIGHTMAP",
  "TEXTMAP",
  "ENDMAP",
]);

const TEXT_LUMPS = new Set([
  "DEHACKED",
  "MAPINFO",
  "ZMAPINFO",
  "EMAPINFO",
  "UMAPINFO",
  "LANGUAGE",
  "SNDINFO",
  "SNDSEQ",
  "ANIMDEFS",
  "DECORATE",
  "ZSCRIPT",
  "GAMEINFO",
  "KEYCONF",
  "LOCKDEFS",
  "TERRAIN",
  "GLDEFS",
  "DECALDEF",
  "MENUDEF",
  "TEXTURES",
  "VOXELDEF",
  "LOADACS",
  "CVARINFO",
  "SBARINFO",
  "TEXTCOLO",
  "MODELDEF",
  "REVERBS",
  "GENMIDI",
  "DMXGUS",
  "ENDOOM",
]);

function readI32(bytes: Uint8Array, off: number): number {
  return (
    (bytes[off]! |
      (bytes[off + 1]! << 8) |
      (bytes[off + 2]! << 16) |
      (bytes[off + 3]! << 24)) |
    0
  );
}

function readName(bytes: Uint8Array, off: number): string | null {
  let name = "";
  for (let i = 0; i < 8; i++) {
    const code = bytes[off + i]!;
    if (code === 0) break;
    if (code < 32 || code > 126) return null;
    name += String.fromCharCode(code);
  }
  return name.length ? name : null;
}

function mapSpan(raw: Array<{ name: string }>, index: number): number | null {
  const next = raw[index + 1];
  if (!next) return null;
  if (next.name === "TEXTMAP") {
    let end = index + 2;
    while (end < raw.length && raw[end]!.name !== "ENDMAP") end++;
    if (end >= raw.length || raw[end]!.name !== "ENDMAP") return null;
    return end - index + 1;
  }
  if (next.name !== "THINGS") return null;
  let matched = 0;
  while (
    matched < MAP_CORE.length &&
    raw[index + 1 + matched]?.name === MAP_CORE[matched]
  ) {
    matched++;
  }
  if (matched < 4) return null;
  let end = index + 1 + matched;
  while (end < raw.length && MAP_FOLLOW.has(raw[end]!.name)) end++;
  return end - index;
}

function roleFor(
  name: string,
  size: number,
  inMap: boolean,
  isMapMarker: boolean,
): WadRole {
  if (isMapMarker) return "map";
  if (inMap) {
    if (name === "TEXTMAP" || name === "SCRIPTS" || name === "DIALOGUE")
      return "script";
    if (name === "BEHAVIOR") return "script";
    return "mapdata";
  }
  if (size === 0) return "marker";
  if (TEXT_LUMPS.has(name)) return "text";
  if (name === "PLAYPAL" || name === "COLORMAP") return "palette";
  if (/^DEMO\d/.test(name)) return "demo";
  if (name.startsWith("DS") || name.startsWith("DP")) return "sound";
  if (name.startsWith("D_")) return "music";
  return "lump";
}

/** Parse a Doom-format WAD. Returns null when the header or directory is not valid. */
export function parseWad(bytes: Uint8Array): WadDirectory | null {
  if (bytes.length < 12) return null;
  const id = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (id !== "IWAD" && id !== "PWAD") return null;
  const numlumps = readI32(bytes, 4);
  const infotableofs = readI32(bytes, 8);
  if (numlumps < 1 || numlumps > 100_000) return null;
  if (infotableofs < 12) return null;
  const dirBytes = numlumps * 16;
  if (infotableofs > bytes.length || dirBytes > bytes.length - infotableofs) {
    return null;
  }

  const raw: Array<{ name: string; offset: number; size: number }> = [];
  for (let i = 0; i < numlumps; i++) {
    const at = infotableofs + i * 16;
    const offset = readI32(bytes, at);
    const size = readI32(bytes, at + 4);
    const name = readName(bytes, at + 8);
    if (!name || size < 0 || offset < 0) return null;
    if (size > 0 && (offset > bytes.length || size > bytes.length - offset)) {
      return null;
    }
    raw.push({ name, offset, size });
  }

  const mapAt = new Map<number, { name: string; span: number }>();
  for (let i = 0; i < raw.length; i++) {
    if (mapAt.has(i)) continue;
    const span = mapSpan(raw, i);
    if (!span) continue;
    const name = raw[i]!.name;
    for (let j = 0; j < span; j++) mapAt.set(i + j, { name, span });
    i += span - 1;
  }

  const lumps: WadLump[] = raw.map((lump, index) => {
    const group = mapAt.get(index) ?? null;
    const isMapMarker =
      group != null && (index === 0 || mapAt.get(index - 1)?.name !== group.name);
    return {
      index,
      name: lump.name,
      offset: lump.offset,
      size: lump.size,
      map: group?.name ?? null,
      role: roleFor(lump.name, lump.size, group != null, isMapMarker),
    };
  });

  const maps = lumps.filter((lump) => lump.role === "map").map((lump) => lump.name);
  return {
    identification: id,
    label: id === "IWAD" ? "Doom IWAD" : "Doom PWAD",
    lumps,
    maps,
  };
}

export function lumpBytes(bytes: Uint8Array, lump: WadLump): Uint8Array {
  if (lump.size <= 0) return new Uint8Array(0);
  return bytes.slice(lump.offset, lump.offset + lump.size);
}
