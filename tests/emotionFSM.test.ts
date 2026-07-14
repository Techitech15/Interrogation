import { describe, expect, it } from "vitest";
import {
  applyCorrectConfrontation,
  applyWrongConfrontation,
  clampScore,
  deriveEmotion,
} from "../src/core/emotionFSM";

describe("emotionFSM", () => {
  it("derives calm at score 0", () => {
    expect(deriveEmotion(0)).toBe("calm");
  });

  it("derives shaken once score reaches +2", () => {
    expect(deriveEmotion(2)).toBe("shaken");
    expect(deriveEmotion(3)).toBe("shaken");
  });

  it("derives hardened once score reaches -2", () => {
    expect(deriveEmotion(-2)).toBe("hardened");
    expect(deriveEmotion(-3)).toBe("hardened");
  });

  it("clamps score within [-3, 3]", () => {
    expect(clampScore(10)).toBe(3);
    expect(clampScore(-10)).toBe(-3);
  });

  it("correct confrontation moves score toward shaken", () => {
    expect(applyCorrectConfrontation(0)).toBe(1);
    expect(applyCorrectConfrontation(3)).toBe(3);
  });

  it("wrong confrontation moves score toward hardened", () => {
    expect(applyWrongConfrontation(0)).toBe(-1);
    expect(applyWrongConfrontation(-3)).toBe(-3);
  });
});
