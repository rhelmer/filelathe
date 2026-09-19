import {
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const MIN_W = 280;
const MIN_H = 160;

export type WindowGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  const drag = useRef<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const resize = useRef<{
    originW: number;
    originH: number;
    startX: number;
    startY: number;
  } | null>(null);

  function onTitlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    if (maximized || poppedOut) {
      onFocus();
      return;
    }
    onFocus();
    drag.current = {
      originX: x,
      originY: y,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onTitlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    onMove(
      Math.max(8, drag.current.originX + dx),
      Math.max(8, drag.current.originY + dy),
    );
  }

  function onTitlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
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
    onFocus();
    resize.current = {
      originW: width,
      originH: height,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resize.current) return;
    const dx = event.clientX - resize.current.startX;
    const dy = event.clientY - resize.current.startY;
    onResize(
      Math.max(MIN_W, resize.current.originW + dx),
      Math.max(MIN_H, resize.current.originH + dy),
    );
  }

  function onResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resize.current) return;
    resize.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  const chromeButton =
    "rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground";

  if (poppedOut) {
    return (
      <div
        className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border bg-card shadow-xl ${
          active ? "ring-2 ring-primary/40" : ""
        }`}
        style={{ left: x, top: y, zIndex: z, width: Math.min(width, 360) }}
        onMouseDown={onFocus}
      >
        <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-muted-foreground">
              Popped out to a separate window
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

  return (
    <div
      className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border bg-card shadow-xl ${
        active ? "ring-2 ring-primary/40" : ""
      }`}
      style={{
        left: x,
        top: y,
        zIndex: z,
        width,
        height: minimized ? undefined : height,
      }}
      onMouseDown={onFocus}
    >
      <div
        className="flex cursor-grab items-center gap-1 border-b bg-muted/50 px-2 py-2 active:cursor-grabbing"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
      >
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        </div>
        <button
          type="button"
          aria-label="Pop out"
          className={chromeButton}
          onClick={onPopOut}
          title="Open in a standalone window"
        >
          ↗
        </button>
        <button
          type="button"
          aria-label={minimized ? "Restore" : "Minimize"}
          className={chromeButton}
          onClick={onMinimize}
          title={minimized ? "Restore" : "Minimize"}
        >
          {minimized ? "▢" : "–"}
        </button>
        <button
          type="button"
          aria-label={maximized ? "Restore" : "Maximize"}
          className={chromeButton}
          onClick={onToggleMaximize}
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? "❐" : "□"}
        </button>
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
      {!minimized ? (
        <div className="relative min-h-0 flex-1 overflow-auto p-4">
          {children}
        </div>
      ) : null}
      {!minimized && !maximized ? (
        <div
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          aria-hidden
        >
          <div className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-muted-foreground/50" />
        </div>
      ) : null}
    </div>
  );
}
