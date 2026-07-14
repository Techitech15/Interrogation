import type { EmotionState } from "./types";

const MIN_SCORE = -3;
const MAX_SCORE = 3;
const SHAKEN_THRESHOLD = 2;
const HARDENED_THRESHOLD = -2;

export function clampScore(score: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
}

export function deriveEmotion(score: number): EmotionState {
  if (score >= SHAKEN_THRESHOLD) return "shaken";
  if (score <= HARDENED_THRESHOLD) return "hardened";
  return "calm";
}

export function applyCorrectConfrontation(score: number): number {
  return clampScore(score + 1);
}

export function applyWrongConfrontation(score: number): number {
  return clampScore(score - 1);
}
