import type { EmotionState } from "./types";

export const MIN_EMOTION_SCORE = -3;
export const MAX_EMOTION_SCORE = 3;

function clampScore(score: number): number {
  return Math.max(MIN_EMOTION_SCORE, Math.min(MAX_EMOTION_SCORE, score));
}

export function emotionStateFromScore(score: number): EmotionState {
  if (score > 0) {
    return "shaken";
  }
  if (score < 0) {
    return "hardened";
  }
  return "calm";
}

export function initialEmotionScore(state: EmotionState): number {
  if (state === "shaken") {
    return 1;
  }
  if (state === "hardened") {
    return -1;
  }
  return 0;
}

export function applyCorrectConfrontation(score: number): number {
  return clampScore(Math.max(1, score + 1));
}

export function applyIncorrectConfrontation(score: number): number {
  return clampScore(Math.min(-1, score - 1));
}
