import { useEffect, useRef, useState, type PointerEvent } from "react";

const COLORS = [
  "#0f172a",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ffffff",
];

export function PixelEditor({
  props,
}: {
  props: {
    src: string;
    title: string | null;
  };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#ef4444");
  const [brush, setBrush] = useState(4);
  const [pixelated, setPixelated] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      const max = 480;
      const scale = Math.min(1, max / Math.max(image.width, image.height, 1));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      setReady(true);
    };
    image.onerror = () => setReady(false);
    image.src = props.src;
    return () => {
      cancelled = true;
    };
  }, [props.src]);

  function paintAt(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, brush / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${props.title ?? "pixel-edit"}.png`;
    anchor.click();
  }

  function clearToImage() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = props.src;
  }

  return (
    <div className="space-y-3" data-pixel-editor="">
      {props.title ? (
        <div className="text-sm font-medium">{props.title}</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Color ${swatch}`}
            className={`h-6 w-6 rounded-full border ${
              color === swatch ? "ring-2 ring-primary ring-offset-1" : ""
            }`}
            style={{ backgroundColor: swatch }}
            onClick={() => setColor(swatch)}
          />
        ))}
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Brush
          <input
            type="range"
            min={1}
            max={32}
            value={brush}
            onChange={(event) => setBrush(Number(event.target.value))}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={pixelated}
            onChange={(event) => setPixelated(event.target.checked)}
          />
          Pixelated
        </label>
        <button
          type="button"
          className="rounded-full border px-2 py-0.5 text-xs"
          onClick={clearToImage}
        >
          Reset
        </button>
        <button
          type="button"
          className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"
          onClick={download}
          disabled={!ready}
        >
          Download PNG
        </button>
      </div>
      <div className="overflow-auto rounded-lg border bg-muted/30 p-2">
        <canvas
          ref={canvasRef}
          data-pixel-canvas=""
          className="mx-auto max-w-full touch-none"
          style={{
            imageRendering: pixelated ? "pixelated" : "auto",
            cursor: "crosshair",
            width: "100%",
            height: "auto",
          }}
          onPointerDown={(event) => {
            drawing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            paintAt(event);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            paintAt(event);
          }}
          onPointerUp={(event) => {
            drawing.current = false;
            try {
              event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
              // ignore
            }
          }}
          onPointerCancel={() => {
            drawing.current = false;
          }}
        />
      </div>
      {!ready ? (
        <p className="text-xs text-muted-foreground">Loading image…</p>
      ) : null}
    </div>
  );
}
