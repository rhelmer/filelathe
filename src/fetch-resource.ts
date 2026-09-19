import { filenameFromUrl, isProbablyUrl } from "./resource-utils";

const MAX_BYTES = 15 * 1024 * 1024;

export type FetchedResource = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  /** Base64-encoded body (capped). */
  base64: string;
};

/** Server-side fetch for URL drops/pastes. Avoids browser CORS. */
export async function fetchRemoteResource(
  rawUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<FetchedResource> {
  const url = rawUrl.trim();
  if (!isProbablyUrl(url)) {
    throw new Error("Only http(s) URLs are supported.");
  }

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: options.signal ?? AbortSignal.timeout(30_000),
    headers: {
      Accept: "*/*",
      "User-Agent": "filelathe/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Remote resource is too large (${buffer.byteLength} bytes; max ${MAX_BYTES}).`,
    );
  }

  return {
    url,
    name: filenameFromUrl(url),
    mimeType,
    size: buffer.byteLength,
    base64: buffer.toString("base64"),
  };
}

export function fetchedToFile(resource: FetchedResource): File {
  const binary = atob(resource.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], resource.name, { type: resource.mimeType });
}
