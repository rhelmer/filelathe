import { composeForFile } from "../compose-lib";
import {
  FetchResourceError,
  fetchRemoteResource,
} from "../fetch-resource";
import type { LoadedFile } from "../files";
import { inventViewerSpec } from "../invent-viewer";
import {
  catchApiError,
  errorResponse,
  jsonResponse,
  readJsonBody,
  withRateLimit,
} from "./http";

export async function handleFetchResource(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed", { code: "bad_request" });
  }

  return withRateLimit(request, "fetch", async () => {
    try {
      const body = await readJsonBody<{ url?: string }>(request);
      if (!body.url) {
        return errorResponse(400, "url is required", { code: "bad_request" });
      }
      const resource = await fetchRemoteResource(body.url, {
        signal: AbortSignal.timeout(30_000),
      });
      return jsonResponse(resource);
    } catch (error) {
      if (error instanceof FetchResourceError) {
        console.error(error);
        return errorResponse(error.status, error.message, {
          code: error.status >= 500 ? "internal" : "bad_request",
        });
      }
      return catchApiError(error);
    }
  });
}

export async function handleInventViewer(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed", { code: "bad_request" });
  }

  return withRateLimit(request, "invent", async () => {
    try {
      const body = await readJsonBody<{
        title?: string;
        filename?: string;
        mimeType?: string;
        size?: number;
        sampleText?: string | null;
        hexPreview?: string;
        sourceUrl?: string | null;
        prompt?: string;
      }>(request);

      if (!body.filename || !body.mimeType || body.hexPreview == null) {
        return errorResponse(
          400,
          "filename, mimeType, and hexPreview are required",
          { code: "bad_request" },
        );
      }

      const result = await inventViewerSpec(
        {
          title: body.title ?? body.filename,
          filename: body.filename,
          mimeType: body.mimeType,
          size: body.size ?? 0,
          sampleText: body.sampleText ?? null,
          hexPreview: body.hexPreview,
          sourceUrl: body.sourceUrl ?? null,
        },
        {
          signal: AbortSignal.timeout(90_000),
          prompt: body.prompt,
        },
      );
      return jsonResponse(result);
    } catch (error) {
      return catchApiError(error);
    }
  });
}

export async function handleCompose(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed", { code: "bad_request" });
  }

  return withRateLimit(request, "compose", async () => {
    try {
      const body = await readJsonBody<{ file?: LoadedFile }>(request);
      if (!body.file) {
        return errorResponse(400, "file is required", { code: "bad_request" });
      }
      const result = await composeForFile(body.file, {
        signal: AbortSignal.timeout(90_000),
      });
      return jsonResponse(result);
    } catch (error) {
      return catchApiError(error);
    }
  });
}
