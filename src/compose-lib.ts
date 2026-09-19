import {
  experimental_composeSpec,
  type Experimental_CompositionCatalog,
  type Experimental_CompositionEvent,
  type Spec,
} from "@json-render/core";
import { catalog as appCatalog } from "./catalog";
import {
  buildFileCandidates,
  MAX_ELEMENTS,
  stateForFile,
} from "./file-candidates";
import { createEvaluator } from "./evaluator";
import { labelForKind, promptForFile, type LoadedFile } from "./files";
import { buildInventPrompt } from "./invent-prompt";
import { inventViewerSpec } from "./invent-viewer";
import type { PlayerEntry } from "./players";
import { routeUnknownFile } from "./route-unknown";
import { buildFallbackComposeSpec } from "./compose-fallback";
import { isModelUnavailableError } from "./server/model-errors";

const catalog = appCatalog as unknown as Experimental_CompositionCatalog;

export type ComposeResult = {
  events: Experimental_CompositionEvent[];
  finalSpec: Spec | null;
  stopReason: "finish" | "limit" | "unavailable" | null;
  prompt: string;
  kind: LoadedFile["kind"];
  /** Echo of the file after server-side enrichment (e.g. invented Spec). */
  file: LoadedFile;
  /** Routing decision for unknown drops (player / invent / inspect). */
  route?: string;
  /** Soft warnings (e.g. Haiku unavailable → fallback Spec). */
  warnings?: string[];
};

function noteForSource(
  source: "haiku" | "fallback" | "cache" | null,
  reason?: string | null,
): string {
  if (source === "haiku") {
    return "Haiku invented this mini-app from the catalog.";
  }
  if (source === "cache") {
    return "Mini-app restored from browser storage.";
  }
  if (source === "fallback") {
    return reason
      ? `Fallback mini-app (${reason}).`
      : "Fallback mini-app (Haiku unavailable or invalid output).";
  }
  return "Preparing mini-app…";
}

/** Wrap an invented Spec in InventedViewer (prompt editor + nested Renderer). */
export function wrapInventedViewer(
  file: Extract<LoadedFile, { kind: "unknown" }>,
): Spec {
  return {
    root: "viewer",
    elements: {
      viewer: {
        type: "InventedViewer",
        props: {
          // Stringify so the outer Renderer does not resolve nested $bindState.
          specJson: JSON.stringify(file.inventedSpec!),
          note: noteForSource(file.inventSource, file.inventReason),
          prompt: file.inventPrompt ?? "",
          invent: {
            title: file.title,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
            sampleText: file.sampleText,
            hexPreview: file.hexPreview,
            sourceUrl: file.sourceUrl,
          },
        },
        children: [],
      },
    },
  };
}

export function wrapBinaryInspector(
  file: Extract<LoadedFile, { kind: "unknown" }>,
  options: { player?: PlayerEntry | null; reason: string },
): Spec {
  const player = options.player ?? null;
  const playerHint = player
    ? `${player.label} (${player.id}) is registered as ${player.status}. ${player.description}. Drop support will mount a real host emulator when available — Haiku will not invent one.`
    : null;

  return {
    root: "card",
    elements: {
      card: {
        type: "Card",
        props: {
          title: null,
          description: null,
          maxWidth: "full",
          centered: null,
        },
        children: ["inspector"],
      },
      inspector: {
        type: "BinaryInspector",
        props: {
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          hexPreview: file.hexPreview,
          sampleText: file.sampleText,
          note: options.reason,
          playerHint,
        },
        children: [],
      },
    },
  };
}

/** Auto-compose UI for a loaded file — no user prompt required. */
export async function composeForFile(
  file: LoadedFile,
  options: { signal?: AbortSignal } = {},
): Promise<ComposeResult> {
  let enriched = file;

  if (file.kind === "unknown" && !file.inventedSpec) {
    const route = await routeUnknownFile(
      {
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        sampleText: file.sampleText,
        hexPreview: file.hexPreview,
        sourceUrl: file.sourceUrl,
      },
      { signal: options.signal },
    );

    if (route.action === "inspect" || route.action === "use_player") {
      // Available players should already be dedicated FileKinds; if we still
      // land here, inspect rather than inventing a fake player.
      const player =
        route.action === "inspect"
          ? route.player
          : route.action === "use_player"
            ? route.player
            : null;
      return {
        events: [],
        finalSpec: wrapBinaryInspector(file, {
          player,
          reason: route.reason,
        }),
        stopReason: "finish",
        prompt: route.reason,
        kind: "unknown",
        file,
        route: route.action,
      };
    }

    // invent
    const inventInput = {
      title: file.title,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      sampleText: file.sampleText,
      hexPreview: file.hexPreview,
      sourceUrl: file.sourceUrl,
    };
    const invented = await inventViewerSpec(inventInput, {
      signal: options.signal,
      prompt: file.inventPrompt ?? undefined,
    });
    enriched = {
      ...file,
      inventedSpec: invented.spec,
      inventSource: invented.source,
      inventPrompt: invented.prompt,
      inventReason: invented.reason ?? null,
    };

    const warnings: string[] = [];
    if (invented.modelUnavailable) {
      warnings.push(
        invented.reason ??
          "Haiku is unavailable — showing a fallback mini-app instead.",
      );
    }

    return {
      events: [],
      finalSpec: wrapInventedViewer(enriched),
      stopReason: "finish",
      prompt: enriched.inventPrompt ?? promptForFile(enriched),
      kind: "unknown",
      file: enriched,
      route: "invent",
      warnings: warnings.length ? warnings : undefined,
    };
  } else if (file.kind === "unknown" && !file.inventPrompt) {
    enriched = {
      ...file,
      inventPrompt: buildInventPrompt({
        title: file.title,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        sampleText: file.sampleText,
        hexPreview: file.hexPreview,
        sourceUrl: file.sourceUrl,
      }),
    };
  }

  if (enriched.kind === "unknown" && enriched.inventedSpec) {
    return {
      events: [],
      finalSpec: wrapInventedViewer(enriched),
      stopReason: "finish",
      prompt: enriched.inventPrompt ?? promptForFile(enriched),
      kind: "unknown",
      file: enriched,
      route: "invent-cache",
    };
  }

  const prompt = promptForFile(enriched);
  const initialState = stateForFile(enriched);
  const fallbackReason = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  try {
    const evaluate = createEvaluator();
    const events: Experimental_CompositionEvent[] = [];
    let finalSpec: Spec | null = null;
    let stopReason: ComposeResult["stopReason"] = null;

    for await (const event of experimental_composeSpec({
      catalog,
      candidates: buildFileCandidates(enriched),
      prompt,
      initialState,
      evaluate,
      maxSteps: MAX_ELEMENTS,
      maxElements: MAX_ELEMENTS,
      maxDepth: 4,
      signal: options.signal ?? AbortSignal.timeout(60_000),
      context: {
        platform: `User dropped a ${enriched.kind} file named ${JSON.stringify(enriched.filename)}. Build a ${labelForKind(enriched.kind)} UI using only the offered candidates. The OS-style window chrome already shows the file title and name — do not repeat them.`,
      },
      instructions: {
        root: "Prefer Card as a border-only shell (no title/description). Use Stack only if several content sections are needed.",
        next: `Always include the primary ${enriched.kind} content candidate. Keep the tree minimal: primary content only (+ optional note/save). Never add Heading or filename labels.`,
        parent:
          "Put the primary content inside the card or stack. Keep actions near related fields.",
      },
    })) {
      events.push(event);
      if (event.spec) finalSpec = event.spec;
      if (event.type === "complete") stopReason = event.stopReason;
    }

    if (!finalSpec) {
      const reason = "Jev compose returned no Spec";
      console.warn(`[compose] ${reason} — using hardcoded fallback.`);
      return {
        events,
        finalSpec: buildFallbackComposeSpec(enriched, reason),
        stopReason: "unavailable",
        prompt,
        kind: enriched.kind,
        file: enriched,
        warnings: [`Jev compose failed — ${reason}. Using built-in layout.`],
      };
    }

    return {
      events,
      finalSpec,
      stopReason,
      prompt,
      kind: enriched.kind,
      file: enriched,
    };
  } catch (error) {
    const reason = fallbackReason(error);
    console.warn(
      `[compose] Jev failed (${isModelUnavailableError(error) ? "unavailable" : "error"}): ${reason} — hardcoded fallback.`,
    );
    return {
      events: [],
      finalSpec: buildFallbackComposeSpec(enriched, reason),
      stopReason: "unavailable",
      prompt,
      kind: enriched.kind,
      file: enriched,
      warnings: [
        isModelUnavailableError(error)
          ? `Jev unavailable — using built-in ${enriched.kind} layout.`
          : `Jev compose failed — using built-in ${enriched.kind} layout. (${reason})`,
      ],
    };
  }
}

/** @deprecated Prefer composeForFile for the drop-first app. */
export async function composeUI(
  prompt: string,
  options: {
    initialSpec?: Spec;
    file?: LoadedFile | null;
    signal?: AbortSignal;
  } = {},
): Promise<ComposeResult> {
  if (options.file) return composeForFile(options.file, options);
  throw new Error("Drop a file or paste a URL to compose a UI.");
}
