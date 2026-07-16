import { defineConfig } from "vite";

// GitHub Pages serves this project from https://<owner>.github.io/Interrogation/,
// so production builds need that subpath as the base. Local dev keeps "/".
// Electron loads the built index.html via file://, where an absolute base
// like "/Interrogation/" cannot resolve, so `--mode electron` switches to a
// relative base instead. This must never change the default (Pages) path.
export default defineConfig(({ command, mode }) => ({
  root: ".",
  base: mode === "electron" ? "./" : command === "build" ? "/Interrogation/" : "/",
  build: {
    outDir: "dist",
  },
  test: {
    environment: "node",
  },
}));
