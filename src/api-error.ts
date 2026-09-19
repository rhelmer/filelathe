/** Structured API error codes shared by server responses and the client. */

export type ApiErrorCode =
  | "rate_limit"
  | "blocked"
  | "model_unavailable"
  | "bad_request"
  | "internal";

export type ApiErrorBody = {
  error: string;
  code?: ApiErrorCode;
  retryAfter?: number;
  model?: "jev" | "haiku";
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfter: number | null;
  readonly model: "jev" | "haiku" | null;

  constructor(
    message: string,
    options: {
      status: number;
      code?: ApiErrorCode;
      retryAfter?: number | null;
      model?: "jev" | "haiku" | null;
    },
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.code ?? "internal";
    this.retryAfter = options.retryAfter ?? null;
    this.model = options.model ?? null;
  }
}

export async function readApiError(
  response: Response,
): Promise<ApiRequestError> {
  const retryHeader = response.headers.get("Retry-After");
  const retryFromHeader = retryHeader ? Number(retryHeader) : NaN;
  let body: ApiErrorBody = { error: response.statusText || "Request failed" };
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // keep statusText
  }

  const code: ApiErrorCode =
    body.code ??
    (response.status === 429
      ? "rate_limit"
      : response.status === 403
        ? "blocked"
        : response.status === 503
          ? "model_unavailable"
          : "internal");

  const retryAfter =
    typeof body.retryAfter === "number" && Number.isFinite(body.retryAfter)
      ? body.retryAfter
      : Number.isFinite(retryFromHeader)
        ? retryFromHeader
        : null;

  return new ApiRequestError(body.error || response.statusText, {
    status: response.status,
    code,
    retryAfter,
    model: body.model ?? null,
  });
}

/** User-facing toast copy for API failures. */
export function toastMessageForApiError(error: unknown): {
  title: string;
  description: string;
  variant: "error" | "warning";
} {
  if (error instanceof ApiRequestError) {
    if (error.code === "rate_limit") {
      return {
        title: "Slow down",
        description: error.message,
        variant: "warning",
      };
    }
    if (error.code === "blocked") {
      return {
        title: "Temporarily blocked",
        description: error.message,
        variant: "error",
      };
    }
    if (error.code === "model_unavailable") {
      const which =
        error.model === "haiku"
          ? "Haiku"
          : error.model === "jev"
            ? "Jev"
            : "AI backend";
      return {
        title: `${which} unavailable`,
        description: error.message,
        variant: "error",
      };
    }
    return {
      title: "Request failed",
      description: error.message,
      variant: "error",
    };
  }
  return {
    title: "Something went wrong",
    description: error instanceof Error ? error.message : String(error),
    variant: "error",
  };
}
