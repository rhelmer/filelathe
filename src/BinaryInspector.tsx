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
      <div className="text-xs text-muted-foreground">
        {props.filename} · {props.mimeType} · {props.size} bytes
      </div>
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
