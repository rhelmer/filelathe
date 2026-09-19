/** Typed errors for missing / failing AI backends. */

export class ModelUnavailableError extends Error {
  readonly model: "jev" | "haiku";
  readonly status = 503;
  readonly code = "model_unavailable" as const;

  constructor(model: "jev" | "haiku", message: string) {
    super(message);
    this.name = "ModelUnavailableError";
    this.model = model;
  }
}

export function isModelUnavailableError(
  error: unknown,
): error is ModelUnavailableError {
  return error instanceof ModelUnavailableError;
}
