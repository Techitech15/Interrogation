import type { Question } from "./types";

const MATCH_THRESHOLD = 1;
export const CHITCHAT_CATEGORY = "chitchat";

function normalize(text: string): string {
  return text
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .toLowerCase();
}

export interface FreeTextMatchResult {
  matched: boolean;
  question: Question | null;
}

export function matchFreeText(input: string, questions: Question[]): FreeTextMatchResult {
  const normalizedInput = normalize(input);

  let best: { question: Question; score: number }[] = [];
  let bestScore = 0;

  for (const question of questions) {
    const score = question.freeTextKeywords.reduce(
      (sum, keyword) => (normalizedInput.includes(normalize(keyword)) ? sum + 1 : sum),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = [{ question, score }];
    } else if (score === bestScore && score > 0) {
      best.push({ question, score });
    }
  }

  if (bestScore < MATCH_THRESHOLD || best.length === 0) {
    return { matched: false, question: null };
  }

  const chitchat = best.find((b) => b.question.category === CHITCHAT_CATEGORY);
  return { matched: true, question: (chitchat ?? best[0])!.question };
}
