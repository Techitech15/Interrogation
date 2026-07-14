import type { EndingType, GameState } from "./types";
import type { DeepReadonly } from "./immutability";

export function evaluateEnding(
  state: DeepReadonly<GameState>,
  allLieIds: readonly string[],
): EndingType | null {
  if (state.falseConfessionTriggered) {
    return "wrongful_conviction";
  }
  if (
    allLieIds.length > 0 &&
    allLieIds.every((lieId) => state.resolvedLieIds.includes(lieId))
  ) {
    return "true_confession";
  }
  if (state.detentionRemainingMinutes <= 0) {
    return "released";
  }
  return null;
}
