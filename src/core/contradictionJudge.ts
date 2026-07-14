import type { EmotionState, LieEntry, TestimonyEntry } from "./types";

export function judgeContradiction(
  testimony: TestimonyEntry,
  evidenceId: string,
  lieTable: LieEntry[],
  currentEmotion: EmotionState,
): boolean {
  if (!testimony.lieId || testimony.contradictionResolved) return false;

  const lie = lieTable.find((l) => l.lieId === testimony.lieId);
  if (!lie) return false;

  if (!lie.contradictingEvidenceIds.includes(evidenceId)) return false;

  if (lie.requiredEmotionNotIn?.includes(currentEmotion)) return false;

  return true;
}
