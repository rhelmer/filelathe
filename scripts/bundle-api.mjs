import * as esbuild from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "api");

const entries = ["compose", "invent-viewer", "fetch-resource"];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const name of entries) {
  const outfile = join(outDir, `${name}.js`);
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [join(root, "src/api-entries", `${name}.ts`)],
    outfile,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    logLevel: "info",
    packages: "bundle",
  });
}

console.log(`Bundled ${entries.length} API routes → api/`);
