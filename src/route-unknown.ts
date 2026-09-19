/**
 * Jev-backed routing for unrecognized drops: use a host player when we have
 * one, never invent emulators, otherwise invent a Spec UI or show a binary inspector.
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

function heuristicInventOrInspect(
  filename: string,
  mimeType: string,
  sampleText: string | null,
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
  if (!sampleText || sampleText.trim().length < 20) {
    return {
      action: "inspect",
      player: null,
      reason: "Little or no decodable text — binary inspector.",
    };
  }
  return {
    action: "invent",
    reason: "Decodable text — invent a catalog Spec mini-app.",
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
          "Never invent an emulator, CPU, disk controller, or game console. Those must come from the host player registry. Prefer invent only for readable source/config/text that benefits from a json-render mini-app. Prefer inspect for opaque binaries, archives, and ROMs/disks with no registered player.",
      } as { [key: string]: JsonValue },
      questions: {
        route: {
          type: "choice",
          instructions:
            "How should the drop→UI host handle this unrecognized file?",
          criteria: {
            invent:
              "Decodable text, source, config, or markup — invent a small json-render Spec viewer/editor. Not an emulator.",
            inspect:
              "Opaque binary, ROM, disk, archive, or anything that would need an emulator/player we do not have — show hex/metadata inspector only.",
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
