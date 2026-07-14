import { describe, expect, it } from "vitest";
import { DEFAULT_RESPONSE_TEXT_ID, resolveDialogue } from "../src/core/dialogueResolver";
import type { Question } from "../src/core/types";

const question: Question = {
  questionId: "Q-TEST",
  category: "test",
  label: "テスト質問",
  freeTextKeywords: ["テスト"],
  responseTable: [
    { emotion: "calm", disclosedEvidence: ["EV-99"], responseTextId: "RESP-SPECIAL" },
    { emotion: "calm", disclosedEvidence: [], lieId: "LIE-01" },
    { emotion: "shaken", disclosedEvidence: [], lieId: "LIE-01" },
    { emotion: "hardened", disclosedEvidence: [], responseTextId: "RESP-REFUSE-01" },
  ],
};

describe("resolveDialogue", () => {
  it("picks the first matching rule by emotion", () => {
    const result = resolveDialogue(question, "calm", []);
    expect(result.lieId).toBe("LIE-01");
  });

  it("requires all listed evidence to be disclosed before an evidence-gated rule wins", () => {
    const withoutEvidence = resolveDialogue(question, "calm", []);
    expect(withoutEvidence.responseTextId).not.toBe("RESP-SPECIAL");

    const withEvidence = resolveDialogue(question, "calm", ["EV-99"]);
    expect(withEvidence.responseTextId).toBe("RESP-SPECIAL");
  });

  it("falls back to the default response text when nothing matches", () => {
    const noRuleQuestion: Question = { ...question, responseTable: [] };
    const result = resolveDialogue(noRuleQuestion, "calm", []);
    expect(result.responseTextId).toBe(DEFAULT_RESPONSE_TEXT_ID);
    expect(result.lieId).toBeNull();
  });
});
