/**
 * Jev-backed routing for unrecognized drops: use a host player when we have
 * one, never invent emulators, otherwise prefer inventing a Spec mini-app
 * (with inspect as a fallback / user choice).
 */

import type { JsonValue } from "@typesafe-ai/sdk";
import { createEvaluator } from "./evaluator";
import {
  availablePlayer,
  matchPlayers,
  plannedPlayer,
  playerRegistrySummary,
  type PlayerEntry,
} from "./players";

export type UnknownRoute =
  | {
      action: "use_player";
      player: PlayerEntry;
      reason: string;
    }
  | {
      action: "inspect";
      player: PlayerEntry | null;
      reason: string;
    }
  | {
      action: "invent";
      reason: string;
    };

/**
 * Deterministic invent-vs-inspect when Jev is unavailable.
 * Planned emulator formats stay inspect-only; everything else invents.
 */
export function heuristicInventOrInspect(
  filename: string,
  mimeType: string,
  _sampleText: string | null = null,
): Extract<UnknownRoute, { action: "invent" | "inspect" }> {
  const matches = matchPlayers(filename, mimeType);
  const planned = plannedPlayer(matches);
  if (planned) {
    return {
      action: "inspect",
      player: planned,
      reason: `Matched planned emulator ${planned.id} — inspect only until a host player ships.`,
    };
  }
  return {
    action: "invent",
    reason: "No planned host player — invent a catalog Spec mini-app.",
  };
}

/**
 * Route an unknown drop. Prefer deterministic player registry matches;
 * use Jev only when choosing invent vs inspect for non-player files.
 */
export async function routeUnknownFile(
  input: {
    filename: string;
    mimeType: string;
    size: number;
    sampleText: string | null;
    hexPreview: string;
    sourceUrl?: string | null;
  },
  options: { signal?: AbortSignal } = {},
): Promise<UnknownRoute> {
  const matches = matchPlayers(input.filename, input.mimeType);
  const available = availablePlayer(matches);
  if (available) {
    return {
      action: "use_player",
      player: available,
      reason: `Registry hit: available player ${available.label}.`,
    };
  }
  const planned = plannedPlayer(matches);
  if (planned) {
    return {
      action: "inspect",
      player: planned,
      reason: `Registry hit: ${planned.label} is planned — do not invent an emulator; show inspector.`,
    };
  }

  try {
    const evaluate = createEvaluator();
    const result = await evaluate({
      state: {
        file: {
          filename: input.filename,
          mimeType: input.mimeType,
          size: input.size,
          sampleText: (input.sampleText ?? "").slice(0, 800),
          hexPreview: input.hexPreview.slice(0, 240),
          sourceUrl: input.sourceUrl ?? null,
        },
        players: playerRegistrySummary() as unknown as JsonValue,
        guidance:
          "Never invent an emulator, CPU, disk controller, or game console — those must come from the host player registry. Prefer invent (a json-render Spec mini-app) for unrecognized files, including opaque binaries, unless the file clearly needs a planned registry emulator. Prefer inspect only when a planned emulator/player is the right host and is not wired yet, or when inventing a mini-app would not help.",
      } as { [key: string]: JsonValue },
      questions: {
        route: {
          type: "choice",
          instructions:
            "How should the drop→UI host handle this unrecognized file?",
          criteria: {
            invent:
              "Default for unrecognized files: invent a small json-render Spec mini-app (text, config, markup, or opaque binary that can still use a useful viewer/notes/hex UI). Not an emulator.",
            inspect:
              "Only when a planned host emulator/player is required and not yet wired, or inventing a mini-app is clearly not useful — show hex/metadata inspector only.",
          },
        },
      },
      signal: options.signal ?? AbortSignal.timeout(20_000),
    });

    const choice = result.answers.route?.choice;
    if (choice === "invent") {
      return {
        action: "invent",
        reason: `Jev chose invent (confidence ${result.answers.route?.confidence ?? "?"}).`,
      };
    }
    if (choice === "inspect") {
      return {
        action: "inspect",
        player: null,
        reason: `Jev chose inspect (confidence ${result.answers.route?.confidence ?? "?"}).`,
      };
    }
  } catch (error) {
    console.warn(
      "[route-unknown] Jev routing failed, using heuristic:",
      error instanceof Error ? error.message : error,
    );
  }

  const fallback = heuristicInventOrInspect(
    input.filename,
    input.mimeType,
    input.sampleText,
  );
  return {
    ...fallback,
    reason: `Heuristic: ${fallback.reason}`,
  };
}
