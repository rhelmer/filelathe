import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { prefersTouchUi } from "./touch-ui";

const MIN_W = 280;
const MIN_H = 160;

export type WindowGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function WindowChrome({
  title,
  subtitle,
  active,
  minimized,
  maximized,
  poppedOut,
  x,
  y,
  z,
  width,
  height,
  onFocus,
  onClose,
  onMove,
  onResize,
  onMinimize,
  onToggleMaximize,
  onPopOut,
  onDock,
  children,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  minimized: boolean;
  maximized: boolean;
  poppedOut: boolean;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  onFocus: () => void;
  onClose: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onPopOut: () => void;
  onDock: () => void;
  children: ReactNode;
}) {
  const [touchUi, setTouchUi] = useState(false);
  useEffect(() => {
    const sync = () => setTouchUi(prefersTouchUi());
    sync();
    const coarse = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 767px)");
    coarse.addEventListener("change", sync);
    narrow.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      narrow.removeEventListener("change", sync);
    };
  }, []);

  const drag = useRef<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  const resize = useRef<{
    originW: number;
    originH: number;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);

  function onTitlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    if (maximized || poppedOut) {
      onFocus();
      return;
    }
    onFocus();
    // Stop page scroll while dragging on iOS Safari.
    if (event.pointerType === "touch") {
      event.preventDefault();
    }
    drag.current = {
      originX: x,
      originY: y,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onTitlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    if (event.pointerType === "touch") {
      event.preventDefault();
    }
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    // Keep enough of the title bar on-screen to grab again.
    const maxX = Math.max(8, window.innerWidth - 72);
    const maxY = Math.max(8, window.innerHeight - 56);
    onMove(
      clamp(drag.current.originX + dx, 8, maxX),
      clamp(drag.current.originY + dy, 8, maxY),
    );
  }

  function onTitlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (maximized || minimized || poppedOut) return;
    event.stopPropagation();
    if (event.pointerType === "touch") {
      event.preventDefault();
    }
    onFocus();
    resize.current = {
      originW: width,
      originH: height,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resize.current || resize.current.pointerId !== event.pointerId) return;
    if (event.pointerType === "touch") {
      event.preventDefault();
    }
    const dx = event.clientX - resize.current.startX;
    const dy = event.clientY - resize.current.startY;
    const maxW = Math.max(MIN_W, window.innerWidth - x - 8);
    const maxH = Math.max(MIN_H, window.innerHeight - y - 8);
    onResize(
      clamp(resize.current.originW + dx, MIN_W, maxW),
      clamp(resize.current.originH + dy, MIN_H, maxH),
    );
  }

  function onResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resize.current || resize.current.pointerId !== event.pointerId) return;
    resize.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  const chromeButton = touchUi
    ? "inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-2 text-base text-muted-foreground hover:bg-background hover:text-foreground"
    : "rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground";

  if (poppedOut) {
    return (
      <div
        data-filelathe-window=""
        data-window-title={title}
        className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border bg-card shadow-xl ${
          active ? "ring-2 ring-primary/40" : ""
        }`}
        style={{ left: x, top: y, zIndex: z, width: Math.min(width, 360) }}
        onMouseDown={onFocus}
      >
        <div
          className={`flex items-center gap-2 border-b bg-muted/50 px-3 ${
            touchUi ? "min-h-12 py-2" : "py-2"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-muted-foreground">
              Open in another tab
            </div>
          </div>
          <button
            type="button"
            aria-label="Focus pop-out"
            className={chromeButton}
            onClick={onPopOut}
            title="Focus pop-out window"
          >
            Focus
          </button>
          <button
            type="button"
            aria-label="Dock window"
            className={chromeButton}
            onClick={onDock}
            title="Dock back into this page"
          >
            Dock
          </button>
          <button
            type="button"
            aria-label="Close"
            className={chromeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // Keep one tree when minimized so media elements don't remount/pause.
  // Park off-screen at real size — collapsing to 1×1 often pauses playback.
  return (
    <div
      data-filelathe-window=""
      data-window-title={title}
      data-minimized={minimized ? "" : undefined}
      className={
        minimized
          ? "pointer-events-none fixed flex flex-col overflow-hidden opacity-0"
          : `pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border bg-card shadow-xl ${
              active ? "ring-2 ring-primary/40" : ""
            }`
      }
      style={
        minimized
          ? {
              left: -10_000,
              top: 0,
              zIndex: 0,
              width,
              height,
            }
          : {
              left: x,
              top: y,
              zIndex: z,
              width,
              height,
            }
      }
      aria-hidden={minimized || undefined}
      onMouseDown={minimized ? undefined : onFocus}
    >
      <div
        className={`flex touch-none select-none items-center gap-1 border-b bg-muted/50 active:cursor-grabbing ${
          minimized ? "hidden" : ""
        } ${
          touchUi
            ? "min-h-12 cursor-grab gap-0.5 px-1 py-1.5"
            : "cursor-grab px-2 py-2"
        }`}
        style={{ touchAction: "none" }}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
      >
        {touchUi ? (
          <div
            className="flex h-10 w-8 shrink-0 flex-col items-center justify-center gap-1 text-muted-foreground"
            aria-hidden
          >
            <span className="block h-0.5 w-4 rounded-full bg-current opacity-60" />
            <span className="block h-0.5 w-4 rounded-full bg-current opacity-60" />
            <span className="block h-0.5 w-4 rounded-full bg-current opacity-60" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {touchUi ? "Drag here to move" : subtitle}
          </div>
        </div>
        {touchUi ? (
          <button
            type="button"
            aria-label={maximized ? "Restore" : "Expand"}
            className={chromeButton}
            onClick={onToggleMaximize}
            title={maximized ? "Restore" : "Expand to fill screen"}
          >
            {maximized ? "❐" : "□"}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Pop out"
            className={chromeButton}
            onClick={onPopOut}
            title="Open in a standalone window"
          >
            ↗
          </button>
        )}
        <button
          type="button"
          aria-label="Minimize"
          className={chromeButton}
          onClick={onMinimize}
          title="Minimize to dock"
        >
          –
        </button>
        {!touchUi ? (
          <button
            type="button"
            aria-label={maximized ? "Restore" : "Maximize"}
            className={chromeButton}
            onClick={onToggleMaximize}
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? "❐" : "□"}
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Close"
          className={chromeButton}
          onClick={onClose}
          title="Close"
        >
          ×
        </button>
      </div>
      <div
        className={`relative min-h-0 flex-1 overflow-auto ${
          touchUi ? "p-3 text-base" : "p-4"
        }`}
      >
        {children}
      </div>
      {!minimized && !maximized ? (
        <div
          className={`absolute bottom-0 right-0 cursor-se-resize touch-none ${
            touchUi ? "h-11 w-11" : "h-4 w-4"
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          aria-hidden
        >
          <div
            className={`absolute border-b-2 border-r-2 border-muted-foreground/60 ${
              touchUi
                ? "bottom-2 right-2 h-3.5 w-3.5"
                : "bottom-1 right-1 h-2 w-2"
            }`}
          />
        </div>
      ) : null}
    </div>
  );
}
