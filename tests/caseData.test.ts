// 全事件データの機械検証。
// (1) 参照整合性(caseValidator)、(2) 自動攻略ソルバーでtrue_confessionに実際に到達できること。
// 事件をJSON追加した時点でこのテストが自動的にその事件も検証する。
import { describe, expect, it } from "vitest";
import { listCases, loadCase } from "../src/data/caseLoader";
import { validateCaseBundle } from "../src/data/caseValidator";
import {
  askScriptedQuestion,
  confront,
  createInitialGameState,
  startInterrogation,
} from "../src/core/stateMachine";
import type { CaseBundle, GameState } from "../src/core/types";

/**
 * 汎用ソルバー: 未解決の嘘ごとに「現在の感情状態でその嘘を引き出せる質問」を探して
 * 質問→正しい証拠で追及、を繰り返す。正規のプレイ操作のみを使う。
 */
function solveToConfession(bundle: CaseBundle): GameState {
  let state = startInterrogation(createInitialGameState(bundle));
  let guard = 0;

  while (state.currentPhase === "interrogation" && guard < 100) {
    guard++;

    const unresolvedLie = bundle.suspect.lieTable.find(
      (lie) =>
        !state.testimonyLog.some((t) => t.lieId === lie.lieId && t.contradictionResolved) &&
        !(lie.requiredEmotionNotIn ?? []).includes(state.emotionState),
    );
    if (!unresolvedLie) break;

    const question = bundle.questions.find((q) =>
      q.responseTable.some(
        (r) =>
          r.lieId === unresolvedLie.lieId &&
          r.emotion === state.emotionState &&
          r.disclosedEvidence.every((id) => state.disclosedEvidenceIds.includes(id)),
      ),
    );
    if (!question) break;

    state = askScriptedQuestion(state, bundle, question.questionId);
    if (state.currentPhase !== "interrogation") break;

    const testimony = [...state.testimonyLog].reverse().find((t) => t.lieId === unresolvedLie.lieId && !t.contradictionResolved);
    if (!testimony) break;

    const evidenceId = unresolvedLie.contradictingEvidenceIds[0]!;
    state = confront(state, bundle, testimony.turn, evidenceId);
  }

  return state;
}

describe("all case data", () => {
  const cases = listCases();

  it("has at least one case", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const caseData of cases) {
    describe(caseData.caseId, () => {
      const bundle = loadCase(caseData.caseId);

      it("passes referential integrity validation", () => {
        expect(validateCaseBundle(bundle)).toEqual([]);
      });

      it("is solvable to true_confession with legal moves only", () => {
        const solved = solveToConfession(bundle);
        expect(solved.currentPhase).toBe("ending");
        expect(solved.endingId).toBe("true_confession");
        expect(solved.wrongfulPressureCount).toBe(0);
      });
    });
  }
});
