import { useMemo, useState } from "react";
import { rewriteHtmlForSnapshot } from "./resource-utils";

export function WebPageViewer({
  props,
}: {
  props: {
    html: string;
    sourceUrl: string | null;
    title: string | null;
  };
}) {
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const label = props.title?.trim() || "Page preview";
  const previewHtml = useMemo(
    () => rewriteHtmlForSnapshot(props.html, props.sourceUrl),
    [props.html, props.sourceUrl],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3"
      data-webpage-viewer=""
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border bg-muted/40 p-0.5">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${
              tab === "preview"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${
              tab === "source"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => setTab("source")}
          >
            Source
          </button>
        </div>
        {props.sourceUrl ? (
          <a
            href={props.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Open original
          </a>
        ) : null}
      </div>

      {tab === "preview" ? (
        <iframe
          title={label}
          className="min-h-[320px] w-full flex-1 rounded-lg border bg-white h-[min(78dvh,1400px)]"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          srcDoc={previewHtml}
          referrerPolicy="no-referrer"
        />
      ) : (
        <pre className="min-h-[320px] max-h-[min(78dvh,1400px)] flex-1 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug break-all whitespace-pre-wrap">
          {props.html || "(empty)"}
        </pre>
      )}

      <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">
        Snapshot resolves relative assets against the original site. In-preview
        links browse here; Open original for the live page.
      </p>
    </div>
  );
}
