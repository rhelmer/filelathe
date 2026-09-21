import { useEffect, useMemo, useState } from "react";
import type { Spec } from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { extensionFromFilename, track } from "./analytics";
import { readApiError, toastMessageForApiError } from "./api-error";
import { InventingAnimation } from "./InventingAnimation";
import { hydrateInventedSpec } from "./invent-hydrate";
import type { registry as RegistryType } from "./registry";
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

function parseSpecJson(specJson: string): Spec | null {
  try {
    const parsed = JSON.parse(specJson) as Spec;
    if (!parsed?.root || !parsed.elements) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function InventedViewer({
  props,
}: {
  props: {
    specJson: string;
    note: string | null;
    prompt: string;
    invent: InventPayload;
  };
}) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(props.prompt || "");
  const [specJson, setSpecJson] = useState(props.specJson || "");
  const [note, setNote] = useState(props.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [registry, setRegistry] = useState<typeof RegistryType | null>(null);

  useEffect(() => {
    setPrompt(props.prompt || "");
    setSpecJson(props.specJson || "");
    setNote(props.note);
  }, [props.prompt, props.specJson, props.note]);

  useEffect(() => {
    let cancelled = false;
    void import("./registry").then((mod) => {
      if (!cancelled) setRegistry(mod.registry);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const spec = useMemo(() => {
    const parsed = parseSpecJson(specJson);
    if (!parsed) return null;
    return hydrateInventedSpec(parsed, {
      title: props.invent.title,
      filename: props.invent.filename,
      mimeType: props.invent.mimeType,
      size: props.invent.size,
      sampleText: props.invent.sampleText,
      hexPreview: props.invent.hexPreview,
      sourceUrl: props.invent.sourceUrl,
    });
  }, [specJson, props.invent]);

  async function regenerate() {
    track("invent_regenerate", {
      ext: extensionFromFilename(props.invent.filename),
    });
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/invent-viewer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...props.invent,
          prompt,
        }),
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
      setSpecJson(JSON.stringify(data.spec));
      if (data.prompt) setPrompt(data.prompt);
      setNote(
        data.source === "haiku"
          ? "Haiku invented this mini-app from the catalog."
          : data.reason
            ? `Fallback mini-app (${data.reason}).`
            : "Fallback mini-app (Haiku unavailable or invalid output).",
      );
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

  return (
    <div className="space-y-3">
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}

      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs font-medium underline-offset-2 hover:underline"
            onClick={() => setPromptOpen((value) => !value)}
          >
            {promptOpen ? "Hide" : "Show"} invent prompt
          </button>
          <button
            type="button"
            className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
            disabled={busy || !prompt.trim()}
            onClick={() => void regenerate()}
          >
            {busy ? "Inventing…" : "Regenerate mini-app"}
          </button>
        </div>
        {promptOpen ? (
          <textarea
            className="h-48 w-full resize-y rounded-md border bg-background p-2 font-mono text-[11px] leading-snug"
            value={prompt}
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setPrompt(event.target.value)}
          />
        ) : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>

      <div className="relative min-h-[120px]">
        {registry && spec ? (
          <div className={`transition-opacity ${busy ? "opacity-30" : ""}`}>
            <JSONUIProvider
              key={specJson.slice(0, 64) + ":" + spec.root}
              registry={registry}
              initialState={spec.state ?? {}}
            >
              <Renderer spec={spec} registry={registry} />
            </JSONUIProvider>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {registry ? "Invalid mini-app JSON." : "Loading renderer…"}
          </p>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-[2px]">
            <InventingAnimation label="Haiku is inventing a mini-app…" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
