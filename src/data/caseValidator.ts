// 事件データの整合性検証。
// シナリオ追加はJSON編集のみで行うため、参照切れ・解決不能な嘘を機械的に検出し、
// テスト(tests/caseData.test.ts)で全事件に対して常時実行する。
import { DEFAULT_RESPONSE_TEXT_ID } from "../core/dialogueResolver";
import type { CaseBundle } from "../core/types";

export function validateCaseBundle(bundle: CaseBundle): string[] {
  const errors: string[] = [];
  const { case: caseData, suspect, questions, evidence, responseTexts } = bundle;
  const caseId = caseData.caseId;

  if (suspect.suspectId !== caseData.suspectId) {
    errors.push(`${caseId}: case.suspectId "${caseData.suspectId}" != suspect.suspectId "${suspect.suspectId}"`);
  }
  if (caseData.detentionLimitMinutes <= 0) {
    errors.push(`${caseId}: detentionLimitMinutes must be positive`);
  }
  if (caseData.wrongfulPressureThreshold < 1) {
    errors.push(`${caseId}: wrongfulPressureThreshold must be >= 1`);
  }
  if (suspect.lieTable.length === 0) {
    errors.push(`${caseId}: lieTable is empty — true_confession would be unreachable`);
  }

  const evidenceIds = new Set(evidence.map((e) => e.evidenceId));
  const lieIds = new Set(suspect.lieTable.map((l) => l.lieId));

  for (const lie of suspect.lieTable) {
    if (lie.contradictingEvidenceIds.length === 0) {
      errors.push(`${caseId}: lie ${lie.lieId} has no contradicting evidence — unresolvable`);
    }
    for (const evidenceId of lie.contradictingEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${caseId}: lie ${lie.lieId} references unknown evidence "${evidenceId}"`);
      }
    }
    if (!suspect.truthTable[lie.relatedTruthId]) {
      errors.push(`${caseId}: lie ${lie.lieId} references unknown truth "${lie.relatedTruthId}"`);
    }
    const elicitable = questions.some((q) => q.responseTable.some((r) => r.lieId === lie.lieId));
    if (!elicitable) {
      errors.push(`${caseId}: lie ${lie.lieId} is never elicited by any question — unresolvable`);
    }
  }

  for (const question of questions) {
    for (const rule of question.responseTable) {
      if (rule.lieId && !lieIds.has(rule.lieId)) {
        errors.push(`${caseId}: question ${question.questionId} references unknown lie "${rule.lieId}"`);
      }
      if (rule.responseTextId && rule.responseTextId !== DEFAULT_RESPONSE_TEXT_ID && !responseTexts[rule.responseTextId]) {
        errors.push(`${caseId}: question ${question.questionId} references unknown responseText "${rule.responseTextId}"`);
      }
      for (const evidenceId of rule.disclosedEvidence) {
        if (!evidenceIds.has(evidenceId)) {
          errors.push(`${caseId}: question ${question.questionId} rule references unknown evidence "${evidenceId}"`);
        }
      }
    }
  }

  if (!responseTexts[DEFAULT_RESPONSE_TEXT_ID]) {
    errors.push(`${caseId}: responseTexts is missing ${DEFAULT_RESPONSE_TEXT_ID}`);
  }

  const profile = bundle.aiProfile;
  if (!profile.caseSummaryForAI.trim()) {
    errors.push(`${caseId}: aiProfile.caseSummaryForAI is empty`);
  }
  if (profile.knownFactsForSuspect.length === 0) {
    errors.push(`${caseId}: aiProfile.knownFactsForSuspect is empty`);
  }

  return errors;
}
