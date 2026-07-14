import { describe, expect, it } from "vitest";
import { judgeContradiction } from "../src/core/contradictionJudge";
import type { LieEntry, TestimonyEntry } from "../src/core/types";

const lieTable: LieEntry[] = [
  {
    lieId: "LIE-01",
    relatedTruthId: "TR-01",
    text: "嘘の供述",
    contradictingEvidenceIds: ["EV-03"],
    requiredEmotionNotIn: ["hardened"],
  },
];

function makeTestimony(overrides: Partial<TestimonyEntry> = {}): TestimonyEntry {
  return {
    turn: 1,
    questionId: "Q-ALIBI-01",
    text: "嘘の供述",
    lieId: "LIE-01",
    emotionAtTime: "calm",
    contradictionResolved: false,
    ...overrides,
  };
}

describe("judgeContradiction", () => {
  it("succeeds when the correct evidence is presented", () => {
    expect(judgeContradiction(makeTestimony(), "EV-03", lieTable, "calm")).toBe(true);
  });

  it("fails when the wrong evidence is presented", () => {
    expect(judgeContradiction(makeTestimony(), "EV-01", lieTable, "calm")).toBe(false);
  });

  it("fails when the suspect's emotion is in the excluded state", () => {
    expect(judgeContradiction(makeTestimony(), "EV-03", lieTable, "hardened")).toBe(false);
  });

  it("fails when the testimony has no associated lie", () => {
    expect(judgeContradiction(makeTestimony({ lieId: undefined }), "EV-03", lieTable, "calm")).toBe(
      false,
    );
  });

  it("fails when the testimony is already resolved", () => {
    expect(
      judgeContradiction(makeTestimony({ contradictionResolved: true }), "EV-03", lieTable, "calm"),
    ).toBe(false);
  });
});
