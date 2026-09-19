import {
  experimental_createEvaluator,
  type Experimental_CompositionEvaluator,
} from "@json-render/core";
import { TypeSafeClient, type JsonValue } from "@typesafe-ai/sdk";
import { ModelUnavailableError } from "./server/model-errors";

/**
 * Choice evaluator via TypeSafe's native API + TYPESAFE_API_KEY.
 * Use this when you have a TypeSafe key rather than a Vercel AI Gateway key.
 */
export function createTypeSafeEvaluator(
  apiKey = process.env.TYPESAFE_API_KEY ?? "",
): Experimental_CompositionEvaluator {
  const key = apiKey.trim();
  if (!key) {
    throw new ModelUnavailableError(
      "jev",
      "TYPESAFE_API_KEY is required (or set AI_GATEWAY_API_KEY to use Gateway).",
    );
  }

  const client = new TypeSafeClient({ apiKey: key });

  return async ({ state, questions, signal }) => {
    signal.throwIfAborted();

    const response = await client.systemOne(
      {
        model: "jev-latest",
        state: state as { [key: string]: JsonValue },
        questions: Object.fromEntries(
          Object.entries(questions).map(([id, question]) => [
            id,
            {
              type: "choice" as const,
              instructions: question.instructions,
              criteria: question.criteria,
            },
          ]),
        ),
      },
      { signal },
    );

    return {
      answers: Object.fromEntries(
        Object.entries(questions).map(([id, question]) => {
          const answer = response.answers[id];
          if (
            !answer ||
            answer.type !== "choice" ||
            !Object.hasOwn(question.criteria, answer.choice)
          ) {
            throw new Error(
              `TypeSafe returned an invalid choice for question "${id}".`,
            );
          }
          return [
            id,
            {
              choice: answer.choice,
              confidence: answer.confidence,
            },
          ];
        }),
      ),
      usage: {
        inputTokens: response.usage?.input_tokens,
      },
    };
  };
}

/** Built-in Gateway evaluator when AI_GATEWAY_API_KEY / JEV_AI_GATEWAY_API_KEY is set. */
export function createGatewayEvaluator(
  apiKey = process.env.AI_GATEWAY_API_KEY ??
    process.env.JEV_AI_GATEWAY_API_KEY ??
    "",
): Experimental_CompositionEvaluator {
  return experimental_createEvaluator({
    model: "typesafe-ai/jev",
    apiKey,
  });
}

export function createEvaluator(): Experimental_CompositionEvaluator {
  if (process.env.TYPESAFE_API_KEY?.trim()) {
    return createTypeSafeEvaluator();
  }
  if (
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.JEV_AI_GATEWAY_API_KEY?.trim()
  ) {
    return createGatewayEvaluator();
  }
  throw new ModelUnavailableError(
    "jev",
    "Jev is unavailable — set TYPESAFE_API_KEY (preferred) or AI_GATEWAY_API_KEY / JEV_AI_GATEWAY_API_KEY.",
  );
}
