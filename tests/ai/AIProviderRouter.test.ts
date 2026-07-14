import { describe, expect, it, vi } from "vitest";
import type { AIProvider, TestimonyRequest, TestimonyResponse } from "../../src/ai/AIProvider";
import { InvalidResponseError } from "../../src/ai/AIProvider";
import { RateLimitError } from "../../src/ai/GeminiBYOKProvider";
import { AIProviderRouter } from "../../src/ai/AIProviderRouter";
import type { AiProfile, EmotionState } from "../../src/core/types";

function makeAiProfile(overrides: Partial<AiProfile> = {}): AiProfile {
  return {
    caseSummaryForAI: "あなたは殺人事件の容疑者です。",
    knownFactsForSuspect: ["被害者とは交際関係にあった"],
    liesToMaintain: ["事件当夜は会っていないと主張する"],
    bannedKeywords: ["包丁を洗った", "私が殺しました"],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<TestimonyRequest> = {}): TestimonyRequest {
  return {
    aiProfile: makeAiProfile(),
    emotionState: "calm" as EmotionState,
    disclosedEvidenceSummaries: [],
    recentTestimonies: [],
    playerUtterance: "事件当夜どこにいましたか",
    ...overrides,
  };
}

/** テスト用のモックAIProvider。振る舞いを注入できる。 */
class MockProvider implements AIProvider {
  readonly layer: "B" | "C";
  available: boolean;
  generateTestimony: (req: TestimonyRequest) => Promise<TestimonyResponse>;

  constructor(
    layer: "B" | "C",
    available: boolean,
    generateTestimony: (req: TestimonyRequest) => Promise<TestimonyResponse>,
  ) {
    this.layer = layer;
    this.available = available;
    this.generateTestimony = generateTestimony;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }
}

describe("AIProviderRouter", () => {
  it("returns the provider's response on success", async () => {
    const provider = new MockProvider("B", true, async () => ({
      lineText: "特に何も覚えていません。",
      emotionDelta: 0,
    }));
    const router = new AIProviderRouter([provider], { streamerMode: true });

    const result = await router.generateTestimony(makeRequest());

    expect(result).toEqual({
      response: { lineText: "特に何も覚えていません。", emotionDelta: 0 },
      usedLayer: "B",
      fallbackReason: null,
    });
  });

  it("retries 429s with exponential backoff and falls back after 3 retries", async () => {
    let callCount = 0;
    const provider = new MockProvider("B", true, async () => {
      callCount += 1;
      throw new RateLimitError();
    });

    const sleeper = vi.fn(async (_ms: number) => {});
    const router = new AIProviderRouter([provider], { streamerMode: true, sleeper });

    const result = await router.generateTestimony(makeRequest());

    expect(result).toEqual({ response: null, usedLayer: null, fallbackReason: "rate_limit" });
    // initial attempt + 3 retries = 4 calls total
    expect(callCount).toBe(4);
    expect(sleeper).toHaveBeenCalledTimes(3);
    expect(sleeper).toHaveBeenNthCalledWith(1, 1000);
    expect(sleeper).toHaveBeenNthCalledWith(2, 2000);
    expect(sleeper).toHaveBeenNthCalledWith(3, 4000);
  });

  it("maps invalid JSON / malformed response errors to invalid_response", async () => {
    const provider = new MockProvider("B", true, async () => {
      throw new InvalidResponseError("bad json");
    });
    const router = new AIProviderRouter([provider], { streamerMode: true });

    const result = await router.generateTestimony(makeRequest());

    expect(result).toEqual({ response: null, usedLayer: null, fallbackReason: "invalid_response" });
  });

  it("maps other/network exceptions to network", async () => {
    const provider = new MockProvider("B", true, async () => {
      throw new Error("fetch failed");
    });
    const router = new AIProviderRouter([provider], { streamerMode: true });

    const result = await router.generateTestimony(makeRequest());

    expect(result).toEqual({ response: null, usedLayer: null, fallbackReason: "network" });
  });

  it("falls back with validation_failed when the response fails the whitelist check", async () => {
    const provider = new MockProvider("B", true, async () => ({
      lineText: "私が殺しました。",
      emotionDelta: 1,
    }));
    const router = new AIProviderRouter([provider], { streamerMode: true });

    const result = await router.generateTestimony(makeRequest());

    expect(result).toEqual({ response: null, usedLayer: null, fallbackReason: "validation_failed" });
  });

  it("skips an unavailable provider and uses the next one", async () => {
    const unavailable = new MockProvider("C", false, async () => {
      throw new Error("should not be called");
    });
    const available = new MockProvider("B", true, async () => ({
      lineText: "はい、その通りです。",
      emotionDelta: 0,
    }));

    const router = new AIProviderRouter([unavailable, available], { streamerMode: true });
    const result = await router.generateTestimony(makeRequest());

    expect(result).toEqual({
      response: { lineText: "はい、その通りです。", emotionDelta: 0 },
      usedLayer: "B",
      fallbackReason: null,
    });
  });

  it("falls back with network reason when no provider is available", async () => {
    const unavailable1 = new MockProvider("B", false, async () => {
      throw new Error("should not be called");
    });
    const unavailable2 = new MockProvider("C", false, async () => {
      throw new Error("should not be called");
    });

    const router = new AIProviderRouter([unavailable1, unavailable2], { streamerMode: true });
    const result = await router.generateTestimony(makeRequest());

    expect(result).toEqual({ response: null, usedLayer: null, fallbackReason: "network" });
  });
});
