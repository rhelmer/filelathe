import { composeForFile } from "../compose-lib";
import type { LoadedFile } from "../files";
import { inventViewerSpec } from "../invent-viewer";
import {
  catchApiError,
  errorResponse,
  jsonResponse,
  readJsonBody,
  withRateLimit,
} from "./http";

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
          title: (body.title ?? body.filename).slice(0, 300),
          filename: body.filename.slice(0, 300),
          mimeType: body.mimeType.slice(0, 200),
          size: body.size ?? 0,
          sampleText: body.sampleText?.slice(0, 8_000) ?? null,
          hexPreview: body.hexPreview.slice(0, 4_000),
          sourceUrl: body.sourceUrl?.slice(0, 2_000) ?? null,
        },
        {
          signal: AbortSignal.timeout(90_000),
          prompt: body.prompt?.slice(0, 24_000),
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
