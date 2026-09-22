import { useMemo, useRef, useState } from "react";
import {
  PresentationViewer,
  type PresentationViewerHandle,
} from "pptx-wasm/react";
import wasmUrl from "pptx-wasm/wasm?url";

type SlideViewerProps = {
  src: string;
  title: string | null;
  filename: string;
  format: string;
  note: string | null;
};

export function SlideViewer({ props }: { props: SlideViewerProps }) {
  const viewer = useRef<PresentationViewerHandle>(null);
  const [slide, setSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const label = useMemo(() => {
    if (!slideCount) return props.format.toUpperCase();
    return `${props.format.toUpperCase()} · ${slide + 1} / ${slideCount}`;
  }, [props.format, slide, slideCount]);

  function go(delta: number) {
    const handle = viewer.current;
    if (!handle || !slideCount) return;
    const next = Math.min(Math.max(0, slide + delta), slideCount - 1);
    handle.goTo(next);
    setSlide(next);
  }

  return (
    <div className="space-y-3">
      {props.note ? (
        <p className="text-xs text-muted-foreground">{props.note}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
          {label}
        </span>
        <span className="truncate">{props.filename}</span>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-neutral-950">
        <PresentationViewer
          ref={viewer}
          src={props.src}
          wasm={wasmUrl}
          width="100%"
          height={420}
          fit="contain"
          keyboard
          slide={slide}
          onLoad={(info) => {
            setSlideCount(info.slideCount);
            setError(null);
          }}
          onError={(err) => setError(err.message)}
          onSlideChange={(index) => setSlide(index)}
          loading={
            <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
              Rendering slides…
            </div>
          }
          renderError={(err) => (
            <div className="flex h-[420px] items-center justify-center p-4 text-sm text-destructive">
              {err.message}
            </div>
          )}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-40"
          disabled={slide <= 0}
          onClick={() => go(-1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-40"
          disabled={!slideCount || slide >= slideCount - 1}
          onClick={() => go(1)}
        >
          Next
        </button>
        {props.title ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {props.title}
          </span>
        ) : null}
      </div>
    </div>
  );
}
