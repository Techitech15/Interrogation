import { defineConfig } from "vite";

// GitHub Pages serves this project from https://<owner>.github.io/Interrogation/,
// so production builds need that subpath as the base. Local dev keeps "/".
export default defineConfig(({ command }) => ({
  root: ".",
  base: command === "build" ? "/Interrogation/" : "/",
  build: {
    outDir: "dist",
  },
  test: {
    environment: "node",
  },
}));
