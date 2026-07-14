import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaLocalProvider } from "../../src/ai/OllamaLocalProvider";
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

describe("OllamaLocalProvider", () => {
  it("isAvailable returns true when GET /api/tags responds 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toBe("http://localhost:11434/api/tags");
        return jsonResponse({ models: [] });
      }),
    );

    expect(await new OllamaLocalProvider().isAvailable()).toBe(true);
  });

  it("isAvailable returns false when fetch throws (connection refused / timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );

    expect(await new OllamaLocalProvider().isAvailable()).toBe(false);
  });

  it("isAvailable returns false on non-200 status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, 500)),
    );

    expect(await new OllamaLocalProvider().isAvailable()).toBe(false);
  });

  it("posts to /api/chat with format json and parses message.content", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("http://localhost:11434/api/chat");
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe("qwen3");
      expect(body.stream).toBe(false);
      expect(body.format).toBe("json");
      expect(body.messages).toHaveLength(2);
      return jsonResponse({
        message: { content: JSON.stringify({ line: "特にありません。", emotionDelta: -1 }) },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OllamaLocalProvider();
    const result = await provider.generateTestimony(makeRequest());

    expect(result).toEqual({ lineText: "特にありません。", emotionDelta: -1 });
  });

  it("throws InvalidResponseError when message.content is not valid TestimonyResponse JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: { content: "not json" } })),
    );

    const provider = new OllamaLocalProvider();
    await expect(provider.generateTestimony(makeRequest())).rejects.toBeInstanceOf(
      InvalidResponseError,
    );
  });
});
