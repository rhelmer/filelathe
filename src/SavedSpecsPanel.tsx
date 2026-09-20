import { useCallback, useEffect, useState } from "react";
import {
  downloadContribJson,
  proposeSpecOnGithub,
  CONTRIB_REPO,
} from "./github-contrib";
import {
  clearSandboxViewers,
  deleteSandboxRecord,
  listSandboxViewers,
  type SandboxRecord,
} from "./sandbox-store";
import { useToast } from "./toast";

function dedupeHaikuRecords(records: SandboxRecord[]): SandboxRecord[] {
  const haiku = records.filter((r) => r.inventedBy === "haiku");
  const content = haiku.filter((r) => r.scope === "content");
  const contentExts = new Set(
    content.map((r) => `${r.extension}:${r.mimeType}`),
  );
  const extensionOnly = haiku.filter(
    (r) =>
      r.scope === "extension" &&
      !contentExts.has(`${r.extension}:${r.mimeType}`),
  );
  return [...content, ...extensionOnly].sort((a, b) => b.savedAt - a.savedAt);
}

function formatWhen(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString();
  }
}

export function SavedSpecsPanel({
  refreshToken = 0,
}: {
  /** Bump after a successful invent save so the list refreshes. */
  refreshToken?: number;
}) {
  const { toast } = useToast();
  const [records, setRecords] = useState<SandboxRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    const all = await listSandboxViewers();
    setRecords(dedupeHaikuRecords(all));
  }, []);

  useEffect(() => {
    void reload().catch((error) => {
      toast({
        title: "Could not load saved mini-apps",
        description: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
    });
  }, [reload, refreshToken, toast]);

  async function propose(record: SandboxRecord) {
    setBusyKey(record.key);
    try {
      const result = await proposeSpecOnGithub(record);
      if (!result.copied) {
        downloadContribJson(record);
        toast({
          title: "Download ready — then paste on GitHub",
          description: `Clipboard blocked. Opened ${result.filename} as a download; copy its contents into the GitHub editor. Opening GitHub in a moment…`,
          variant: "warning",
          durationMs: 16_000,
        });
      } else {
        toast({
          title: "Mini-app copied to clipboard",
          description:
            "File contents were redacted. Opening GitHub in a moment — paste (⌘V / Ctrl+V), commit on a new branch, then open a pull request.",
          variant: "success",
          durationMs: 16_000,
        });
      }
      // Let the toast paint and be read before the new tab steals focus.
      await new Promise((r) => window.setTimeout(r, 2200));
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "Could not open GitHub",
        description: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-card/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-left text-sm font-medium underline-offset-2 hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show"} saved mini-apps
          <span className="ml-2 font-normal text-muted-foreground">
            ({records.length})
          </span>
        </button>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="underline text-muted-foreground"
            onClick={() => void reload()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="underline text-muted-foreground"
            disabled={records.length === 0}
            onClick={() => {
              void clearSandboxViewers()
                .then(() => {
                  setRecords([]);
                  toast({
                    title: "Cleared saved mini-apps",
                    variant: "info",
                  });
                })
                .catch((error) =>
                  toast({
                    title: "Clear failed",
                    description:
                      error instanceof Error ? error.message : String(error),
                    variant: "error",
                  }),
                );
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Haiku mini-apps for unknown files stay in this browser. Propose one
            to{" "}
            <a
              className="underline"
              href={`https://github.com/${CONTRIB_REPO}`}
              target="_blank"
              rel="noreferrer"
            >
              {CONTRIB_REPO}
            </a>{" "}
            — GitHub opens a new file under{" "}
            <code className="text-[11px]">contrib/invented/</code>. Propose PR /
            Download strip your file contents (samples, hex, Textarea bodies) and
            anonymize the filename before copy — only the mini-app structure is
            shared. Paste into the editor, then commit / PR (GitHub will fork if
            needed).
          </p>

          {records.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No saved mini-apps yet. Drop an unknown file and invent one.
            </p>
          ) : (
            <ul className="space-y-2">
              {records.map((record) => {
                const isOpen = expanded === record.key;
                const elementCount = Object.keys(
                  record.spec.elements ?? {},
                ).length;
                return (
                  <li
                    key={record.key}
                    className="rounded-xl border bg-background/80 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          .{record.extension || "bin"}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {record.filenameHint}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {record.scope} · {record.mimeType} · {elementCount}{" "}
                          elements · {formatWhen(record.savedAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="rounded-full border px-2.5 py-1 text-[11px]"
                          onClick={() =>
                            setExpanded((k) =>
                              k === record.key ? null : record.key,
                            )
                          }
                        >
                          {isOpen ? "Hide JSON" : "Raw JSON"}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border px-2.5 py-1 text-[11px]"
                          onClick={() => downloadContribJson(record)}
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-primary px-2.5 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
                          disabled={busyKey === record.key}
                          onClick={() => void propose(record)}
                        >
                          {busyKey === record.key
                            ? "Opening…"
                            : "Propose PR"}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground"
                          onClick={() => {
                            void deleteSandboxRecord(record.key)
                              .then(() => reload())
                              .catch((error) =>
                                toast({
                                  title: "Delete failed",
                                  description:
                                    error instanceof Error
                                      ? error.message
                                      : String(error),
                                  variant: "error",
                                }),
                              );
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {isOpen ? (
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-2 font-mono text-[10px] leading-snug">
                        {JSON.stringify(record.spec, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
