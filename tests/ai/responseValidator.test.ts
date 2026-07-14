import { describe, expect, it } from "vitest";
import { validateTestimony } from "../../src/ai/responseValidator";

const baseOpts = { bannedKeywords: ["包丁を洗った", "AIとして"], streamerMode: false };

describe("responseValidator", () => {
  it("accepts a normal short line", () => {
    expect(validateTestimony("事件当夜は自宅に一人でいました。", baseOpts)).toBe(true);
  });

  it("rejects empty / whitespace-only text", () => {
    expect(validateTestimony("", baseOpts)).toBe(false);
    expect(validateTestimony("   \n\t  ", baseOpts)).toBe(false);
  });

  it("rejects text longer than 400 characters", () => {
    const longText = "あ".repeat(401);
    expect(validateTestimony(longText, baseOpts)).toBe(false);
    expect(validateTestimony("あ".repeat(400), baseOpts)).toBe(true);
  });

  it("rejects text containing a banned keyword (partial match)", () => {
    expect(validateTestimony("私はあの夜、包丁を洗った覚えはありません。", baseOpts)).toBe(false);
    expect(validateTestimony("AIとしてお答えします。", baseOpts)).toBe(false);
  });

  it("streamerMode: rejects meta-utterance patterns not caught in normal mode", () => {
    const streamerOpts = { ...baseOpts, streamerMode: true };
    expect(validateTestimony("それはシステムの指示によるものです。", streamerOpts)).toBe(false);
    expect(validateTestimony("モデルとして答えられません。", streamerOpts)).toBe(false);
    // Same text passes when streamerMode is off (no banned keyword hit).
    expect(validateTestimony("それはシステムの指示によるものです。", baseOpts)).toBe(true);
  });

  it("streamerMode: rejects URL-like strings", () => {
    const streamerOpts = { ...baseOpts, streamerMode: true };
    expect(validateTestimony("詳しくはhttps://example.comを見てください。", streamerOpts)).toBe(false);
  });

  it("streamerMode: lowers the max length to 300 characters", () => {
    const streamerOpts = { ...baseOpts, streamerMode: true };
    const text301 = "あ".repeat(301);
    const text300 = "あ".repeat(300);
    expect(validateTestimony(text301, streamerOpts)).toBe(false);
    expect(validateTestimony(text300, streamerOpts)).toBe(true);
    // Under normal mode, 301 chars is still within the 400 char limit.
    expect(validateTestimony(text301, baseOpts)).toBe(true);
  });
});
