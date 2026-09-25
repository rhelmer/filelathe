import { useMemo, useState } from "react";
import { getArchive } from "./archive-store";
import { toHexPreview } from "./resource-utils";
import {
  lumpBytes,
  parseWad,
  type WadLump,
  type WadRole,
} from "./wad";

type WadBrowserProps = {
  wadId: string;
  filename: string;
  mimeType: string;
  size: number;
  identification: "IWAD" | "PWAD";
  formatLabel: string;
  lumpCount: number;
  mapCount: number;
  mapNames: string[];
  note: string | null;
};

const ROLE_FILTERS: Array<{ id: "all" | WadRole; label: string }> = [
  { id: "all", label: "All" },
  { id: "map", label: "Maps" },
  { id: "text", label: "Text" },
  { id: "script", label: "Scripts" },
  { id: "sound", label: "Sounds" },
  { id: "music", label: "Music" },
  { id: "lump", label: "Other" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function previewLump(bytes: Uint8Array, lump: WadLump): { mode: "text" | "hex"; body: string } {
  const slice = lumpBytes(bytes, lump);
  if (slice.length === 0) return { mode: "text", body: "(empty marker)" };
  const sample = slice.slice(0, 8000);
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127)) {
      printable++;
    }
  }
  const textish =
    lump.role === "text" ||
    lump.role === "script" ||
    printable / sample.length > 0.85;
  if (textish) {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(slice.slice(0, 20_000))
      .replace(/\u0000/g, "");
    return { mode: "text", body: text.trim() || "(no text)" };
  }
  return { mode: "hex", body: toHexPreview(slice, 256) };
}

export function WadBrowser({ props }: { props: WadBrowserProps }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]["id"]>("all");
  const [mapName, setMapName] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const loaded = useMemo(() => {
    const buffer = getArchive(props.wadId);
    if (!buffer) return null;
    const bytes = new Uint8Array(buffer);
    const directory = parseWad(bytes);
    if (!directory) return null;
    return { bytes, directory };
  }, [props.wadId]);

  const lumps = loaded?.directory.lumps ?? [];
  const maps = loaded?.directory.maps ?? props.mapNames;
  const needle = query.trim().toUpperCase();
  const visible = lumps.filter((lump) => {
    if (mapName && lump.map !== mapName && lump.name !== mapName) return false;
    if (role !== "all" && lump.role !== role) return false;
    if (needle && !lump.name.toUpperCase().includes(needle)) return false;
    return true;
  });
  const current =
    selected == null ? null : lumps.find((lump) => lump.index === selected) ?? null;
  const preview =
    current && loaded ? previewLump(loaded.bytes, current) : null;

  return (
    <div className="space-y-3">
      {props.note ? (
        <p className="text-xs text-muted-foreground">{props.note}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
          {props.formatLabel}
        </span>
        <span>
          {props.filename} · {formatBytes(props.size)} ·{" "}
          {loaded ? lumps.length : props.lumpCount} lumps ·{" "}
          {loaded ? maps.length : props.mapCount} maps
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Directory of a Doom-format WAD. Maps and lumps stay in this window — this
        is not a game emulator.
      </p>

      {!loaded ? (
        <p className="text-xs text-muted-foreground">
          WAD bytes are no longer in this session — re-drop the file to browse lumps.
          {props.mapNames.length
            ? ` Maps: ${props.mapNames.slice(0, 24).join(", ")}`
            : ""}
        </p>
      ) : (
        <>
          {maps.length ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setMapName(null)}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  mapName == null ? "bg-primary/10 text-primary" : ""
                }`}
              >
                All maps
              </button>
              {maps.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setMapName(name === mapName ? null : name)}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                    mapName === name ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter lumps"
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {ROLE_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRole(item.id)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    role === item.id ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-lg border bg-muted/20 text-[12px]">
            {visible.length === 0 ? (
              <p className="p-3 text-muted-foreground">No lumps match.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {visible.map((lump) => (
                  <li key={lump.index}>
                    <button
                      type="button"
                      onClick={() => setSelected(lump.index)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-primary/5 ${
                        selected === lump.index ? "bg-primary/10" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono">
                        {lump.name}
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {lump.role}
                          {lump.map && lump.role !== "map" ? ` · ${lump.map}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatBytes(lump.size)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {current && preview ? (
            <div>
              <div className="mb-1 text-xs font-medium">
                {current.name} · {preview.mode === "hex" ? "Hex" : "Text"} ·{" "}
                {formatBytes(current.size)}
              </div>
              <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-words">
                {preview.body}
              </pre>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
