import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSettings, saveSettings, type Settings } from "../src/persistence/settingsStore";

// vite.config.ts runs this suite under vitest's node environment, where
// `localStorage` does not exist by default. Stub a minimal in-memory
// implementation for the round-trip/default-value cases, and explicitly
// remove it to exercise the "localStorage unavailable" no-throw path.

function createLocalStorageStub(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

describe("settingsStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageStub());
  });

  it("round-trips saved settings through loadSettings/saveSettings", () => {
    const settings: Settings = {
      geminiApiKey: "test-api-key-123",
      streamerMode: false,
      aiDialogueEnabled: true,
      muted: true,
    };

    saveSettings(settings);

    expect(loadSettings()).toEqual(settings);
  });

  it("returns default values when nothing has been stored yet", () => {
    expect(loadSettings()).toEqual({
      geminiApiKey: "",
      streamerMode: true,
      aiDialogueEnabled: false,
      muted: false,
    });
  });

  it("falls back to defaults (but keeps the separately-stored API key) when settings JSON is corrupted", () => {
    localStorage.setItem("jinmon.settings", "{ not valid json ]");
    localStorage.setItem("jinmon.apiKey.gemini", "leftover-key");

    const settings = loadSettings();

    expect(settings.streamerMode).toBe(true);
    expect(settings.aiDialogueEnabled).toBe(false);
    expect(settings.muted).toBe(false);
    expect(settings.geminiApiKey).toBe("leftover-key");
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.unstubAllGlobals();

    expect(() => loadSettings()).not.toThrow();
    expect(() =>
      saveSettings({
        geminiApiKey: "x",
        streamerMode: true,
        aiDialogueEnabled: false,
        muted: false,
      }),
    ).not.toThrow();
  });
});
