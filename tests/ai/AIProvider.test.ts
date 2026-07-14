import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "../../src/ai/AIProvider";
import type { TestimonyRequest } from "../../src/ai/AIProvider";
import caseAiProfile from "../../src/data/cases/case-001/aiProfile.json";
import type { AiProfile } from "../../src/core/types";

function makeRequest(): TestimonyRequest {
  return {
    aiProfile: caseAiProfile as AiProfile,
    emotionState: "shaken",
    disclosedEvidenceSummaries: ["防犯カメラの時刻表示"],
    recentTestimonies: ["23時には家にいました"],
    playerUtterance: "本当に21時に会っていないんですか",
  };
}

describe("buildSystemPrompt", () => {
  it("includes knownFactsForSuspect, liesToMaintain, emotion state and disclosed evidence", () => {
    const prompt = buildSystemPrompt(makeRequest());

    expect(prompt).toContain("被害者とは交際関係にあった");
    expect(prompt).toContain("事件当夜は被害者に会っておらず");
    expect(prompt).toContain("shaken");
    expect(prompt).toContain("防犯カメラの時刻表示");
    expect(prompt).toContain("23時には家にいました");
  });

  it("instructs the model to stay within given facts and output structured JSON only", () => {
    const prompt = buildSystemPrompt(makeRequest());
    expect(prompt).toMatch(/新しい虚偽の事実を作らない/);
    expect(prompt).toContain('"line"');
    expect(prompt).toContain('"emotionDelta"');
  });

  it("never leaks truth-table style identifiers (TR-*), since TestimonyRequest has no truthTable field", () => {
    const prompt = buildSystemPrompt(makeRequest());
    // TestimonyRequest.aiProfile is typed as AiProfile, which structurally excludes
    // Suspect.truthTable — this test locks that in at the prompt-string level too.
    expect(prompt).not.toMatch(/TR-\d/);
  });
});

describe("buildUserPrompt", () => {
  it("passes through the player utterance verbatim", () => {
    expect(buildUserPrompt(makeRequest())).toBe("本当に21時に会っていないんですか");
  });
});
