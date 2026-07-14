import { describe, expect, it } from "vitest";
import { consumeDetentionTime } from "./detentionClock";

describe("consumeDetentionTime", () => {
  it("指定時間を消費する", () => {
    expect(consumeDetentionTime(100, 30)).toBe(70);
  });

  it("0を跨いでも負数にしない", () => {
    expect(consumeDetentionTime(30, 120)).toBe(0);
  });

  it("不正な入力を拒否する", () => {
    expect(() => consumeDetentionTime(-1, 30)).toThrow();
    expect(() => consumeDetentionTime(30, -1)).toThrow();
  });
});
