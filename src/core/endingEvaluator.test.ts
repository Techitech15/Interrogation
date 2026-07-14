import { describe, expect, it } from "vitest";
import { loadCase001 } from "../data/loadCase";
import { createInitialGameState } from "./store";
import { evaluateEnding } from "./endingEvaluator";

describe("evaluateEnding", () => {
  const bundle = loadCase001();
  const allLieIds = bundle.suspect.lieTable.map((lie) => lie.lieId);

  it("冤罪を自白と期限切れより優先する", () => {
    const state = {
      ...createInitialGameState(bundle),
      falseConfessionTriggered: true,
      resolvedLieIds: [...allLieIds],
      detentionRemainingMinutes: 0,
    };
    expect(evaluateEnding(state, allLieIds)).toBe("wrongful_conviction");
  });

  it("全嘘解消を期限切れより優先する", () => {
    const state = {
      ...createInitialGameState(bundle),
      resolvedLieIds: [...allLieIds],
      detentionRemainingMinutes: 0,
    };
    expect(evaluateEnding(state, allLieIds)).toBe("true_confession");
  });

  it("他条件なしの期限切れを釈放にする", () => {
    const state = {
      ...createInitialGameState(bundle),
      detentionRemainingMinutes: 0,
    };
    expect(evaluateEnding(state, allLieIds)).toBe("released");
  });
});
