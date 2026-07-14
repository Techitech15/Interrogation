import { describe, expect, it } from "vitest";
import {
  applyCorrectConfrontation,
  applyIncorrectConfrontation,
  emotionStateFromScore,
} from "./emotionFSM";

describe("emotionFSM", () => {
  it("スコアを3状態へ一意に写像する", () => {
    expect(emotionStateFromScore(-3)).toBe("hardened");
    expect(emotionStateFromScore(0)).toBe("calm");
    expect(emotionStateFromScore(3)).toBe("shaken");
  });

  it("正解は現在値にかかわらずshaken側へ回復させる", () => {
    expect(applyCorrectConfrontation(-3)).toBe(1);
    expect(applyCorrectConfrontation(0)).toBe(1);
    expect(applyCorrectConfrontation(3)).toBe(3);
  });

  it("誤りは現在値にかかわらずhardened側へ動かす", () => {
    expect(applyIncorrectConfrontation(3)).toBe(-1);
    expect(applyIncorrectConfrontation(0)).toBe(-1);
    expect(applyIncorrectConfrontation(-3)).toBe(-3);
  });
});
