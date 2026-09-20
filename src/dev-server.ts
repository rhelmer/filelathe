import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import {
  handleCompose,
  handleFetchResource,
  handleInventViewer,
} from "./server/handlers";

const port = Number(process.env.PORT ?? 5174);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");

const vite = await createViteServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { middlewareMode: true },
  appType: "custom",
});

function nodeHeadersToHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

async function readBody(req: IncomingMessage): Promise<ArrayBuffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const buf = Buffer.concat(chunks);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `localhost:${port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);
  const body = await readBody(req);
  return new Request(url, {
    method: req.method,
    headers: nodeHeadersToHeaders(req),
    body: body && (body as ArrayBuffer).byteLength > 0 ? body : undefined,
    // @ts-expect-error Node undici duplex for request bodies
    duplex: body ? "half" : undefined,
  });
}

async function writeWebResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

async function handleApi(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const request = await toWebRequest(req);

  let response: Response;
  if (url.pathname === "/api/fetch-resource") {
    response = await handleFetchResource(request);
  } else if (url.pathname === "/api/invent-viewer") {
    response = await handleInventViewer(request);
  } else if (url.pathname === "/api/compose") {
    response = await handleCompose(request);
  } else {
    response = new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  await writeWebResponse(res, response);
}

/** Map URL paths to public/ files (Vite does not auto-serve directory indexes). */
async function resolvePublicFile(
  pathname: string,
): Promise<{ filePath: string; contentType: string } | null> {
  const clean = pathname.split("?")[0] ?? pathname;
  const candidates: Array<{ rel: string; type: string }> = [];

  if (clean === "/robots.txt") {
    candidates.push({ rel: "robots.txt", type: "text/plain; charset=utf-8" });
  } else if (clean === "/sitemap.xml") {
    candidates.push({
      rel: "sitemap.xml",
      type: "application/xml; charset=utf-8",
    });
  } else if (clean === "/seo.css") {
    candidates.push({ rel: "seo.css", type: "text/css; charset=utf-8" });
  } else if (
    clean === "/open" ||
    clean.startsWith("/open/") ||
    clean === "/formats" ||
    clean.startsWith("/formats/") ||
    clean === "/guides" ||
    clean.startsWith("/guides/")
  ) {
    const base = clean.endsWith("/") ? clean.slice(0, -1) : clean;
    candidates.push(
      { rel: `${base.slice(1)}/index.html`, type: "text/html; charset=utf-8" },
      { rel: `${base.slice(1)}.html`, type: "text/html; charset=utf-8" },
    );
  }

  for (const candidate of candidates) {
    const filePath = path.join(publicDir, candidate.rel);
    if (!filePath.startsWith(publicDir)) continue;
    try {
      await access(filePath);
      return { filePath, contentType: candidate.type };
    } catch {
      // try next
    }
  }
  return null;
}

const server = createServer((req, res) => {
  if (req.url?.startsWith("/api/")) {
    handleApi(req, res).catch((error) => {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          code: "internal",
        }),
      );
    });
    return;
  }

  vite.middlewares(req, res, async () => {
    try {
      const pageUrl = req.url ?? "/";
      const pathname = new URL(pageUrl, "http://localhost").pathname;

      // Dedicated chiptune decode page for social demo capture (not the SPA shell).
      if (pathname === "/mod-render.html") {
        const raw = await readFile(
          new URL("../mod-render.html", import.meta.url),
          "utf8",
        );
        const html = await vite.transformIndexHtml(pageUrl, raw);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.end(html);
        return;
      }

      const pub = await resolvePublicFile(pathname);
      if (pub) {
        const body = await readFile(pub.filePath);
        res.statusCode = 200;
        res.setHeader("Content-Type", pub.contentType);
        res.end(body);
        return;
      }

      const template = await readFile(
        new URL("../index.html", import.meta.url),
        "utf8",
      );
      const html = await vite.transformIndexHtml(pageUrl, template);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : String(error));
    }
  });
});

server.listen(port, () => {
  console.log(`Filelathe: http://localhost:${port}`);
});
