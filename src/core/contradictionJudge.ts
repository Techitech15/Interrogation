import type {
  EmotionState,
  EvidenceDefinition,
  LieDefinition,
  SuspectDefinition,
  Testimony,
} from "./types";
import type { DeepReadonly } from "./immutability";

export type ContradictionResult =
  | {
      kind: "correct";
      lie: DeepReadonly<LieDefinition>;
      evidence: DeepReadonly<EvidenceDefinition>;
    }
  | {
      kind: "incorrect";
      lie: DeepReadonly<LieDefinition> | null;
      evidence: DeepReadonly<EvidenceDefinition>;
    }
  | {
      kind: "already_resolved";
      lie: DeepReadonly<LieDefinition> | null;
      evidence: DeepReadonly<EvidenceDefinition>;
    };

export function evaluateContradiction(
  testimony: DeepReadonly<Testimony>,
  evidence: DeepReadonly<EvidenceDefinition>,
  suspect: DeepReadonly<SuspectDefinition>,
  emotionState: EmotionState,
): ContradictionResult {
  const lie =
    testimony.lieId === undefined
      ? null
      : (suspect.lieTable.find((item) => item.lieId === testimony.lieId) ??
        null);

  if (testimony.contradictionResolved) {
    return { kind: "already_resolved", lie, evidence };
  }

  if (
    lie !== null &&
    lie.contradictingEvidenceIds.includes(evidence.evidenceId) &&
    !(lie.requiredEmotionNotIn ?? []).includes(emotionState)
  ) {
    return { kind: "correct", lie, evidence };
  }

  return { kind: "incorrect", lie, evidence };
}
