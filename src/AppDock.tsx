/** Always-visible taskbar: undo/redo + a tab for every open window. */

export type DockTile = {
  id: string;
  title: string;
  subtitle: string;
  kindLabel: string;
  minimized: boolean;
  active: boolean;
};

export function AppDock({
  tiles,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
  onSelect,
}: {
  tiles: DockTile[];
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
  onUndo: () => void;
  onRedo: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3"
      role="toolbar"
      aria-label="Taskbar"
    >
      <div className="pointer-events-auto flex max-w-[min(100%,56rem)] items-center gap-2 rounded-2xl border border-border/80 bg-card/95 px-2 py-2 shadow-lg backdrop-blur-md">
        <div className="flex shrink-0 items-center gap-1 border-r border-border/60 pr-2">
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-35 hover:bg-muted"
            disabled={!canUndo}
            onClick={onUndo}
            title={undoLabel}
            aria-label={undoLabel}
          >
            Undo
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-35 hover:bg-muted"
            disabled={!canRedo}
            onClick={onRedo}
            title={redoLabel}
            aria-label={redoLabel}
          >
            Redo
          </button>
        </div>

        {tiles.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            Open a file — each window gets a tab here
          </p>
        ) : (
          <ul className="flex min-w-0 list-none items-center gap-1.5 overflow-x-auto">
            {tiles.map((tile) => {
              const label = tile.minimized
                ? `Restore ${tile.title}`
                : `Focus ${tile.title}`;
              return (
                <li key={tile.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={tile.active && !tile.minimized ? "true" : undefined}
                    aria-label={label}
                    className={`flex max-w-[11rem] flex-col rounded-xl border px-3 py-1.5 text-left transition-colors ${
                      tile.active && !tile.minimized
                        ? "border-primary/40 bg-primary/10"
                        : tile.minimized
                          ? "border-dashed border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground"
                          : "border-transparent bg-muted/60 hover:border-primary/30 hover:bg-muted"
                    }`}
                    onClick={() => onSelect(tile.id)}
                    title={label}
                  >
                    <span className="truncate text-xs font-medium">
                      {tile.title}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {tile.minimized
                        ? `${tile.kindLabel} · minimized`
                        : tile.kindLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
