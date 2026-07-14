import type { EndingId, GameState, Suspect } from "./types";

function allLiesResolved(state: GameState, suspect: Suspect): boolean {
  if (suspect.lieTable.length === 0) return false;
  return suspect.lieTable.every((lie) =>
    state.testimonyLog.some(
      (t) => t.lieId === lie.lieId && t.contradictionResolved,
    ),
  );
}

export function evaluateEnding(state: GameState, suspect: Suspect, wrongfulPressureThreshold: number): EndingId | null {
  if (state.wrongfulPressureCount >= wrongfulPressureThreshold) {
    return "wrongful_conviction";
  }

  if (allLiesResolved(state, suspect)) {
    return "true_confession";
  }

  if (state.detentionRemainingMinutes <= 0) {
    return "released";
  }

  return null;
}
