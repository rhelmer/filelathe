import { useEffect, useId, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Spec } from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import {
  classifyOpenError,
  extensionFromFilename,
  track,
  type FileOpenSource,
  type InventOutcome,
} from "./analytics";
import { readApiError, toastMessageForApiError } from "./api-error";
import { AppDock } from "./AppDock";
import {
  labelForKind,
  loadDroppedFile,
  revokeLoadedFile,
  type LoadedFile,
} from "./files";
import { InventingAnimation } from "./InventingAnimation";
import { buildInventPrompt } from "./invent-prompt";
import { registry } from "./registry";
import {
  lookupSandboxViewer,
  saveSandboxViewer,
} from "./sandbox-store";
import {
  buildSessionSnapshot,
  loadSession,
  reviveWindow,
  saveSession,
} from "./session-store";
import { clearMediaPlayback, setMediaPlayback } from "./media-playback";
import { MediaPlaybackProvider } from "./media-playback-context";
import { getModule } from "./module-store";
import { getArchive, setArchiveOpener } from "./archive-store";
import { matchPlayers, plannedPlayer } from "./players";
import { SavedSpecsPanel } from "./SavedSpecsPanel";
import { useToast, ToastProvider } from "./toast";
import { FilelatheLogo } from "./FilelatheLogo";
import { prefersTouchUi } from "./touch-ui";
import { WindowChrome, type WindowGeometry } from "./WindowChrome";

type ComposeResponse = {
  finalSpec: Spec | null;
  stopReason: string | null;
  events: unknown[];
  prompt?: string;
  kind?: string;
  file?: LoadedFile;
  route?: string;
  error?: string;
  warnings?: string[];
};

type WindowItem = {
  id: string;
  file: LoadedFile;
  spec: Spec;
  prompt: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  poppedOut: boolean;
  restore: WindowGeometry | null;
};

type PopoutEntry = {
  popup: Window;
  root: Root;
  timer: ReturnType<typeof setInterval>;
};

/** Structural workspace edits only (open / close) — not move / min / max. */
type HistoryEntry = {
  kind: "open" | "close";
  window: WindowItem;
  previousActiveId: string | null;
};

const DEFAULT_W = 560;
const DEFAULT_H = 520;
const MAX_HISTORY = 40;

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function historyLabel(entry: HistoryEntry | undefined, action: "Undo" | "Redo") {
  if (!entry) return action;
  const name = entry.window.file.filename;
  if (entry.kind === "close") {
    return action === "Undo" ? `Undo close · ${name}` : `Redo close · ${name}`;
  }
  return action === "Undo" ? `Undo open · ${name}` : `Redo open · ${name}`;
}

function nextOffset(count: number) {
  const step = 28;
  return {
    x: 48 + (count % 8) * step,
    y: 120 + (count % 8) * step,
  };
}

function copyStylesTo(targetDoc: Document) {
  for (const node of document.querySelectorAll(
    'link[rel="stylesheet"], style',
  )) {
    targetDoc.head.appendChild(node.cloneNode(true));
  }
}

function WindowBody({
  spec,
  playbackKey,
}: {
  spec: Spec;
  playbackKey: string;
}) {
  return (
    <MediaPlaybackProvider playbackKey={playbackKey}>
      <div data-filelathe-playback={playbackKey}>
        <JSONUIProvider registry={registry} initialState={spec.state ?? {}}>
          <Renderer spec={spec} registry={registry} />
        </JSONUIProvider>
      </div>
    </MediaPlaybackProvider>
  );
}

/** Snapshot live media elements into the playback store before remounting. */
function flushPlaybackFromDom(playbackKey: string, doc: Document = document) {
  const root = doc.querySelector(`[data-filelathe-playback="${playbackKey}"]`);
  if (!root) return;
  const media = root.querySelector("audio, video") as HTMLMediaElement | null;
  if (!media) return;
  setMediaPlayback(playbackKey, {
    currentTime: media.currentTime,
    playing: !media.paused && !media.ended,
  });
}

export function App() {
  const idPrefix = useId();
  const { toast } = useToast();
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const windowsRef = useRef(windows);
  windowsRef.current = windows;
  const popoutsRef = useRef(new Map<string, PopoutEntry>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zTop, setZTop] = useState(10);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;
  const redoStackRef = useRef(redoStack);
  redoStackRef.current = redoStack;
  const undoWorkspaceRef = useRef<() => void>(() => {});
  const redoWorkspaceRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState(
    "Drop a file — a new window opens for each one.",
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [specsRefresh, setSpecsRefresh] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const zTopRef = useRef(zTop);
  zTopRef.current = zTop;

  function setBusyFlag(next: boolean) {
    busyRef.current = next;
    setBusy(next);
  }

  function toastApiFailure(error: unknown) {
    const msg = toastMessageForApiError(error);
    toast({
      title: msg.title,
      description: msg.description,
      variant: msg.variant,
      durationMs:
        msg.title.toLowerCase().includes("rate") || msg.variant === "error"
          ? 12_000
          : 7000,
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await loadSession();
        if (cancelled) return;
        if (snap?.windows.length) {
          const revived = snap.windows.map((w) => {
            const live = reviveWindow(w);
            // Never restore maximized — it covers Choose file / drop zone
            if (live.maximized) {
              return {
                ...live,
                maximized: false,
                ...(live.restore
                  ? {
                      x: live.restore.x,
                      y: live.restore.y,
                      width: live.restore.width,
                      height: live.restore.height,
                      restore: null,
                    }
                  : {}),
              };
            }
            return live;
          });
          const usable = revived.filter((w) => {
            if (w.file.kind === "tracker")
              return getModule(w.file.moduleId) != null;
            if (w.file.kind === "archive")
              return getArchive(w.file.archiveId) != null;
            if (w.file.kind === "wad") return getArchive(w.file.wadId) != null;
            return true;
          });
          const dropped = revived.length - usable.length;
          setWindows(usable);
          setActiveId(
            snap.activeId && usable.some((w) => w.id === snap.activeId)
              ? snap.activeId
              : (usable.at(-1)?.id ?? null),
          );
          setZTop(
            usable.length
              ? Math.max(snap.zTop, ...usable.map((w) => w.z), 10)
              : snap.zTop,
          );
          if (usable.length) {
            setStatus(
              `Restored ${usable.length} window${usable.length === 1 ? "" : "s"} from this browser${
                dropped ? ` (${dropped} tracker${dropped === 1 ? "" : "s"} needed a re-drop)` : ""
              }.`,
            );
          } else if (dropped) {
            setStatus(
              "Saved tracker windows need a re-drop — module bytes were missing from the session.",
            );
          }
        }
      } catch (error) {
        console.warn("[session] restore failed:", error);
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const snapshot = await buildSessionSnapshot({
            windows: windowsRef.current,
            activeId: activeIdRef.current,
            zTop: zTopRef.current,
            getModuleBytes: getModule,
            getArchiveBytes: getArchive,
          });
          if (!cancelled) await saveSession(snapshot);
        } catch (error) {
          console.warn("[session] save failed:", error);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [windows, activeId, zTop, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    const flush = () => {
      void buildSessionSnapshot({
        windows: windowsRef.current,
        activeId: activeIdRef.current,
        zTop: zTopRef.current,
        getModuleBytes: getModule,
        getArchiveBytes: getArchive,
      })
        .then(saveSession)
        .catch((error) => console.warn("[session] flush failed:", error));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionReady]);

  useEffect(() => {
    return () => {
      for (const item of windowsRef.current) revokeLoadedFile(item.file);
      for (const entry of undoStackRef.current) {
        if (entry.kind === "close") revokeLoadedFile(entry.window.file);
      }
      for (const entry of redoStackRef.current) {
        revokeLoadedFile(entry.window.file);
      }
      for (const entry of popoutsRef.current.values()) {
        clearInterval(entry.timer);
        try {
          entry.root.unmount();
        } catch {
          // ignore
        }
        if (!entry.popup.closed) entry.popup.close();
      }
      popoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "z") return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) redoWorkspaceRef.current();
      else undoWorkspaceRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function focusWindow(id: string) {
    setActiveId(id);
    setZTop((current) => {
      const next = current + 1;
      setWindows((items) =>
        items.map((item) => (item.id === id ? { ...item, z: next } : item)),
      );
      return next;
    });
  }

  function closePopout(id: string) {
    const entry = popoutsRef.current.get(id);
    if (!entry) return;
    clearInterval(entry.timer);
    try {
      entry.root.unmount();
    } catch {
      // ignore
    }
    if (!entry.popup.closed) entry.popup.close();
    popoutsRef.current.delete(id);
  }

  /** Release blob URLs / modules for a window that will never return. */
  function disposeHeldWindow(item: WindowItem) {
    closePopout(item.id);
    clearMediaPlayback(item.id);
    revokeLoadedFile(item.file);
  }

  function disposeHistoryEntry(entry: HistoryEntry) {
    // Only revoke when this entry is the sole owner (window not on the desk).
    // After undo-close the same object is live again and also sits on redo —
    // clearing redo must not revoke it.
    const stillLive = windowsRef.current.some((w) => w.id === entry.window.id);
    if (!stillLive) disposeHeldWindow(entry.window);
  }

  function clearRedoStack() {
    const doomed = redoStackRef.current;
    if (!doomed.length) return;
    for (const entry of doomed) disposeHistoryEntry(entry);
    setRedoStack([]);
  }

  function pushUndo(entry: HistoryEntry) {
    clearRedoStack();
    setUndoStack((stack) => {
      const next = [...stack, entry];
      if (next.length <= MAX_HISTORY) return next;
      const overflow = next.slice(0, next.length - MAX_HISTORY);
      for (const old of overflow) disposeHistoryEntry(old);
      return next.slice(-MAX_HISTORY);
    });
  }

  function removeWindowFromDesk(id: string, options?: { recordHistory: boolean }) {
    closePopout(id);
    const items = windowsRef.current;
    const closing = items.find((item) => item.id === id);
    if (!closing) return;
    if (options?.recordHistory !== false) {
      pushUndo({
        kind: "close",
        window: { ...closing, poppedOut: false, minimized: false },
        previousActiveId: activeIdRef.current,
      });
    }
    const remaining = items.filter((item) => item.id !== id);
    setWindows(remaining);
    setActiveId((current) => {
      if (current !== id) return current;
      return remaining.at(-1)?.id ?? null;
    });
    setStatus(
      remaining.length
        ? `Closed window · ${remaining.length} open`
        : "Drop a file — a new window opens for each one.",
    );
  }

  function closeWindow(id: string) {
    removeWindowFromDesk(id, { recordHistory: true });
  }

  function restoreWindowToDesk(
    item: WindowItem,
    previousActiveId: string | null,
    asActive: boolean,
  ) {
    setWindows((items) => {
      if (items.some((w) => w.id === item.id)) return items;
      const z = zTopRef.current + 1;
      setZTop(z);
      const next = {
        ...item,
        z,
        poppedOut: false,
        minimized: false,
      };
      return [...items, next];
    });
    if (asActive) {
      setActiveId(item.id);
    } else {
      setActiveId(previousActiveId);
    }
    setStatus(`Restored ${item.file.filename}`);
  }

  function undoWorkspace() {
    const stack = undoStackRef.current;
    const entry = stack[stack.length - 1];
    if (!entry) return;
    setUndoStack((s) => s.slice(0, -1));
    if (entry.kind === "close") {
      restoreWindowToDesk(entry.window, entry.previousActiveId, true);
      setRedoStack((s) => [...s, entry]);
      setStatus(`Undo close · ${entry.window.file.filename}`);
      return;
    }
    // Undo open → park the window on the redo stack (no revoke).
    closePopout(entry.window.id);
    setWindows((items) => {
      const live = items.find((w) => w.id === entry.window.id);
      const parked = live
        ? { ...live, poppedOut: false, minimized: false }
        : entry.window;
      setRedoStack((s) => [
        ...s,
        { ...entry, window: parked, previousActiveId: activeIdRef.current },
      ]);
      const remaining = items.filter((w) => w.id !== entry.window.id);
      setActiveId((current) => {
        if (current !== entry.window.id) return current;
        return entry.previousActiveId &&
          remaining.some((w) => w.id === entry.previousActiveId)
          ? entry.previousActiveId
          : (remaining.at(-1)?.id ?? null);
      });
      return remaining;
    });
    setStatus(`Undo open · ${entry.window.file.filename}`);
  }

  function redoWorkspace() {
    const stack = redoStackRef.current;
    const entry = stack[stack.length - 1];
    if (!entry) return;
    setRedoStack((s) => s.slice(0, -1));
    if (entry.kind === "close") {
      // Redo close → remove again, keep on undo.
      closePopout(entry.window.id);
      setWindows((items) => {
        const live = items.find((w) => w.id === entry.window.id);
        const parked = live
          ? { ...live, poppedOut: false, minimized: false }
          : entry.window;
        setUndoStack((s) => [
          ...s,
          { ...entry, window: parked, previousActiveId: activeIdRef.current },
        ]);
        const remaining = items.filter((w) => w.id !== entry.window.id);
        setActiveId((current) => {
          if (current !== entry.window.id) return current;
          return remaining.at(-1)?.id ?? null;
        });
        return remaining;
      });
      setStatus(`Redo close · ${entry.window.file.filename}`);
      return;
    }
    // Redo open → bring window back.
    restoreWindowToDesk(entry.window, entry.previousActiveId, true);
    setUndoStack((s) => [...s, entry]);
    setStatus(`Redo open · ${entry.window.file.filename}`);
  }

  undoWorkspaceRef.current = undoWorkspace;
  redoWorkspaceRef.current = redoWorkspace;

  function patchWindow(id: string, patch: Partial<WindowItem>) {
    setWindows((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function toggleMinimize(id: string) {
    setWindows((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const nextMinimized = !item.minimized;
        return {
          ...item,
          minimized: nextMinimized,
          maximized: nextMinimized ? false : item.maximized,
        };
      }),
    );
    const item = windowsRef.current.find((w) => w.id === id);
    if (item && !item.minimized) {
      // Just minimized — leave focus; dock will show the tile.
      setStatus(`Minimized ${item.file.filename} · restore from the dock`);
    } else {
      focusWindow(id);
    }
  }

  function restoreFromDock(id: string) {
    setWindows((items) =>
      items.map((item) =>
        item.id === id ? { ...item, minimized: false } : item,
      ),
    );
    focusWindow(id);
  }

  /** Taskbar click: restore if minimized, otherwise just focus. */
  function selectFromTaskbar(id: string) {
    const item = windowsRef.current.find((w) => w.id === id);
    if (!item) return;
    if (item.minimized) {
      restoreFromDock(id);
      return;
    }
    focusWindow(id);
  }

  function toggleMaximize(id: string) {
    setWindows((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        if (item.maximized && item.restore) {
          return {
            ...item,
            maximized: false,
            minimized: false,
            x: item.restore.x,
            y: item.restore.y,
            width: item.restore.width,
            height: item.restore.height,
            restore: null,
          };
        }
        const margin = prefersTouchUi() ? 6 : 12;
        return {
          ...item,
          maximized: true,
          minimized: false,
          restore: {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          },
          x: margin,
          y: margin,
          width: Math.max(280, window.innerWidth - margin * 2),
          height: Math.max(240, window.innerHeight - margin * 2),
        };
      }),
    );
    focusWindow(id);
  }

  function popOutWindow(item: WindowItem) {
    // Mobile Safari turns window.open into a tab with cramped layout — expand
    // in-place instead (same control is labeled Expand on touch UI).
    if (prefersTouchUi()) {
      if (!item.maximized) {
        toggleMaximize(item.id);
        setStatus(`Expanded ${item.file.filename} — tap ❐ to restore.`);
      } else {
        focusWindow(item.id);
      }
      return;
    }

    const existing = popoutsRef.current.get(item.id);
    if (existing && !existing.popup.closed) {
      existing.popup.focus();
      patchWindow(item.id, { poppedOut: true, minimized: false });
      return;
    }

    flushPlaybackFromDom(item.id);

    const popW = Math.max(
      720,
      Math.min(Math.round(item.width), Math.round(window.screen.availWidth * 0.92)),
    );
    const popH = Math.max(
      640,
      Math.min(Math.round(item.height), Math.round(window.screen.availHeight * 0.88)),
    );
    const popup = window.open(
      "",
      `filelathe-popout-${item.id}`,
      `popup=yes,width=${popW},height=${popH},left=${Math.round(item.x)},top=${Math.round(item.y)}`,
    );
    if (!popup) {
      setStatus("Pop-out blocked — allow pop-ups for this site.");
      return;
    }

    popup.document.title = `${item.file.title} · ${item.file.filename}`;
    copyStylesTo(popup.document);
    popup.document.body.className =
      document.body.className || "bg-background text-foreground";
    popup.document.body.style.margin = "0";
    popup.document.body.style.minHeight = "100vh";
    popup.document.body.style.background =
      getComputedStyle(document.body).backgroundColor || "#faf8f3";

    const mount = popup.document.createElement("div");
    mount.id = "filelathe-popout-root";
    mount.style.minHeight = "100vh";
    mount.style.boxSizing = "border-box";
    mount.style.padding = "clamp(12px, 2vw, 24px)";
    popup.document.body.appendChild(mount);

    const root = createRoot(mount);
    root.render(
      <ToastProvider>
        <div className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-6xl flex-col gap-4">
          <header className="border-b pb-3">
            <div className="text-base font-medium sm:text-lg">
              {item.file.title}
            </div>
            <div className="text-sm text-muted-foreground">
              {labelForKind(item.file.kind)} · {item.file.filename}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-auto text-base">
            <WindowBody spec={item.spec} playbackKey={item.id} />
          </div>
        </div>
      </ToastProvider>,
    );

    const timer = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(timer);
      try {
        root.unmount();
      } catch {
        // ignore
      }
      popoutsRef.current.delete(item.id);
      patchWindow(item.id, { poppedOut: false });
      setStatus(`Docked ${item.file.filename} after pop-out closed.`);
    }, 400);

    popoutsRef.current.set(item.id, { popup, root, timer });
    patchWindow(item.id, {
      poppedOut: true,
      minimized: false,
      maximized: false,
    });
    setStatus(`Popped out ${item.file.filename}.`);
    focusWindow(item.id);
  }

  function dockWindow(id: string) {
    const entry = popoutsRef.current.get(id);
    if (entry && !entry.popup.closed) {
      flushPlaybackFromDom(id, entry.popup.document);
    }
    closePopout(id);
    patchWindow(id, { poppedOut: false });
    setStatus("Window docked back into the page.");
    focusWindow(id);
  }

  async function composeAndOpen(file: LoadedFile, source: FileOpenSource) {
    let toCompose = file;
    let plannedInspect = false;

    if (file.kind === "unknown" && !file.inventedSpec) {
      const planned = plannedPlayer(
        matchPlayers(file.filename, file.mimeType),
      );
      // Never reuse an invented Spec for formats that need a real emulator.
      if (!planned) {
        setStatus("Checking saved mini-apps…");
        const cached = await lookupSandboxViewer(file);
        if (cached && cached.inventedBy === "haiku") {
          toCompose = {
            ...file,
            inventedSpec: cached.spec,
            inventSource: "cache",
            inventPrompt:
              cached.prompt || file.inventPrompt || buildInventPrompt(file),
          };
          setStatus(`Using saved mini-app (${cached.scope}) — composing…`);
        } else {
          setStatus(`Detected ${labelForKind(file.kind)} — routing…`);
        }
      } else {
        plannedInspect = true;
        setStatus(
          `Detected ${planned.label} (planned) — inspector, not invent…`,
        );
      }
    } else {
      setStatus(`Detected ${labelForKind(file.kind)} — composing…`);
    }

    const response = await fetch("/api/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: toCompose }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw await readApiError(response);
    const data = (await response.json()) as ComposeResponse;
    if (!data.finalSpec) throw new Error("Compose returned no spec.");
    for (const warning of data.warnings ?? []) {
      const lower = warning.toLowerCase();
      const which = lower.includes("haiku")
        ? "haiku"
        : lower.includes("jev")
          ? "jev"
          : null;
      if (which) track("api_degraded", { which });
      toast({
        title: which === "haiku"
          ? "Haiku unavailable"
          : which === "jev"
            ? "Jev unavailable"
            : "Using fallback",
        description: warning,
        variant: "warning",
        durationMs: 8000,
      });
    }

    const opened = data.file ?? toCompose;
    const ext = extensionFromFilename(opened.filename);
    const inventSource =
      opened.kind === "unknown" ? opened.inventSource ?? null : null;

    track("file_opened", {
      source,
      kind: opened.kind,
      ext,
      route: data.route ?? "compose",
      invent_source: inventSource ?? "none",
    });

    if (opened.kind === "unknown") {
      let outcome: InventOutcome;
      if (
        inventSource === "haiku" ||
        inventSource === "cache" ||
        inventSource === "fallback"
      ) {
        outcome = inventSource;
      } else if (plannedInspect || data.route === "inspect") {
        outcome = "planned_inspector";
      } else {
        outcome = "fallback";
      }
      track("invent_result", { outcome, ext });
    }

    if (
      opened.kind === "unknown" &&
      opened.inventedSpec &&
      opened.inventSource === "haiku"
    ) {
      void saveSandboxViewer({
        filename: opened.filename,
        mimeType: opened.mimeType,
        sampleText: opened.sampleText,
        hexPreview: opened.hexPreview,
        spec: opened.inventedSpec,
        prompt: opened.inventPrompt,
        inventedBy: "haiku",
      }).catch((error) => {
        console.warn("[sandbox-store] save failed:", error);
      });
      setSpecsRefresh((n) => n + 1);
    }

    const items = windowsRef.current;
    const offset = nextOffset(items.length);
    const z = zTopRef.current + 1;
    const id = `${idPrefix}-${Date.now()}-${items.length}`;
    const previousActiveId = activeIdRef.current;
    const touch = prefersTouchUi();
    const margin = touch ? 8 : 24;
    const openW = touch
      ? Math.max(280, window.innerWidth - margin * 2)
      : Math.min(DEFAULT_W, window.innerWidth - margin);
    const openH = touch
      ? Math.max(320, Math.round(window.innerHeight * 0.62))
      : Math.min(DEFAULT_H, window.innerHeight - 48);
    const openedWindow: WindowItem = {
      id,
      file: opened,
      spec: data.finalSpec!,
      prompt: data.prompt ?? "",
      x: touch ? margin : offset.x,
      y: touch ? Math.max(72, offset.y) : offset.y,
      z,
      width: openW,
      height: openH,
      minimized: false,
      maximized: false,
      poppedOut: false,
      restore: null,
    };
    setZTop(z);
    setActiveId(id);
    const cacheBit =
      opened.kind === "unknown" && opened.inventSource
        ? ` · invent=${opened.inventSource}`
        : "";
    const routeBit = data.route ? ` · route=${data.route}` : "";
    setStatus(
      `Opened ${labelForKind(opened.kind)} · ${opened.filename} · stopReason=${data.stopReason ?? "?"}${cacheBit}${routeBit}`,
    );
    pushUndo({
      kind: "open",
      window: openedWindow,
      previousActiveId,
    });
    setWindows((prev) => [...prev, openedWindow]);
  }

  const openFromFileRef = useRef<
    (raw: File | undefined, source: FileOpenSource) => void
  >(() => undefined);

  // ArchiveBrowser opens extracted entries through the normal drop path.
  useEffect(() => {
    setArchiveOpener((file) => openFromFileRef.current(file, "archive"));
    return () => setArchiveOpener(null);
  }, []);

  async function openFromFile(raw: File | undefined, source: FileOpenSource) {
    if (!raw) return; // picker cancel — stay quiet
    if (busyRef.current) {
      toast({
        title: "Still working",
        description: "Wait for the current file to finish before opening another.",
        variant: "warning",
        durationMs: 4000,
      });
      return;
    }
    track("file_open", { source });
    setBusyFlag(true);
    setStatus(`Opening ${raw.name}…`);
    try {
      const file = await loadDroppedFile(raw);
      await composeAndOpen(file, source);
    } catch (error) {
      track("file_open_failed", {
        source,
        reason: classifyOpenError(error, "compose"),
      });
      toastApiFailure(error);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyFlag(false);
    }
  }
  openFromFileRef.current = openFromFile;

  function fileFromDataTransfer(dt: DataTransfer | null): File | null {
    if (!dt) return null;
    if (dt.files?.length) return dt.files.item(0);
    for (const item of Array.from(dt.items ?? [])) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
    return null;
  }

  const acceptDroppedPayloadRef = useRef<(dt: DataTransfer | null) => void>(
    () => undefined,
  );
  acceptDroppedPayloadRef.current = (dt: DataTransfer | null) => {
    const file = fileFromDataTransfer(dt);
    if (file) {
      void openFromFile(file, "drop");
      return;
    }
    // Finder Recents / smart folders often advertise Files but leave FileList empty.
    const claimedFiles = Array.from(dt?.types ?? []).some(
      (t) => t === "Files" || t === "application/x-moz-file",
    );
    track("file_open_failed", { source: "drop", reason: "drop_empty" });
    toast({
      title: "Couldn't read that drop",
      description: claimedFiles
        ? "Finder Recents drops often arrive empty in the browser. Open the file from its real folder (Downloads / Documents), or use Choose file… from that folder."
        : "Try Choose file…, or drop a real file (not a Finder alias / Recents stub).",
      variant: "warning",
      durationMs: 8000,
    });
  };

  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Native listeners — React synthetic DragEvents sometimes see an empty FileList
  // for Finder drops on Chromium/macOS.
  useEffect(() => {
    const el = dropZoneRef.current;
    if (!el) return;

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.target === el) setDragOver(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDragOver(false);
      acceptDroppedPayloadRef.current(event.dataTransfer);
    };

    el.addEventListener("dragenter", onDragOver);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onDragOver);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.02_95),transparent_45%),linear-gradient(180deg,oklch(0.99_0.005_95),oklch(0.95_0.01_95))]">
      <div className="relative z-0 mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 pb-28">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <FilelatheLogo className="h-12 w-12 shrink-0 text-primary" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                swiss-army file utility
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Filelathe
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Drop a file to open it in your browser — play XM/MOD trackers, view
            PDFs, edit images, inspect CSV/JSON, or invent a mini-app for
            formats nothing else handles.
          </p>
        </header>

        {/* Only the open strip sits above windows (z-20). A full-column z-30
            overlay blocked Play and other window clicks. */}
        <div className="relative z-40 space-y-3">
          <div
            ref={dropZoneRef}
            className={`rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-card/70"
            } ${busy ? "opacity-70" : ""}`}
          >
            <p className="text-lg font-medium">
              {busy ? "Working…" : "Drop a file"}
            </p>
            {busy ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <InventingAnimation
                  label={
                    status.toLowerCase().includes("invent")
                      ? "Haiku is inventing a mini-app…"
                      : "Composing UI…"
                  }
                />
                <button
                  type="button"
                  className="rounded-full border px-4 py-1.5 text-xs"
                  onClick={() => {
                    setBusyFlag(false);
                    setStatus("Cancelled.");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                media · docs · data · anything else (invent mini-app)
              </p>
            )}
          </div>

          {/* Outside drop zone so Finder drops aren't eaten by <input type=file>. */}
          <div className="flex justify-center gap-3">
            <label
              htmlFor="filelathe-file-input"
              className="inline-flex cursor-pointer rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
            >
              Choose file…
            </label>
            <input
              id="filelathe-file-input"
              type="file"
              className="absolute h-px w-px overflow-hidden opacity-0"
              onChange={(event) => {
                const next = event.target.files?.[0];
                event.target.value = "";
                if (!next) {
                  toast({
                    title: "No file selected",
                    description: "The file dialog closed without a file.",
                    variant: "warning",
                    durationMs: 4000,
                  });
                  return;
                }
                void openFromFile(next, "picker");
              }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{status}</p>
        <SavedSpecsPanel refreshToken={specsRefresh} />
        {windows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Windows float over the page once you drop a file. Drag the title
            bar to move, resize from the corner, or minimize to the taskbar.
            Undo close with ⌘Z / Ctrl+Z.
          </p>
        ) : null}

        <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <a className="underline-offset-2 hover:underline" href="/formats/">
            Formats
          </a>
          <a className="underline-offset-2 hover:underline" href="/guides/">
            Guides
          </a>
          <a
            className="underline-offset-2 hover:underline"
            href="/guides/open-tracker-modules-online/"
          >
            Play XM/MOD online
          </a>
          <a className="underline-offset-2 hover:underline" href="/sitemap.xml">
            Sitemap
          </a>
        </footer>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {windows.map((item) => (
          <WindowChrome
            key={item.id}
            title={item.file.title}
            subtitle={`${labelForKind(item.file.kind)} · ${item.file.filename}`}
            active={item.id === activeId}
            minimized={item.minimized}
            maximized={item.maximized}
            poppedOut={item.poppedOut}
            x={item.x}
            y={item.y}
            z={item.z}
            width={item.width}
            height={item.height}
            onFocus={() => focusWindow(item.id)}
            onClose={() => closeWindow(item.id)}
            onMove={(x, y) => patchWindow(item.id, { x, y })}
            onResize={(width, height) =>
              patchWindow(item.id, { width, height })
            }
            onMinimize={() => toggleMinimize(item.id)}
            onToggleMaximize={() => toggleMaximize(item.id)}
            onPopOut={() => popOutWindow(item)}
            onDock={() => dockWindow(item.id)}
          >
            {!item.poppedOut ? (
              <WindowBody spec={item.spec} playbackKey={item.id} />
            ) : null}
          </WindowChrome>
        ))}
      </div>

      <AppDock
        tiles={windows
          .filter((item) => !item.poppedOut)
          .map((item) => ({
            id: item.id,
            title: item.file.title,
            subtitle: item.file.filename,
            kindLabel: labelForKind(item.file.kind),
            minimized: item.minimized,
            active: item.id === activeId,
          }))}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        undoLabel={historyLabel(undoStack.at(-1), "Undo")}
        redoLabel={historyLabel(redoStack.at(-1), "Redo")}
        onUndo={undoWorkspace}
        onRedo={redoWorkspace}
        onSelect={selectFromTaskbar}
      />
    </div>
  );
}
