// Preload script, run in an isolated context (contextIsolation: true) before
// the renderer loads. Nothing needs to be exposed to the renderer yet -- the
// game currently talks to Gemini/Ollama directly via fetch() from the
// renderer -- so this is kept as a minimal scaffold for future use
// (e.g. exposing safe main-process APIs via contextBridge).
"use strict";

// const { contextBridge } = require("electron");
//
// contextBridge.exposeInMainWorld("jinmon", {
//   // placeholder for future main-process bridged APIs
// });
