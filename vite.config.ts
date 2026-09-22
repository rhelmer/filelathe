import { createReadStream, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * chiptune3's hashed worklet still does `import './libopenmpt.worklet.js'`.
 * Vite emits the worklet into /assets/ but never copies that sibling, so
 * production/preview get SPA HTML (text/html) and addModule fails MIME check.
 */
function chiptuneLibopenmptAsset(): Plugin {
  const require = createRequire(import.meta.url);
  const libopenmpt = require.resolve("chiptune3/libopenmpt.worklet.js");
  const urlPath = "/assets/libopenmpt.worklet.js";

  function serve(
    reqUrl: string | undefined,
    res: import("node:http").ServerResponse,
  ) {
    const pathname = reqUrl?.split("?")[0];
    if (pathname !== urlPath) return false;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    createReadStream(libopenmpt).pipe(res);
    return true;
  }

  return {
    name: "chiptune-libopenmpt-asset",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serve(req.url, res)) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serve(req.url, res)) next();
      });
    },
    closeBundle() {
      const outDir = path.resolve(rootDir, "dist/assets");
      mkdirSync(outDir, { recursive: true });
      const dest = path.join(outDir, "libopenmpt.worklet.js");
      copyFileSync(libopenmpt, dest);
      if (!existsSync(dest)) {
        throw new Error(`Failed to copy libopenmpt worklet to ${dest}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), chiptuneLibopenmptAsset()],
  root: ".",
  clearScreen: false,
  assetsInclude: ["**/*.wasm"],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        modRender: "mod-render.html",
      },
    },
  },
  optimizeDeps: {
    exclude: ["chiptune3", "pptx-wasm"],
  },
  worker: {
    format: "es",
  },
});
