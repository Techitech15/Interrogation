import type { EndingId } from "../core/types";

const PROGRESS_KEY = "jinmon.progress";

export interface Progress {
  clearedCases: Record<string, EndingId[]>;
}

function readProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { clearedCases: {} };
    return JSON.parse(raw) as Progress;
  } catch {
    return { clearedCases: {} };
  }
}

export function recordEnding(caseId: string, endingId: EndingId): void {
  const progress = readProgress();
  const existing = progress.clearedCases[caseId] ?? [];
  if (!existing.includes(endingId)) {
    progress.clearedCases[caseId] = [...existing, endingId];
  }
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable (e.g. private mode) — progress simply won't persist.
  }
}

export function getProgress(): Progress {
  return readProgress();
}
