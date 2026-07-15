// 事件データの自動発見ローダー。
// src/data/cases/<caseId>/ に5つのJSONを置くだけで事件が追加される(コード変更不要)。
import type { CaseBundle } from "../core/types";

type JsonModule = { default: unknown };

const caseJsons = import.meta.glob<JsonModule>("./cases/*/case.json", { eager: true });
const suspectJsons = import.meta.glob<JsonModule>("./cases/*/suspect.json", { eager: true });
const questionsJsons = import.meta.glob<JsonModule>("./cases/*/questions.json", { eager: true });
const evidenceJsons = import.meta.glob<JsonModule>("./cases/*/evidence.json", { eager: true });
const responseTextsJsons = import.meta.glob<JsonModule>("./cases/*/responseTexts.json", { eager: true });
const aiProfileJsons = import.meta.glob<JsonModule>("./cases/*/aiProfile.json", { eager: true });

function dirOf(path: string): string {
  const match = path.match(/\.\/cases\/([^/]+)\//);
  if (!match || !match[1]) throw new Error(`caseLoader: unexpected module path: ${path}`);
  return match[1];
}

function byDir(globbed: Record<string, JsonModule>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [path, mod] of Object.entries(globbed)) {
    map.set(dirOf(path), mod.default);
  }
  return map;
}

function buildBundles(): Record<string, CaseBundle> {
  const cases = byDir(caseJsons);
  const suspects = byDir(suspectJsons);
  const questions = byDir(questionsJsons);
  const evidence = byDir(evidenceJsons);
  const responseTexts = byDir(responseTextsJsons);
  const aiProfiles = byDir(aiProfileJsons);

  const bundles: Record<string, CaseBundle> = {};
  for (const [dir, caseData] of cases) {
    const missing = [
      !suspects.has(dir) && "suspect.json",
      !questions.has(dir) && "questions.json",
      !evidence.has(dir) && "evidence.json",
      !responseTexts.has(dir) && "responseTexts.json",
      !aiProfiles.has(dir) && "aiProfile.json",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`caseLoader: case "${dir}" is missing ${missing.join(", ")}`);
    }
    bundles[dir] = {
      case: caseData as CaseBundle["case"],
      suspect: suspects.get(dir) as CaseBundle["suspect"],
      questions: questions.get(dir) as CaseBundle["questions"],
      evidence: evidence.get(dir) as CaseBundle["evidence"],
      responseTexts: responseTexts.get(dir) as CaseBundle["responseTexts"],
      aiProfile: aiProfiles.get(dir) as CaseBundle["aiProfile"],
    };
  }
  return bundles;
}

const bundles = buildBundles();

export function listCases(): CaseBundle["case"][] {
  return Object.values(bundles)
    .map((b) => b.case)
    .sort((a, b) => a.caseId.localeCompare(b.caseId));
}

export function loadCase(caseId: string): CaseBundle {
  const bundle = bundles[caseId];
  if (!bundle) throw new Error(`Unknown caseId: ${caseId}`);
  return bundle;
}
