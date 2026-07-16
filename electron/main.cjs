// Electron main process for 『尋問 -JINMON-』 (Steam distribution target).
// Plain CommonJS on purpose: this is the only Electron-specific file and does
// not warrant its own TypeScript build pipeline (see docs/detailed-design.md 2.3/9章P3).
"use strict";

const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const INDEX_HTML = path.join(__dirname, "..", "dist", "index.html");
const APP_ICON = path.join(__dirname, "..", "dist", "assets", "common", "app-icon-512.png");

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    icon: APP_ICON,
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // webSecurity is left at its default (enabled). If fetches to a local
      // Ollama instance (http://localhost:11434) fail from the file:// origin
      // due to CORS, the fix is on the Ollama side (OLLAMA_ORIGINS), not here
      // -- see README.md for details.
    },
  });

  win.loadFile(INDEX_HTML);

  // Keep all in-window navigation on the packaged app itself. Any attempt to
  // navigate to an external URL (e.g. the settings screen's Google AI Studio
  // link) is redirected to the OS default browser instead.
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // window.open()/target="_blank" links should also open externally rather
  // than spawning a new BrowserWindow inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  mainWindow = win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    // macOS: re-create a window when the dock icon is clicked and no other
    // windows are open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS apps conventionally stay running until the user quits explicitly
  // with Cmd+Q; every other platform quits once all windows are closed.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

module.exports = { createWindow };
