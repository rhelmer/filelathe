/**
 * Host players / emulators we can (or plan to) mount for dropped media.
 * Invent must never fake these — look here first, then inspect or invent UI.
 */

export type PlayerStatus = "available" | "planned";

export type PlayerEntry = {
  id: string;
  /** Human label for notes / Jev state */
  label: string;
  /** What this player does */
  description: string;
  /** Filename match (case-insensitive) */
  extensions: RegExp;
  /** Optional MIME substring matches */
  mimeIncludes?: string[];
  status: PlayerStatus;
  /**
   * When status is available, the json-render component already in the registry
   * (and usually a dedicated FileKind path).
   */
  component?: string;
  /** Existing FileKind when detection already routes here. */
  fileKind?: string;
};

/**
 * Curated catalog. Add a real host component + flip to `available` —
 * do not invent emulators via Haiku.
 */
export const PLAYER_REGISTRY: PlayerEntry[] = [
  {
    id: "tracker",
    label: "Tracker module player",
    description: "libopenmpt / chiptune3 for XM, MOD, IT, S3M, and related modules",
    extensions:
      /\.(xm|mod|it|s3m|mtm|umx|okt|669|far|med|stm|ult|amf|dmf|ptm|psm)$/i,
    mimeIncludes: ["modplug", "x-mod"],
    status: "available",
    component: "TrackerPlayer",
    fileKind: "tracker",
  },
  {
    id: "audio",
    label: "Audio player",
    description: "HTML audio for common compressed/uncompressed audio",
    extensions: /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus)$/i,
    mimeIncludes: ["audio/"],
    status: "available",
    component: "AudioPlayer",
    fileKind: "audio",
  },
  {
    id: "video",
    label: "Video player",
    description: "HTML video for common containers",
    extensions: /\.(mp4|webm|ogv|mov|m4v|mkv)$/i,
    mimeIncludes: ["video/"],
    status: "available",
    component: "VideoPlayer",
    fileKind: "video",
  },
  {
    id: "apple2-disk",
    label: "Apple II disk emulator",
    description:
      "Boot .dsk / .po / .nib images in an Apple II JS/WASM emulator (not invented)",
    extensions: /\.(dsk|po|nib|do|woz)$/i,
    status: "planned",
  },
  {
    id: "c64-disk",
    label: "Commodore 64 disk emulator",
    description: "D64/T64 disk/tape images in a C64 emulator (not invented)",
    extensions: /\.(d64|t64|g64|p00)$/i,
    status: "planned",
  },
  {
    id: "nes-rom",
    label: "NES emulator",
    description: "iNES .nes ROMs in a host emulator (not invented)",
    extensions: /\.(nes|fds)$/i,
    status: "planned",
  },
  {
    id: "gameboy-rom",
    label: "Game Boy emulator",
    description: "GB/GBC ROMs in a host emulator (not invented)",
    extensions: /\.(gb|gbc|sgb)$/i,
    status: "planned",
  },
  {
    id: "genesis-rom",
    label: "Sega Genesis / Mega Drive emulator",
    description: "MD/GEN/SMD ROMs in a host emulator (not invented)",
    extensions: /\.(md|gen|smd)$/i,
    status: "planned",
  },
  {
    id: "dos-disk",
    label: "DOS / PC disk emulator",
    description: "IMG/IMA floppy images in a DOSBox-style host (not invented)",
    extensions: /\.(img|ima|vfd)$/i,
    status: "planned",
  },
];

export function extensionOf(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
}

/** Players whose extension/MIME match this file (available or planned). */
export function matchPlayers(
  filename: string,
  mimeType: string,
): PlayerEntry[] {
  const mime = mimeType.toLowerCase();
  return PLAYER_REGISTRY.filter((entry) => {
    if (entry.extensions.test(filename)) return true;
    if (entry.mimeIncludes?.some((part) => mime.includes(part.toLowerCase()))) {
      return true;
    }
    return false;
  });
}

export function availablePlayer(matches: PlayerEntry[]): PlayerEntry | null {
  return matches.find((entry) => entry.status === "available") ?? null;
}

export function plannedPlayer(matches: PlayerEntry[]): PlayerEntry | null {
  return matches.find((entry) => entry.status === "planned") ?? null;
}

/** Short list for Jev state / prompts. */
export function playerRegistrySummary(): Array<{
  id: string;
  label: string;
  status: PlayerStatus;
  extensions: string;
}> {
  return PLAYER_REGISTRY.map((entry) => ({
    id: entry.id,
    label: entry.label,
    status: entry.status,
    extensions: entry.extensions.source,
  }));
}
