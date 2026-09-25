import { useState } from "react";
import type { Spec } from "@json-render/core";
import { extensionFromFilename, track } from "./analytics";
import { readApiError, toastMessageForApiError } from "./api-error";
import { InventingAnimation } from "./InventingAnimation";
import { InventedViewer } from "./InventedViewer";
import { useToast } from "./toast";

type InventPayload = {
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  sampleText: string | null;
  hexPreview: string;
  sourceUrl: string | null;
};

export function BinaryInspector({
  props,
}: {
  props: {
    filename: string;
    mimeType: string;
    size: number;
    hexPreview: string;
    sampleText: string | null;
    note: string | null;
    playerHint: string | null;
  };
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invented, setInvented] = useState<{
    specJson: string;
    note: string | null;
    prompt: string;
    invent: InventPayload;
  } | null>(null);

  const canInvent = !props.playerHint;
  const inventPayload: InventPayload = {
    title: props.filename,
    filename: props.filename,
    mimeType: props.mimeType,
    size: props.size,
    sampleText: props.sampleText,
    hexPreview: props.hexPreview,
    sourceUrl: null,
  };

  async function inventMiniApp() {
    track("invent_from_inspector", {
      ext: extensionFromFilename(props.filename),
    });
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/invent-viewer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inventPayload),
      });
      if (!response.ok) throw await readApiError(response);
      const data = (await response.json()) as {
        spec?: Spec;
        source?: "haiku" | "fallback";
        prompt?: string;
        reason?: string;
        modelUnavailable?: boolean;
      };
      if (!data.spec) throw new Error("Invent returned no Spec.");
      setInvented({
        specJson: JSON.stringify(data.spec),
        prompt: data.prompt ?? "",
        invent: inventPayload,
        note:
          data.source === "haiku"
            ? "Haiku invented this mini-app from the catalog."
            : data.reason
              ? `Fallback mini-app (${data.reason}).`
              : "Fallback mini-app (Haiku unavailable or invalid output).",
      });
      if (data.modelUnavailable) {
        toast({
          title: "Haiku unavailable",
          description:
            data.reason ??
            "Showing a fallback mini-app — check ANTHROPIC_API_KEY.",
          variant: "warning",
          durationMs: 8000,
        });
      }
    } catch (err) {
      const msg = toastMessageForApiError(err);
      toast({
        title: msg.title,
        description: msg.description,
        variant: msg.variant,
        durationMs: 10_000,
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (invented) {
    // InventedViewer already offers Inspect binary ↔ Back to mini-app.
    return <InventedViewer props={invented} />;
  }

  return (
    <div className="space-y-3">
      {props.note ? (
        <p className="text-xs text-muted-foreground">{props.note}</p>
      ) : null}
      {props.playerHint ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <div className="font-medium text-amber-900 dark:text-amber-100">
            Emulator not wired yet
          </div>
          <p className="mt-1 text-muted-foreground">{props.playerHint}</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {props.filename} · {props.mimeType} · {props.size} bytes
        </div>
        {canInvent ? (
          <button
            type="button"
            className="shrink-0 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => void inventMiniApp()}
          >
            {busy ? "Inventing…" : "Invent mini-app"}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {busy ? (
        <div className="flex justify-center py-6">
          <InventingAnimation label="Haiku is inventing a mini-app…" />
        </div>
      ) : null}
      {props.sampleText ? (
        <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">
          {props.sampleText}
        </pre>
      ) : null}
      <div>
        <div className="mb-1 text-xs font-medium">Hex preview</div>
        <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-snug whitespace-pre">
          {props.hexPreview || "(empty)"}
        </pre>
      </div>
    </div>
  );
}
