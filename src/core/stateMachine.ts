import { resolveDialogue, DEFAULT_RESPONSE_TEXT_ID } from "./dialogueResolver";
import { matchFreeText } from "./freeTextMatcher";
import { judgeContradiction } from "./contradictionJudge";
import { evaluateEnding } from "./endingEvaluator";
import { applyCorrectConfrontation, applyWrongConfrontation, deriveEmotion } from "./emotionFSM";
import { consumeTime, TIME_COST } from "./detentionClock";
import type { CaseBundle, GameState, Question } from "./types";

export function createInitialGameState(bundle: CaseBundle): GameState {
  return {
    caseId: bundle.case.caseId,
    currentPhase: "briefing",
    turn: 0,
    detentionRemainingMinutes: bundle.case.detentionLimitMinutes,
    emotionState: bundle.suspect.initialEmotion,
    emotionScore: 0,
    testimonyLog: [],
    disclosedEvidenceIds: bundle.evidence
      .filter((e) => e.unlockedFrom === "briefing")
      .map((e) => e.evidenceId),
    wrongfulPressureCount: 0,
    endingId: null,
  };
}

export function startInterrogation(state: GameState): GameState {
  if (state.currentPhase !== "briefing") return state;
  return { ...state, currentPhase: "interrogation" };
}

function withEndingCheck(state: GameState, bundle: CaseBundle): GameState {
  const endingId = evaluateEnding(state, bundle.suspect, bundle.case.wrongfulPressureThreshold);
  if (!endingId) return state;
  return { ...state, currentPhase: "ending", endingId };
}

function resolveResponseText(bundle: CaseBundle, responseTextId: string, fallbackLieText: string | null): string {
  if (fallbackLieText) return fallbackLieText;
  return bundle.responseTexts[responseTextId] ?? bundle.responseTexts[DEFAULT_RESPONSE_TEXT_ID] ?? "……(無言)";
}

function applyQuestion(state: GameState, bundle: CaseBundle, question: Question, timeCost: number): GameState {
  if (state.currentPhase !== "interrogation") return state;

  const resolved = resolveDialogue(question, state.emotionState, state.disclosedEvidenceIds);
  const lie = resolved.lieId ? bundle.suspect.lieTable.find((l) => l.lieId === resolved.lieId) : undefined;
  const text = resolveResponseText(bundle, resolved.responseTextId, lie?.text ?? null);

  const turn = state.turn + 1;
  const nextLog = [
    ...state.testimonyLog,
    {
      turn,
      questionId: question.questionId,
      text,
      lieId: resolved.lieId ?? undefined,
      emotionAtTime: state.emotionState,
      contradictionResolved: false,
    },
  ];

  const nextState: GameState = {
    ...state,
    turn,
    testimonyLog: nextLog,
    detentionRemainingMinutes: consumeTime(state.detentionRemainingMinutes, timeCost),
  };

  return withEndingCheck(nextState, bundle);
}

export function askScriptedQuestion(state: GameState, bundle: CaseBundle, questionId: string): GameState {
  const question = bundle.questions.find((q) => q.questionId === questionId);
  if (!question) return state;
  return applyQuestion(state, bundle, question, TIME_COST.scriptedQuestion);
}

export function askFreeText(state: GameState, bundle: CaseBundle, input: string): GameState {
  if (state.currentPhase !== "interrogation") return state;

  const match = matchFreeText(input, bundle.questions);
  if (!match.matched || !match.question) {
    const turn = state.turn + 1;
    const nextState: GameState = {
      ...state,
      turn,
      testimonyLog: [
        ...state.testimonyLog,
        {
          turn,
          questionId: "FREE_TEXT_UNMATCHED",
          text: bundle.responseTexts[DEFAULT_RESPONSE_TEXT_ID] ?? "……質問の意図が伝わらなかったようだ。",
          emotionAtTime: state.emotionState,
          contradictionResolved: false,
        },
      ],
      detentionRemainingMinutes: consumeTime(state.detentionRemainingMinutes, TIME_COST.freeTextUnmatched),
    };
    return withEndingCheck(nextState, bundle);
  }

  return applyQuestion(state, bundle, match.question, TIME_COST.freeTextMatched);
}

export function confront(state: GameState, bundle: CaseBundle, testimonyTurn: number, evidenceId: string): GameState {
  if (state.currentPhase !== "interrogation") return state;

  const testimony = state.testimonyLog.find((t) => t.turn === testimonyTurn);
  if (!testimony) return state;

  const correct = judgeContradiction(testimony, evidenceId, bundle.suspect.lieTable, state.emotionState);

  if (correct) {
    const emotionScore = applyCorrectConfrontation(state.emotionScore);
    const nextLog = state.testimonyLog.map((t) =>
      t.turn === testimonyTurn ? { ...t, contradictionResolved: true } : t,
    );
    const nextState: GameState = {
      ...state,
      emotionScore,
      emotionState: deriveEmotion(emotionScore),
      testimonyLog: nextLog,
      detentionRemainingMinutes: consumeTime(state.detentionRemainingMinutes, TIME_COST.confrontationCorrect),
    };
    return withEndingCheck(nextState, bundle);
  }

  const emotionScore = applyWrongConfrontation(state.emotionScore);
  const nextState: GameState = {
    ...state,
    emotionScore,
    emotionState: deriveEmotion(emotionScore),
    wrongfulPressureCount: state.wrongfulPressureCount + 1,
    detentionRemainingMinutes: consumeTime(state.detentionRemainingMinutes, TIME_COST.confrontationWrong),
  };
  return withEndingCheck(nextState, bundle);
}
