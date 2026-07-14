import type { GamePhase } from "./types";

const allowedTransitions: Record<GamePhase, readonly GamePhase[]> = {
  briefing: ["interrogation"],
  interrogation: ["interrogation", "confrontation", "ending"],
  confrontation: ["interrogation", "ending"],
  ending: ["briefing"],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionPhase(from: GamePhase, to: GamePhase): GamePhase {
  if (!canTransition(from, to)) {
    throw new Error("許可されていないフェーズ遷移です: " + from + " -> " + to);
  }
  return to;
}
