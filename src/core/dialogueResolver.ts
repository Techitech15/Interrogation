import type {
  CaseBundle,
  EmotionState,
  QuestionDefinition,
  QuestionResponseRule,
} from "./types";
import type { DeepReadonly } from "./immutability";

export interface DialogueResolution {
  question: DeepReadonly<QuestionDefinition>;
  rule: DeepReadonly<QuestionResponseRule> | null;
  responseTextId: string;
  responseText: string;
  lieId?: string;
}

function includesAll(
  actualIds: readonly string[],
  requiredIds: readonly string[],
): boolean {
  const actual = new Set(actualIds);
  return requiredIds.every((id) => actual.has(id));
}

export function resolveDialogue(
  bundle: DeepReadonly<CaseBundle>,
  questionId: string,
  emotionState: EmotionState,
  disclosedEvidenceIds: readonly string[],
): DialogueResolution {
  const question = bundle.questions.find(
    (candidate) => candidate.questionId === questionId,
  );
  if (question === undefined) {
    throw new Error("質問が見つかりません: " + questionId);
  }

  const rule =
    question.responseTable.find(
      (candidate) =>
        candidate.emotion === emotionState &&
        includesAll(disclosedEvidenceIds, candidate.requiredEvidenceIds),
    ) ?? null;
  const responseTextId = rule?.responseTextId ?? "RESP-REFUSE-DEFAULT";
  const responseText = bundle.responses[responseTextId];
  if (responseText === undefined) {
    throw new Error("応答本文が見つかりません: " + responseTextId);
  }

  return {
    question,
    rule,
    responseTextId,
    responseText,
    ...(rule?.lieId === undefined ? {} : { lieId: rule.lieId }),
  };
}
