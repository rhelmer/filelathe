import { useEffect, useId, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Spec } from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { readApiError, toastMessageForApiError } from "./api-error";
import { fetchedToFile, type FetchedResource } from "./fetch-resource";
import {
  labelForKind,
  loadDroppedFile,
  revokeLoadedFile,
  type LoadedFile,
} from "./files";
import { InventingAnimation } from "./InventingAnimation";
import { buildInventPrompt } from "./invent-prompt";
import { isProbablyUrl } from "./resource-utils";
import { registry } from "./registry";
import {
  clearSandboxViewers,
  lookupSandboxViewer,
  saveSandboxViewer,
} from "./sandbox-store";
import { matchPlayers, plannedPlayer } from "./players";
import { useToast, ToastProvider } from "./toast";
import { FilelatheLogo } from "./FilelatheLogo";
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

const DEFAULT_W = 560;
const DEFAULT_H = 520;

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

function WindowBody({ spec }: { spec: Spec }) {
  return (
    <JSONUIProvider registry={registry} initialState={spec.state ?? {}}>
      <Renderer spec={spec} registry={registry} />
    </JSONUIProvider>
  );
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
  const [status, setStatus] = useState(
    "Drop a file or paste a URL — a new window opens for each one.",
  );
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  function toastApiFailure(error: unknown) {
    const msg = toastMessageForApiError(error);
    toast({
      title: msg.title,
      description: msg.description,
      variant: msg.variant,
      durationMs: msg.variant === "error" ? 10_000 : 7000,
    });
  }

  useEffect(() => {
    return () => {
      for (const item of windowsRef.current) revokeLoadedFile(item.file);
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

  function closeWindow(id: string) {
    closePopout(id);
    setWindows((items) => {
      const closing = items.find((item) => item.id === id);
      if (closing) revokeLoadedFile(closing.file);
      const remaining = items.filter((item) => item.id !== id);
      setActiveId((current) => {
        if (current !== id) return current;
        return remaining.at(-1)?.id ?? null;
      });
      setStatus(
        remaining.length
          ? `Closed window · ${remaining.length} open`
          : "Drop a file or paste a URL — a new window opens for each one.",
      );
      return remaining;
    });
  }

  function patchWindow(id: string, patch: Partial<WindowItem>) {
    setWindows((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function toggleMinimize(id: string) {
    setWindows((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          minimized: !item.minimized,
          maximized: item.minimized ? item.maximized : false,
        };
      }),
    );
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
        const margin = 12;
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
          width: Math.max(320, window.innerWidth - margin * 2),
          height: Math.max(240, window.innerHeight - margin * 2),
        };
      }),
    );
    focusWindow(id);
  }

  function popOutWindow(item: WindowItem) {
    const existing = popoutsRef.current.get(item.id);
    if (existing && !existing.popup.closed) {
      existing.popup.focus();
      patchWindow(item.id, { poppedOut: true, minimized: false });
      return;
    }

    const popup = window.open(
      "",
      `jev-popout-${item.id}`,
      `popup=yes,width=${Math.round(item.width)},height=${Math.round(item.height)},left=${Math.round(item.x)},top=${Math.round(item.y)}`,
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

    const mount = popup.document.createElement("div");
    mount.id = "jev-popout-root";
    mount.style.minHeight = "100vh";
    mount.style.boxSizing = "border-box";
    mount.style.padding = "16px";
    popup.document.body.appendChild(mount);

    const root = createRoot(mount);
    root.render(
      <ToastProvider>
        <div className="mx-auto flex min-h-[calc(100vh-32px)] max-w-5xl flex-col gap-3">
          <header className="border-b pb-3">
            <div className="text-sm font-medium">{item.file.title}</div>
            <div className="text-xs text-muted-foreground">
              {labelForKind(item.file.kind)} · {item.file.filename}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            <WindowBody spec={item.spec} />
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
    closePopout(id);
    patchWindow(id, { poppedOut: false });
    setStatus("Window docked back into the page.");
    focusWindow(id);
  }

  async function composeAndOpen(file: LoadedFile) {
    let toCompose = file;

    if (file.kind === "unknown" && !file.inventedSpec) {
      const planned = plannedPlayer(
        matchPlayers(file.filename, file.mimeType),
      );
      // Never reuse an invented Spec for formats that need a real emulator.
      if (!planned) {
        setStatus("Checking saved invented Specs…");
        const cached = await lookupSandboxViewer(file);
        if (cached && cached.inventedBy === "haiku") {
          toCompose = {
            ...file,
            inventedSpec: cached.spec,
            inventSource: "cache",
            inventPrompt:
              cached.prompt || file.inventPrompt || buildInventPrompt(file),
          };
          setStatus(`Using saved Spec (${cached.scope}) — composing…`);
        } else {
          setStatus(`Detected ${labelForKind(file.kind)} — routing…`);
        }
      } else {
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
    });
    if (!response.ok) throw await readApiError(response);
    const data = (await response.json()) as ComposeResponse;
    if (!data.finalSpec) throw new Error("Compose returned no spec.");
    for (const warning of data.warnings ?? []) {
      toast({
        title: "Haiku unavailable",
        description: warning,
        variant: "warning",
        durationMs: 8000,
      });
    }

    const opened = data.file ?? toCompose;

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
    }

    setWindows((items) => {
      const offset = nextOffset(items.length);
      const z = zTop + 1;
      const id = `${idPrefix}-${Date.now()}-${items.length}`;
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
      return [
        ...items,
        {
          id,
          file: opened,
          spec: data.finalSpec!,
          prompt: data.prompt ?? "",
          x: offset.x,
          y: offset.y,
          z,
          width: Math.min(DEFAULT_W, window.innerWidth - 24),
          height: Math.min(DEFAULT_H, window.innerHeight - 48),
          minimized: false,
          maximized: false,
          poppedOut: false,
          restore: null,
        },
      ];
    });
  }

  async function openFromFile(raw: File | undefined) {
    if (!raw || busy) return;
    setBusy(true);
    setStatus("Detecting file and composing…");
    try {
      const file = await loadDroppedFile(raw);
      await composeAndOpen(file);
    } catch (error) {
      toastApiFailure(error);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function openFromUrl(rawUrl: string) {
    if (!rawUrl.trim() || busy) return;
    setBusy(true);
    setStatus("Fetching URL…");
    try {
      const response = await fetch("/api/fetch-resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl.trim() }),
      });
      if (!response.ok) throw await readApiError(response);
      const data = (await response.json()) as FetchedResource;

      const file = await loadDroppedFile(fetchedToFile(data));
      const withSource =
        file.kind === "unknown" || file.kind === "webpage"
          ? { ...file, sourceUrl: data.url }
          : file;
      await composeAndOpen(withSource);
      setUrlDraft("");
    } catch (error) {
      toastApiFailure(error);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const uri =
      event.dataTransfer.getData("text/uri-list") ||
      event.dataTransfer.getData("text/plain");
    if (uri && isProbablyUrl(uri.split("\n")[0] ?? "")) {
      void openFromUrl((uri.split("\n")[0] ?? "").trim());
      return;
    }
    void openFromFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.02_95),transparent_45%),linear-gradient(180deg,oklch(0.99_0.005_95),oklch(0.95_0.01_95))]">
      <div className="relative z-0 mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
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
            Drop files or paste URLs. Known types get dedicated tools; unknowns
            get an Anthropic Haiku–invented json-render Spec using the catalog.
          </p>
        </header>

        <div
          className={`rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-card/70"
          } ${busy ? "opacity-70" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="text-lg font-medium">
            {busy ? "Working…" : "Drop a file or URL"}
          </p>
          {busy ? (
            <div className="mt-4 flex justify-center">
              <InventingAnimation
                label={
                  status.toLowerCase().includes("invent")
                    ? "Haiku is inventing a Spec…"
                    : "Composing UI…"
                }
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              media · docs · data · anything else (invent Spec) · https://…
            </p>
          )}
          <label className="mt-4 inline-flex cursor-pointer rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">
            Choose file…
            <input
              type="file"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                void openFromFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <form
            className="mx-auto mt-4 flex max-w-lg gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void openFromUrl(urlDraft);
            }}
          >
            <input
              type="url"
              value={urlDraft}
              disabled={busy}
              placeholder="https://example.com/file.json"
              className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2 text-sm"
              onChange={(event) => setUrlDraft(event.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !urlDraft.trim()}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-50"
            >
              Open URL
            </button>
          </form>
        </div>

        <p className="text-sm text-muted-foreground">{status}</p>
        <p className="text-xs text-muted-foreground">
          Sandbox viewers are saved in this browser (IndexedDB) and reused for
          the same content or file extension.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void clearSandboxViewers()
                .then(() => setStatus("Cleared saved invented Specs."))
                .catch((error) =>
                  setStatus(
                    error instanceof Error ? error.message : String(error),
                  ),
                );
            }}
          >
            Clear saved Specs
          </button>
        </p>
        {windows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Windows float over the page once you drop a file or URL. Drag the
            title bar, resize from the corner, or use minimize / maximize /
            pop-out.
          </p>
        ) : null}
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
            {!item.poppedOut && !item.minimized ? (
              <WindowBody spec={item.spec} />
            ) : null}
          </WindowChrome>
        ))}
      </div>
    </div>
  );
}
