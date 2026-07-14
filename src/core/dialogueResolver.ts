import type { EmotionState, Question, ResponseRule } from "./types";

export const DEFAULT_RESPONSE_TEXT_ID = "RESP-REFUSE-DEFAULT";

function ruleMatches(
  rule: ResponseRule,
  emotionState: EmotionState,
  disclosedEvidenceIds: string[],
): boolean {
  if (rule.emotion !== emotionState) return false;
  return rule.disclosedEvidence.every((id) => disclosedEvidenceIds.includes(id));
}

export interface ResolvedDialogue {
  rule: ResponseRule | null;
  lieId: string | null;
  responseTextId: string;
}

export function resolveDialogue(
  question: Question,
  emotionState: EmotionState,
  disclosedEvidenceIds: string[],
): ResolvedDialogue {
  const rule = question.responseTable.find((r) =>
    ruleMatches(r, emotionState, disclosedEvidenceIds),
  );

  if (!rule) {
    return { rule: null, lieId: null, responseTextId: DEFAULT_RESPONSE_TEXT_ID };
  }

  return {
    rule,
    lieId: rule.lieId ?? null,
    responseTextId: rule.responseTextId ?? DEFAULT_RESPONSE_TEXT_ID,
  };
}
