import caseJson from "./cases/case-001/case.json";
import evidenceJson from "./cases/case-001/evidence.json";
import questionsJson from "./cases/case-001/questions.json";
import responsesJson from "./cases/case-001/responses.json";
import suspectJson from "./cases/case-001/suspect.json";
import { validateCaseBundle } from "../core/caseDataValidator";
import { defensiveCloneAndFreeze } from "../core/immutability";
import type { DeepReadonly } from "../core/immutability";
import type { CaseBundle } from "../core/types";

const rawCaseBundle: unknown = {
  case: caseJson,
  suspect: suspectJson,
  questions: questionsJson,
  evidence: evidenceJson,
  responses: responsesJson,
};

export function loadCase001(): DeepReadonly<CaseBundle> {
  const validated = validateCaseBundle(structuredClone(rawCaseBundle));
  return defensiveCloneAndFreeze(validated);
}
