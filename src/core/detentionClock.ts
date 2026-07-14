export const DETENTION_COSTS = {
  selectedQuestion: 30,
  correctConfrontation: 60,
  incorrectConfrontation: 120,
} as const;

export function consumeDetentionTime(
  remainingMinutes: number,
  costMinutes: number,
): number {
  if (!Number.isFinite(remainingMinutes) || remainingMinutes < 0) {
    throw new Error("残り時間は0以上の有限数である必要があります");
  }
  if (!Number.isFinite(costMinutes) || costMinutes < 0) {
    throw new Error("消費時間は0以上の有限数である必要があります");
  }
  return Math.max(0, remainingMinutes - costMinutes);
}
