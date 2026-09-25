import { filenameFromUrl, isProbablyUrl } from "./resource-utils";
import {
  assertSafeFetchUrl,
  FetchResourceError,
} from "./safe-fetch-url";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 30_000;

export type FetchedResource = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  /** Base64-encoded body (capped). */
  base64: string;
};

export { FetchResourceError };

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** Exported for smoke tests — stream body and abort past maxBytes. */
export async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength != null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new FetchResourceError(
        `Remote resource is too large (max ${maxBytes} bytes).`,
      );
    }
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new FetchResourceError(
          `Remote resource is too large (max ${maxBytes} bytes).`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof FetchResourceError) throw error;
    throw new FetchResourceError("Could not fetch remote resource.", 502, {
      cause: error,
    });
  }

  return Buffer.concat(chunks);
}

/**
 * Server-side fetch for URL drops/pastes. Avoids browser CORS.
 * Blocks private / link-local / metadata targets and re-validates each redirect.
 */
export async function fetchRemoteResource(
  rawUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<FetchedResource> {
  const requested = rawUrl.trim();
  if (!isProbablyUrl(requested)) {
    throw new FetchResourceError("Only http(s) URLs are supported.");
  }

  const parentSignal = options.signal;
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal =
    parentSignal != null
      ? AbortSignal.any([parentSignal, timeout])
      : timeout;

  let current = await assertSafeFetchUrl(requested);
  const originalUrl = current.href;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          Accept: "*/*",
          "User-Agent": "filelathe/0.1",
        },
      });
    } catch (error) {
      if (error instanceof FetchResourceError) throw error;
      if (signal.aborted) {
        throw new FetchResourceError("Fetch timed out.", 504, { cause: error });
      }
      throw new FetchResourceError("Could not fetch remote resource.", 502, {
        cause: error,
      });
    }

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) {
        throw new FetchResourceError("Could not fetch remote resource.", 502);
      }
      let nextHref: string;
      try {
        nextHref = new URL(location, current).href;
      } catch (cause) {
        throw new FetchResourceError("Could not fetch remote resource.", 502, {
          cause,
        });
      }
      if (hop === MAX_REDIRECTS) {
        throw new FetchResourceError("Too many redirects.");
      }
      // Re-validate every hop (blocks open redirect → internal SSRF).
      current = await assertSafeFetchUrl(nextHref);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new FetchResourceError("Could not fetch remote resource.", 502);
    }

    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";
    const buffer = await readBodyCapped(response, MAX_BYTES);

    return {
      url: originalUrl,
      name: filenameFromUrl(originalUrl),
      mimeType,
      size: buffer.byteLength,
      base64: buffer.toString("base64"),
    };
  }

  throw new FetchResourceError("Too many redirects.");
}

export function fetchedToFile(resource: FetchedResource): File {
  const binary = atob(resource.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], resource.name, { type: resource.mimeType });
}
