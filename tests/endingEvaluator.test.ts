import { describe, expect, it } from "vitest";
import { evaluateEnding } from "../src/core/endingEvaluator";
import type { GameState, Suspect, TestimonyEntry } from "../src/core/types";

const suspect: Suspect = {
  suspectId: "s1",
  name: "test",
  initialEmotion: "calm",
  truthTable: {},
  lieTable: [
    { lieId: "LIE-01", relatedTruthId: "TR-01", text: "", contradictingEvidenceIds: [] },
    { lieId: "LIE-02", relatedTruthId: "TR-02", text: "", contradictingEvidenceIds: [] },
  ],
};

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    caseId: "case-001",
    currentPhase: "interrogation",
    turn: 1,
    detentionRemainingMinutes: 1000,
    emotionState: "calm",
    emotionScore: 0,
    testimonyLog: [],
    disclosedEvidenceIds: [],
    wrongfulPressureCount: 0,
    endingId: null,
    ...overrides,
  };
}

function resolvedEntry(lieId: string): TestimonyEntry {
  return {
    turn: 1,
    questionId: "Q",
    text: "",
    lieId,
    emotionAtTime: "calm",
    contradictionResolved: true,
  };
}

describe("evaluateEnding", () => {
  it("returns null while conditions are unmet", () => {
    expect(evaluateEnding(baseState(), suspect, 3)).toBeNull();
  });

  it("returns true_confession once every lie has been resolved", () => {
    const state = baseState({
      testimonyLog: [resolvedEntry("LIE-01"), resolvedEntry("LIE-02")],
    });
    expect(evaluateEnding(state, suspect, 3)).toBe("true_confession");
  });

  it("returns released when time expires without a confession", () => {
    const state = baseState({ detentionRemainingMinutes: 0 });
    expect(evaluateEnding(state, suspect, 3)).toBe("released");
  });

  it("prioritizes wrongful_conviction over the other outcomes", () => {
    const state = baseState({
      wrongfulPressureCount: 3,
      testimonyLog: [resolvedEntry("LIE-01"), resolvedEntry("LIE-02")],
      detentionRemainingMinutes: 0,
    });
    expect(evaluateEnding(state, suspect, 3)).toBe("wrongful_conviction");
  });
});
