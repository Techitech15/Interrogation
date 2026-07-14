import { describe, expect, it } from "vitest";
import {
  initAudio,
  isAudioReady,
  playSe,
  setMuted,
  startBgm,
  stopBgm,
} from "../../src/audio/engine";

// This suite runs under vitest's node environment (see vite.config.ts), where
// `window`/`AudioContext` do not exist. Every exported API must therefore be a
// safe no-op: no exceptions, no crashes, regardless of call order.

describe("audio engine no-op safety (node environment, no window/AudioContext)", () => {
  it("reports not ready before initAudio is ever called", () => {
    expect(isAudioReady()).toBe(false);
  });

  it("does not throw when playSe is called without initAudio", () => {
    expect(() => playSe("question_send")).not.toThrow();
    expect(() => playSe("confront_success")).not.toThrow();
  });

  it("does not throw when startBgm/stopBgm are called without initAudio", () => {
    expect(() => startBgm("interrogation")).not.toThrow();
    expect(() => stopBgm()).not.toThrow();
    expect(() => stopBgm(0)).not.toThrow();
    expect(() => stopBgm(2)).not.toThrow();
  });

  it("does not throw when setMuted is called without initAudio", () => {
    expect(() => setMuted(true)).not.toThrow();
    expect(() => setMuted(false)).not.toThrow();
  });

  it("does not throw when initAudio itself is called in a window-less environment", () => {
    expect(() => initAudio()).not.toThrow();
    // Since window/AudioContext are unavailable in node, initAudio must remain a no-op.
    expect(isAudioReady()).toBe(false);
  });

  it("remains a safe no-op for every SeName and BgmName after initAudio was attempted", () => {
    const seNames = [
      "question_send",
      "testimony_appear",
      "confront_select",
      "confront_success",
      "confront_fail",
      "clock_advance",
      "ending_true",
      "ending_bad",
      "ending_released",
    ] as const;
    const bgmNames = ["interrogation", "tension", "silence"] as const;

    for (const name of seNames) {
      expect(() => playSe(name)).not.toThrow();
    }
    for (const name of bgmNames) {
      expect(() => startBgm(name)).not.toThrow();
    }
    expect(() => stopBgm()).not.toThrow();
  });
});
