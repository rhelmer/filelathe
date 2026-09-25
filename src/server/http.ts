import type { ApiErrorBody, ApiErrorCode } from "../api-error";
import { isModelUnavailableError } from "./model-errors";
import {
  clientKeyFromHeaders,
  enforceRateLimit,
  type RateLimitBucket,
} from "./rate-limit";

export function jsonResponse(
  body: unknown,
  init: {
    status?: number;
    headers?: Record<string, string>;
  } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export function errorResponse(
  status: number,
  error: string,
  options: {
    code?: ApiErrorCode;
    retryAfter?: number;
    model?: "jev" | "haiku";
  } = {},
): Response {
  const body: ApiErrorBody = {
    error,
    code: options.code,
    retryAfter: options.retryAfter,
    model: options.model,
  };
  const headers: Record<string, string> = {};
  if (typeof options.retryAfter === "number") {
    headers["Retry-After"] = String(options.retryAfter);
  }
  return jsonResponse(body, { status, headers });
}

export async function withRateLimit(
  request: Request,
  bucket: RateLimitBucket,
  handler: () => Promise<Response>,
): Promise<Response> {
  // Browsers send Sec-Fetch-Site on navigations and fetch. Reject cross-site
  // form POSTs that would otherwise burn invent/compose quotas for the victim IP.
  const site = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (site === "cross-site") {
    return errorResponse(403, "Cross-site requests are not allowed.", {
      code: "blocked",
    });
  }

  const clientKey = clientKeyFromHeaders(request.headers);
  const limit = await enforceRateLimit(bucket, clientKey);
  if (limit.pending) {
    // Best-effort: fire-and-forget when waitUntil is unavailable (local Node).
    void limit.pending.catch(() => undefined);
  }
  if (!limit.allowed) {
    return errorResponse(limit.status, limit.error, {
      code: limit.code,
      retryAfter: limit.retryAfter,
    });
  }
  return handler();
}

export function catchApiError(error: unknown): Response {
  if (isModelUnavailableError(error)) {
    return errorResponse(503, error.message, {
      code: "model_unavailable",
      model: error.model,
    });
  }
  console.error(error);
  return errorResponse(
    500,
    error instanceof Error ? error.message : String(error),
    { code: "internal" },
  );
}

/** Compose payloads include HTML snapshots up to ~500KB; reject the rest. */
export const MAX_JSON_BODY_CHARS = 1_500_000;

export async function readJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text) return {} as T;
  if (text.length > MAX_JSON_BODY_CHARS) {
    throw new Error(
      `Request body is too large (${text.length} chars; max ${MAX_JSON_BODY_CHARS}).`,
    );
  }
  return JSON.parse(text) as T;
}
