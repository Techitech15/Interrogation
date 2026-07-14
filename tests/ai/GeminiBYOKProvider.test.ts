import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiBYOKProvider, RateLimitError } from "../../src/ai/GeminiBYOKProvider";
import { InvalidResponseError } from "../../src/ai/AIProvider";
import type { TestimonyRequest } from "../../src/ai/AIProvider";
import type { AiProfile, EmotionState } from "../../src/core/types";

function makeRequest(): TestimonyRequest {
  const aiProfile: AiProfile = {
    caseSummaryForAI: "あなたは殺人事件の容疑者です。",
    knownFactsForSuspect: ["被害者とは交際関係にあった"],
    liesToMaintain: ["事件当夜は会っていないと主張する"],
    bannedKeywords: ["包丁を洗った"],
  };
  return {
    aiProfile,
    emotionState: "calm" as EmotionState,
    disclosedEvidenceSummaries: [],
    recentTestimonies: [],
    playerUtterance: "事件当夜どこにいましたか",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiBYOKProvider", () => {
  it("isAvailable is true when apiKey is non-empty, false when empty", async () => {
    expect(await new GeminiBYOKProvider("some-key").isAvailable()).toBe(true);
    expect(await new GeminiBYOKProvider("").isAvailable()).toBe(false);
  });

  it("posts to the generateContent endpoint with the api key header and parses the response", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      );
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
      const body = JSON.parse(init.body as string);
      expect(body.generationConfig).toEqual({ responseMimeType: "application/json" });
      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ line: "自宅にいました。", emotionDelta: 0 }) }],
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiBYOKProvider("test-key");
    const result = await provider.generateTestimony(makeRequest());

    expect(result).toEqual({ lineText: "自宅にいました。", emotionDelta: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws RateLimitError on HTTP 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "rate limited" }, 429)),
    );

    const provider = new GeminiBYOKProvider("test-key");
    await expect(provider.generateTestimony(makeRequest())).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws InvalidResponseError when the response body is not valid TestimonyResponse JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          candidates: [{ content: { parts: [{ text: "not json" }] } }],
        }),
      ),
    );

    const provider = new GeminiBYOKProvider("test-key");
    await expect(provider.generateTestimony(makeRequest())).rejects.toBeInstanceOf(
      InvalidResponseError,
    );
  });
});
