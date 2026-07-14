import Ajv, { type ErrorObject } from "ajv";
import schema from "../data/schema/case-bundle.schema.json";
import { DETENTION_COSTS } from "./detentionClock";
import {
  applyCorrectConfrontation,
  applyIncorrectConfrontation,
  emotionStateFromScore,
  initialEmotionScore,
} from "./emotionFSM";
import type {
  CaseBundle,
  EmotionState,
  EndingType,
  QuestionDefinition,
  QuestionResponseRule,
} from "./types";

export const P1_REACHABILITY_STATE_LIMIT = 50_000;
const EMOTIONS: readonly EmotionState[] = ["calm", "shaken", "hardened"];

export class CaseDataValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("事件データが不正です: " + issues.join(" / "));
    this.name = "CaseDataValidationError";
    this.issues = issues;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

function formatSchemaError(error: ErrorObject): string {
  const path = error.instancePath || "/";
  return path + " " + error.message;
}

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
}

function ruleEvidenceMatches(
  rule: QuestionResponseRule,
  actualEvidenceIds: ReadonlySet<string>,
): boolean {
  return rule.requiredEvidenceIds.every((id) => actualEvidenceIds.has(id));
}

function firstMatchingRule(
  question: QuestionDefinition,
  emotion: EmotionState,
  actualEvidenceIds: ReadonlySet<string>,
): QuestionResponseRule | null {
  return (
    question.responseTable.find(
      (rule) =>
        rule.emotion === emotion &&
        ruleEvidenceMatches(rule, actualEvidenceIds),
    ) ?? null
  );
}

interface ReachabilityState {
  remainingMinutes: number;
  emotionScore: number;
  acquiredLieMask: bigint;
  resolvedLieMask: bigint;
  hasNeutralTestimony: boolean;
  wrongfulPressureCount: number;
}

interface ReachabilityResult {
  endings: Set<EndingType>;
  exploredStates: number;
  hitStateLimit: boolean;
}

function reachabilityStateKey(state: ReachabilityState): string {
  return [
    state.remainingMinutes,
    state.emotionScore,
    state.acquiredLieMask.toString(16),
    state.resolvedLieMask.toString(16),
    state.hasNeutralTestimony ? 1 : 0,
    state.wrongfulPressureCount,
  ].join(":");
}

function exploreP1Endings(
  bundle: CaseBundle,
  actualEvidenceIds: ReadonlySet<string>,
): ReachabilityResult {
  const lieIndex = new Map(
    bundle.suspect.lieTable.map((lie, index) => [lie.lieId, index]),
  );
  const allResolvedMask =
    (1n << BigInt(bundle.suspect.lieTable.length)) - 1n;
  const pressureThreshold = bundle.case.wrongfulPressureThreshold ?? 3;
  const endings = new Set<EndingType>();
  const queue: ReachabilityState[] = [
    {
      remainingMinutes: bundle.case.detentionLimitMinutes,
      emotionScore: initialEmotionScore(bundle.suspect.initialEmotion),
      acquiredLieMask: 0n,
      resolvedLieMask: 0n,
      hasNeutralTestimony: false,
      wrongfulPressureCount: 0,
    },
  ];
  const seen = new Set<string>([reachabilityStateKey(queue[0]!)]);
  let cursor = 0;
  let hitStateLimit = false;

  function consume(remaining: number, cost: number): number {
    return Math.max(0, remaining - cost);
  }

  function enqueueOrRecordEnding(next: ReachabilityState): void {
    if (next.wrongfulPressureCount >= pressureThreshold) {
      endings.add("wrongful_conviction");
      return;
    }
    if (next.resolvedLieMask === allResolvedMask) {
      endings.add("true_confession");
      return;
    }
    if (next.remainingMinutes <= 0) {
      endings.add("released");
      return;
    }

    const key = reachabilityStateKey(next);
    if (seen.has(key)) {
      return;
    }
    if (seen.size >= P1_REACHABILITY_STATE_LIMIT) {
      hitStateLimit = true;
      return;
    }
    seen.add(key);
    queue.push(next);
  }

  while (
    cursor < queue.length &&
    endings.size < 3 &&
    !hitStateLimit
  ) {
    const current = queue[cursor]!;
    cursor += 1;
    const emotion = emotionStateFromScore(current.emotionScore);

    for (const question of bundle.questions) {
      const response = firstMatchingRule(
        question,
        emotion,
        actualEvidenceIds,
      );
      const responseLieIndex =
        response?.lieId === undefined ? undefined : lieIndex.get(response.lieId);
      enqueueOrRecordEnding({
        ...current,
        remainingMinutes: consume(
          current.remainingMinutes,
          DETENTION_COSTS.selectedQuestion,
        ),
        acquiredLieMask:
          responseLieIndex === undefined
            ? current.acquiredLieMask
            : current.acquiredLieMask | (1n << BigInt(responseLieIndex)),
        hasNeutralTestimony:
          current.hasNeutralTestimony || responseLieIndex === undefined,
      });
    }

    for (const [index, lie] of bundle.suspect.lieTable.entries()) {
      const bit = 1n << BigInt(index);
      const acquired = (current.acquiredLieMask & bit) !== 0n;
      const resolved = (current.resolvedLieMask & bit) !== 0n;
      if (!acquired || resolved) {
        continue;
      }
      for (const evidenceId of actualEvidenceIds) {
        const correct =
          lie.contradictingEvidenceIds.includes(evidenceId) &&
          !(lie.requiredEmotionNotIn ?? []).includes(emotion);
        if (correct) {
          enqueueOrRecordEnding({
            ...current,
            remainingMinutes: consume(
              current.remainingMinutes,
              DETENTION_COSTS.correctConfrontation,
            ),
            emotionScore: applyCorrectConfrontation(current.emotionScore),
            resolvedLieMask: current.resolvedLieMask | bit,
          });
        } else {
          enqueueOrRecordEnding({
            ...current,
            remainingMinutes: consume(
              current.remainingMinutes,
              DETENTION_COSTS.incorrectConfrontation,
            ),
            emotionScore: applyIncorrectConfrontation(current.emotionScore),
            wrongfulPressureCount: current.wrongfulPressureCount + 1,
          });
        }
      }
    }

    if (current.hasNeutralTestimony && actualEvidenceIds.size > 0) {
      enqueueOrRecordEnding({
        ...current,
        remainingMinutes: consume(
          current.remainingMinutes,
          DETENTION_COSTS.incorrectConfrontation,
        ),
        emotionScore: applyIncorrectConfrontation(current.emotionScore),
        wrongfulPressureCount: current.wrongfulPressureCount + 1,
      });
    }
  }

  return {
    endings,
    exploredStates: seen.size,
    hitStateLimit,
  };
}

function validateReferencesAndReachability(bundle: CaseBundle): string[] {
  const issues: string[] = [];
  const evidenceIds = new Set(bundle.evidence.map((item) => item.evidenceId));
  const briefingEvidenceIds = new Set(
    bundle.evidence
      .filter((item) => item.unlockedFrom === "briefing")
      .map((item) => item.evidenceId),
  );
  const lieIds = new Set(bundle.suspect.lieTable.map((item) => item.lieId));
  const truthIds = new Set(Object.keys(bundle.suspect.truthTable));
  const responseIds = new Set(Object.keys(bundle.responses));
  const requiredEndings: EndingType[] = [
    "wrongful_conviction",
    "true_confession",
    "released",
  ];

  if (bundle.case.suspectId !== bundle.suspect.suspectId) {
    issues.push(
      "case.suspectId " +
        bundle.case.suspectId +
        " は suspect.suspectId と一致しません",
    );
  }
  if (
    bundle.case.endings.length !== requiredEndings.length ||
    !requiredEndings.every((ending) => bundle.case.endings.includes(ending))
  ) {
    issues.push("P1では冤罪・自白・釈放の3 ending 宣言が必須です");
  }

  for (const duplicate of duplicateIds(
    bundle.questions.map((item) => item.questionId),
  )) {
    issues.push("questionId が重複しています: " + duplicate);
  }
  for (const duplicate of duplicateIds(
    bundle.evidence.map((item) => item.evidenceId),
  )) {
    issues.push("evidenceId が重複しています: " + duplicate);
  }
  for (const duplicate of duplicateIds(
    bundle.suspect.lieTable.map((item) => item.lieId),
  )) {
    issues.push("lieId が重複しています: " + duplicate);
  }

  for (const lie of bundle.suspect.lieTable) {
    if (!truthIds.has(lie.relatedTruthId)) {
      issues.push(
        lie.lieId + " の relatedTruthId が存在しません: " + lie.relatedTruthId,
      );
    }
    for (const evidenceId of lie.contradictingEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push(
          lie.lieId + " が存在しない証拠を参照しています: " + evidenceId,
        );
      }
    }
    if (
      !lie.contradictingEvidenceIds.some((evidenceId) =>
        briefingEvidenceIds.has(evidenceId),
      )
    ) {
      issues.push(
        lie.lieId + " にbriefingで開示可能な矛盾証拠がありません",
      );
    }
  }

  for (const question of bundle.questions) {
    question.responseTable.forEach((response, index) => {
      if (!responseIds.has(response.responseTextId)) {
        issues.push(
          question.questionId +
            " が存在しない応答を参照しています: " +
            response.responseTextId,
        );
      }
      if (response.lieId !== undefined && !lieIds.has(response.lieId)) {
        issues.push(
          question.questionId +
            " が存在しない嘘を参照しています: " +
            response.lieId,
        );
      }
      for (const evidenceId of response.requiredEvidenceIds) {
        if (!evidenceIds.has(evidenceId)) {
          issues.push(
            question.questionId +
              " が存在しない必要証拠を参照しています: " +
              evidenceId,
          );
        }
      }

      if (!ruleEvidenceMatches(response, briefingEvidenceIds)) {
        issues.push(
          question.questionId +
            " のresponse rule " +
            String(index) +
            " はP1固定証拠集合では永遠に条件不成立です",
        );
      } else {
        const earlierMatch = question.responseTable
          .slice(0, index)
          .some(
            (earlier) =>
              earlier.emotion === response.emotion &&
              ruleEvidenceMatches(earlier, briefingEvidenceIds),
          );
        if (earlierMatch) {
          issues.push(
            question.questionId +
              " のresponse rule " +
              String(index) +
              " はP1固定証拠集合で先行ruleにshadowされています",
          );
        }
      }
    });
  }

  for (const lie of bundle.suspect.lieTable) {
    const presentedByFirstMatch = bundle.questions.some((question) =>
      EMOTIONS.some(
        (emotion) =>
          firstMatchingRule(question, emotion, briefingEvidenceIds)?.lieId ===
          lie.lieId,
      ),
    );
    if (!presentedByFirstMatch) {
      issues.push(
        lie.lieId + " を提示する実到達可能なfirst-match responseがありません",
      );
    }
  }

  if (issues.length === 0) {
    const reachability = exploreP1Endings(bundle, briefingEvidenceIds);
    if (reachability.hitStateLimit) {
      issues.push(
        "P1結末到達性探索が上限" +
          String(P1_REACHABILITY_STATE_LIMIT) +
          "状態を超えました",
      );
    } else {
      for (const ending of requiredEndings) {
        if (!reachability.endings.has(ending)) {
          issues.push(
            ending +
              " へ実到達できません（探索状態数 " +
              String(reachability.exploredStates) +
              "）",
          );
        }
      }
    }
  }

  return issues;
}

export function validateCaseBundle(input: unknown): CaseBundle {
  if (!validateSchema(input)) {
    throw new CaseDataValidationError(
      (validateSchema.errors ?? []).map(formatSchemaError),
    );
  }

  const bundle = input as CaseBundle;
  const issues = validateReferencesAndReachability(bundle);
  if (issues.length > 0) {
    throw new CaseDataValidationError(issues);
  }
  return bundle;
}
