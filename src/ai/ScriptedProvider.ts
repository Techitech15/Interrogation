import { resolveDialogue } from "../core/dialogueResolver";
import {
  defensiveCloneAndFreeze,
  type DeepReadonly,
} from "../core/immutability";
import type { CaseBundle } from "../core/types";
import type {
  SynchronousAIProvider,
  TestimonyRequest,
  TestimonyResponse,
} from "./AIProvider";

export class ScriptedProvider implements SynchronousAIProvider {
  readonly layer = "A" as const;
  private readonly bundle: DeepReadonly<CaseBundle>;

  constructor(bundle: DeepReadonly<CaseBundle>) {
    this.bundle = defensiveCloneAndFreeze(bundle);
  }

  isAvailable(): true {
    return true;
  }

  generateTestimony(request: TestimonyRequest): TestimonyResponse {
    const resolution = resolveDialogue(
      this.bundle,
      request.canonicalQuestionId,
      request.emotionState,
      request.disclosedEvidenceIds,
    );
    return {
      lineText: resolution.responseText,
      emotionDelta: 0,
      disclosureFlags: [],
    };
  }
}
