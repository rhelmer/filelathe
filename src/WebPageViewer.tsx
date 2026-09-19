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
    <div className="space-y-3">
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
          className="h-[min(480px,55vh)] w-full rounded-lg border bg-white"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          srcDoc={previewHtml}
          referrerPolicy="no-referrer"
        />
      ) : (
        <pre className="max-h-[min(480px,55vh)] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug break-all whitespace-pre-wrap">
          {props.html || "(empty)"}
        </pre>
      )}

      <p className="text-xs text-muted-foreground">
        Snapshot with a base URL so relative images/CSS/links resolve against
        the original site. Links open in a new tab. JS-injected assets may still
        be missing — use Open original for the live page.
      </p>
    </div>
  );
}
