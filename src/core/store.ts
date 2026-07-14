import type { SynchronousAIProvider } from "../ai/AIProvider";
import { evaluateContradiction } from "./contradictionJudge";
import { DETENTION_COSTS, consumeDetentionTime } from "./detentionClock";
import { resolveDialogue } from "./dialogueResolver";
import {
  applyCorrectConfrontation,
  applyIncorrectConfrontation,
  emotionStateFromScore,
  initialEmotionScore,
} from "./emotionFSM";
import { evaluateEnding } from "./endingEvaluator";
import {
  defensiveCloneAndFreeze,
  deepFreeze,
  type DeepReadonly,
} from "./immutability";
import { transitionPhase } from "./stateMachine";
import type { CaseBundle, GameState, Testimony } from "./types";

export type GameActionFailureCode =
  | "invalid_phase"
  | "unknown_question"
  | "unknown_testimony"
  | "testimony_resolved"
  | "unknown_evidence"
  | "evidence_unavailable"
  | "no_selected_testimony";

export type GameActionResult =
  | { readonly ok: true; readonly code: "ok" }
  | { readonly ok: false; readonly code: GameActionFailureCode };

const ACTION_OK: GameActionResult = deepFreeze({ ok: true, code: "ok" });

function actionFailure(code: GameActionFailureCode): GameActionResult {
  return deepFreeze({ ok: false, code });
}

export interface GameStore {
  getState(): DeepReadonly<GameState>;
  subscribe(listener: (state: DeepReadonly<GameState>) => void): () => void;
  startInterrogation(): GameActionResult;
  askQuestion(questionId: string): GameActionResult;
  beginConfrontation(testimonyId: string): GameActionResult;
  cancelConfrontation(): GameActionResult;
  confront(evidenceId: string): GameActionResult;
  restart(): GameActionResult;
}

export function createInitialGameState(
  bundle: DeepReadonly<CaseBundle>,
): GameState {
  const emotionScore = initialEmotionScore(bundle.suspect.initialEmotion);
  return {
    caseId: bundle.case.caseId,
    currentPhase: "briefing",
    detentionRemainingMinutes: bundle.case.detentionLimitMinutes,
    emotionScore,
    emotionState: emotionStateFromScore(emotionScore),
    testimonyLog: [],
    disclosedEvidenceIds: bundle.evidence
      .filter((item) => item.unlockedFrom === "briefing")
      .map((item) => item.evidenceId),
    resolvedLieIds: [],
    wrongfulPressureCount: 0,
    falseConfessionTriggered: false,
    aiLayerActive: "A",
    turn: 0,
    selectedTestimonyId: null,
    ending: null,
    lastResult: "事件ファイルを確認してください。",
  };
}

function buildTestimonyId(
  caseId: string,
  turn: number,
  questionId: string,
): string {
  return caseId + ":" + turn + ":" + questionId;
}

export function createGameStore(
  suppliedBundle: DeepReadonly<CaseBundle>,
  provider: SynchronousAIProvider,
): GameStore {
  const bundle = defensiveCloneAndFreeze(suppliedBundle);
  let state = deepFreeze(createInitialGameState(bundle)) as GameState;
  const listeners = new Set<(next: DeepReadonly<GameState>) => void>();
  const allLieIds = bundle.suspect.lieTable.map((lie) => lie.lieId);

  function publish(next: GameState): void {
    state = deepFreeze(next) as GameState;
    for (const listener of listeners) {
      listener(state);
    }
  }

  function finishAfterAction(next: GameState): GameState {
    const ending = evaluateEnding(next, allLieIds);
    if (ending === null) {
      return {
        ...next,
        currentPhase: "interrogation",
        selectedTestimonyId: null,
      };
    }
    return {
      ...next,
      currentPhase: "ending",
      selectedTestimonyId: null,
      ending,
    };
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    startInterrogation() {
      if (state.currentPhase !== "briefing") {
        return actionFailure("invalid_phase");
      }
      publish({
        ...state,
        currentPhase: transitionPhase("briefing", "interrogation"),
        lastResult: "尋問を開始しました。",
      });
      return ACTION_OK;
    },

    askQuestion(questionId) {
      if (state.currentPhase !== "interrogation") {
        return actionFailure("invalid_phase");
      }
      if (
        !bundle.questions.some((question) => question.questionId === questionId)
      ) {
        return actionFailure("unknown_question");
      }

      const resolution = resolveDialogue(
        bundle,
        questionId,
        state.emotionState,
        state.disclosedEvidenceIds,
      );
      const response = provider.generateTestimony({
        canonicalQuestionId: questionId,
        caseSummaryForAI: bundle.case.briefing.initialMemo,
        knownFactsForSuspect: [],
        emotionState: state.emotionState,
        disclosedEvidenceSummaries: bundle.evidence
          .filter((item) => state.disclosedEvidenceIds.includes(item.evidenceId))
          .map((item) => item.description),
        disclosedEvidenceIds: [...state.disclosedEvidenceIds],
        playerUtterance: resolution.question.label,
      });
      const turn = state.turn + 1;
      const lieAlreadyResolved =
        resolution.lieId !== undefined &&
        state.resolvedLieIds.includes(resolution.lieId);
      const testimony: Testimony = {
        testimonyId: buildTestimonyId(state.caseId, turn, questionId),
        turn,
        questionId,
        text: response.lineText,
        ...(resolution.lieId === undefined ? {} : { lieId: resolution.lieId }),
        emotionAtTime: state.emotionState,
        contradictionResolved: lieAlreadyResolved,
      };
      const next: GameState = {
        ...state,
        detentionRemainingMinutes: consumeDetentionTime(
          state.detentionRemainingMinutes,
          DETENTION_COSTS.selectedQuestion,
        ),
        testimonyLog: [...state.testimonyLog, testimony],
        turn,
        lastResult: "供述を記録しました（30分経過）。",
      };
      publish(finishAfterAction(next));
      return ACTION_OK;
    },

    beginConfrontation(testimonyId) {
      if (state.currentPhase !== "interrogation") {
        return actionFailure("invalid_phase");
      }
      const testimony = state.testimonyLog.find(
        (item) => item.testimonyId === testimonyId,
      );
      if (testimony === undefined) {
        return actionFailure("unknown_testimony");
      }
      if (
        testimony.contradictionResolved ||
        (testimony.lieId !== undefined &&
          state.resolvedLieIds.includes(testimony.lieId))
      ) {
        return actionFailure("testimony_resolved");
      }
      publish({
        ...state,
        currentPhase: transitionPhase("interrogation", "confrontation"),
        selectedTestimonyId: testimonyId,
        lastResult: "この供述と矛盾する証拠を選んでください。",
      });
      return ACTION_OK;
    },

    cancelConfrontation() {
      if (state.currentPhase !== "confrontation") {
        return actionFailure("invalid_phase");
      }
      publish({
        ...state,
        currentPhase: transitionPhase("confrontation", "interrogation"),
        selectedTestimonyId: null,
        lastResult: "追及をキャンセルしました。",
      });
      return ACTION_OK;
    },

    confront(evidenceId) {
      if (state.currentPhase !== "confrontation") {
        return actionFailure("invalid_phase");
      }
      if (state.selectedTestimonyId === null) {
        return actionFailure("no_selected_testimony");
      }
      const testimony = state.testimonyLog.find(
        (item) => item.testimonyId === state.selectedTestimonyId,
      );
      if (testimony === undefined) {
        return actionFailure("unknown_testimony");
      }
      if (testimony.contradictionResolved) {
        return actionFailure("testimony_resolved");
      }
      const evidence = bundle.evidence.find(
        (item) => item.evidenceId === evidenceId,
      );
      if (evidence === undefined) {
        return actionFailure("unknown_evidence");
      }
      if (!state.disclosedEvidenceIds.includes(evidenceId)) {
        return actionFailure("evidence_unavailable");
      }

      const result = evaluateContradiction(
        testimony,
        evidence,
        bundle.suspect,
        state.emotionState,
      );
      if (result.kind === "already_resolved") {
        return actionFailure("testimony_resolved");
      }

      if (result.kind === "correct") {
        const emotionScore = applyCorrectConfrontation(state.emotionScore);
        const resolvedLieIds = state.resolvedLieIds.includes(result.lie.lieId)
          ? state.resolvedLieIds
          : [...state.resolvedLieIds, result.lie.lieId];
        const next: GameState = {
          ...state,
          detentionRemainingMinutes: consumeDetentionTime(
            state.detentionRemainingMinutes,
            DETENTION_COSTS.correctConfrontation,
          ),
          emotionScore,
          emotionState: emotionStateFromScore(emotionScore),
          resolvedLieIds,
          testimonyLog: state.testimonyLog.map((item) =>
            item.lieId === result.lie.lieId
              ? { ...item, contradictionResolved: true }
              : item,
          ),
          lastResult:
            "供述崩壊 — 「" +
            result.lie.text +
            "」と証拠「" +
            evidence.name +
            "」の矛盾を突きました（60分経過）。",
        };
        publish(finishAfterAction(next));
        return ACTION_OK;
      }

      const wrongfulPressureCount = state.wrongfulPressureCount + 1;
      const threshold = bundle.case.wrongfulPressureThreshold ?? 3;
      const emotionScore = applyIncorrectConfrontation(state.emotionScore);
      const next: GameState = {
        ...state,
        detentionRemainingMinutes: consumeDetentionTime(
          state.detentionRemainingMinutes,
          DETENTION_COSTS.incorrectConfrontation,
        ),
        emotionScore,
        emotionState: emotionStateFromScore(emotionScore),
        wrongfulPressureCount,
        falseConfessionTriggered: wrongfulPressureCount >= threshold,
        lastResult:
          "その証拠では矛盾を示せません。容疑者は態度を硬化させました（120分経過）。",
      };
      publish(finishAfterAction(next));
      return ACTION_OK;
    },

    restart() {
      if (state.currentPhase !== "ending") {
        return actionFailure("invalid_phase");
      }
      publish(createInitialGameState(bundle));
      return ACTION_OK;
    },
  };
}
