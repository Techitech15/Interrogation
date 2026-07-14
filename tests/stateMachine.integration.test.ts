import { describe, expect, it } from "vitest";
import {
  askScriptedQuestion,
  confront,
  createInitialGameState,
  startInterrogation,
} from "../src/core/stateMachine";
import { loadCase } from "../src/data/caseLoader";

describe("case-001 full playthrough", () => {
  it("reaches true_confession by resolving every lie with the right evidence", () => {
    const bundle = loadCase("case-001");
    let state = startInterrogation(createInitialGameState(bundle));

    state = askScriptedQuestion(state, bundle, "Q-ALIBI-01");
    const alibiTurn = state.testimonyLog.at(-1)!.turn;
    state = confront(state, bundle, alibiTurn, "EV-03");
    expect(state.testimonyLog.find((t) => t.turn === alibiTurn)?.contradictionResolved).toBe(true);

    state = askScriptedQuestion(state, bundle, "Q-WEAPON-01");
    const weaponTurn = state.testimonyLog.at(-1)!.turn;
    state = confront(state, bundle, weaponTurn, "EV-01");

    expect(state.currentPhase).toBe("ending");
    expect(state.endingId).toBe("true_confession");
  });

  it("reaches wrongful_conviction after repeated wrong confrontations", () => {
    const bundle = loadCase("case-001");
    let state = startInterrogation(createInitialGameState(bundle));

    for (let i = 0; i < bundle.case.wrongfulPressureThreshold; i++) {
      state = askScriptedQuestion(state, bundle, "Q-ALIBI-01");
      const turn = state.testimonyLog.at(-1)!.turn;
      // EV-01 does not contradict LIE-01, so this confrontation is always wrong.
      state = confront(state, bundle, turn, "EV-01");
    }

    expect(state.currentPhase).toBe("ending");
    expect(state.endingId).toBe("wrongful_conviction");
  });

  it("reaches released once the detention clock runs out without a confession", () => {
    const bundle = loadCase("case-001");
    let state = startInterrogation(createInitialGameState(bundle));

    // Chitchat never resolves a lie and steadily drains the clock.
    let guard = 0;
    while (state.currentPhase === "interrogation" && guard < 200) {
      state = askScriptedQuestion(state, bundle, "Q-CHITCHAT-01");
      guard++;
    }

    expect(guard).toBeLessThan(200);
    expect(state.currentPhase).toBe("ending");
    expect(state.endingId).toBe("released");
  });
});
