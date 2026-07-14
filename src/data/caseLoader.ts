import caseJson from "./cases/case-001/case.json";
import suspectJson from "./cases/case-001/suspect.json";
import questionsJson from "./cases/case-001/questions.json";
import evidenceJson from "./cases/case-001/evidence.json";
import responseTextsJson from "./cases/case-001/responseTexts.json";
import type { CaseBundle } from "../core/types";

const bundles: Record<string, CaseBundle> = {
  "case-001": {
    case: caseJson as CaseBundle["case"],
    suspect: suspectJson as CaseBundle["suspect"],
    questions: questionsJson as CaseBundle["questions"],
    evidence: evidenceJson as CaseBundle["evidence"],
    responseTexts: responseTextsJson as CaseBundle["responseTexts"],
  },
};

export function listCases(): CaseBundle["case"][] {
  return Object.values(bundles).map((b) => b.case);
}

export function loadCase(caseId: string): CaseBundle {
  const bundle = bundles[caseId];
  if (!bundle) throw new Error(`Unknown caseId: ${caseId}`);
  return bundle;
}
