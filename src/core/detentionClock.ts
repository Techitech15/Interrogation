export const TIME_COST = {
  scriptedQuestion: 30,
  freeTextMatched: 30,
  freeTextUnmatched: 45,
  aiFreeDialogue: 30,
  confrontationCorrect: 60,
  confrontationWrong: 120,
  evidenceReview: 0,
} as const;

export function consumeTime(remaining: number, cost: number): number {
  return Math.max(0, remaining - cost);
}

export function isExpired(remaining: number): boolean {
  return remaining <= 0;
}
