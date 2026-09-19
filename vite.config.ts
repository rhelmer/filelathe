import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  clearScreen: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ["chiptune3"],
  },
  worker: {
    format: "es",
  },
});
