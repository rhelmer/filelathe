import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { createServer as createViteServer } from "vite";
import {
  handleCompose,
  handleFetchResource,
  handleInventViewer,
} from "./server/handlers";

const port = Number(process.env.PORT ?? 5174);

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

      const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Filelathe</title>
    <meta
      name="description"
      content="Drop a file or paste a URL and get the right tool — or a json-render mini-app invented for formats nothing else handles."
    />
    <link rel="canonical" href="https://filelathe.com/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Filelathe" />
    <meta property="og:url" content="https://filelathe.com/" />
    <meta property="og:title" content="Filelathe" />
    <meta
      property="og:description"
      content="Swiss-army file utility: drop a file, get the right tool — or a mini-app invented for it. Built with json-render."
    />
    <meta property="og:image" content="https://filelathe.com/og.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Filelathe — swiss-army file utility" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Filelathe" />
    <meta
      name="twitter:description"
      content="Drop a file. Get the right tool — or a mini-app invented for it. Built with json-render."
    />
    <meta name="twitter:image" content="https://filelathe.com/og.png" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/filelathe-logo.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
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
