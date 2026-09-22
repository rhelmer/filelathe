import { useState } from "react";
import {
  extractEntry,
  formatFromId,
  guessMimeForName,
  type ArchiveEntry,
} from "./archive";
import { getArchive, openArchiveFile } from "./archive-store";

type ArchiveBrowserProps = {
  archiveId: string;
  filename: string;
  mimeType: string;
  size: number;
  format: string;
  formatLabel: string;
  entries: ArchiveEntry[];
  peekText: string | null;
  peekXml: string | null;
  hexPreview: string;
  note: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArchiveBrowser({ props }: { props: ArchiveBrowserProps }) {
  const [error, setError] = useState<string | null>(null);
  const [openingName, setOpeningName] = useState<string | null>(null);
  const [showXml, setShowXml] = useState(false);
  const [showHex, setShowHex] = useState(false);

  const files = props.entries.filter((e) => !e.isDir);
  const dirCount = props.entries.length - files.length;

  async function openEntry(entry: ArchiveEntry) {
    setError(null);
    const buffer = getArchive(props.archiveId);
    if (!buffer) {
      setError(
        "Archive bytes are no longer in this session — re-drop the file to browse it.",
      );
      return;
    }
    setOpeningName(entry.name);
    try {
      const bytes = await extractEntry(
        new Uint8Array(buffer),
        formatFromId(props.format),
        entry.name,
      );
      if (!bytes) {
        setError(`Couldn't extract ${entry.name}.`);
        return;
      }
      const baseName = entry.name.split("/").pop() || entry.name;
      const file = new File([bytes as BlobPart], baseName, {
        type: guessMimeForName(entry.name),
      });
      openArchiveFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningName(null);
    }
  }

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
          {props.filename} · {formatBytes(props.size)} · {files.length} file
          {files.length === 1 ? "" : "s"}
          {dirCount ? ` · ${dirCount} folder${dirCount === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      {props.peekText ? (
        <div>
          <div className="mb-1 text-xs font-medium">Extracted text</div>
          <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-words">
            {props.peekText}
          </pre>
        </div>
      ) : null}

      <div>
        <div className="mb-1 text-xs font-medium">
          Entries{props.entries.length >= 200 ? " (first 200)" : ""}
        </div>
        <div className="max-h-64 overflow-auto rounded-lg border bg-muted/20 text-[12px]">
          {props.entries.length === 0 ? (
            <p className="p-3 text-muted-foreground">
              No listable entries (container may be encrypted or unsupported).
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {props.entries.map((entry) => (
                <li
                  key={entry.name}
                  className="flex items-center justify-between gap-2 px-3 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {entry.isDir ? "📁 " : "📄 "}
                    {entry.name}
                  </span>
                  {entry.isDir ? (
                    <span className="shrink-0 text-muted-foreground">—</span>
                  ) : (
                    <button
                      type="button"
                      disabled={openingName === entry.name}
                      onClick={() => void openEntry(entry)}
                      className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] hover:bg-primary/10 disabled:opacity-50"
                    >
                      {openingName === entry.name ? "Opening…" : "Open"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {props.peekXml ? (
        <div>
          <button
            type="button"
            onClick={() => setShowXml((v) => !v)}
            className="text-xs underline-offset-2 hover:underline"
          >
            {showXml ? "Hide XML sample" : "Show XML sample"}
          </button>
          {showXml ? (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">
              {props.peekXml}
            </pre>
          ) : null}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowHex((v) => !v)}
          className="text-xs underline-offset-2 hover:underline"
        >
          {showHex ? "Hide container hex" : "Show container hex"}
        </button>
        {showHex ? (
          <pre className="mt-1 max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug whitespace-pre">
            {props.hexPreview || "(empty)"}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
