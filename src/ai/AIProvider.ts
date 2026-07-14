import type { AILayer, EmotionState } from "../core/types";

export interface TestimonyRequest {
  canonicalQuestionId: string;
  caseSummaryForAI: string;
  knownFactsForSuspect: string[];
  emotionState: EmotionState;
  disclosedEvidenceSummaries: string[];
  disclosedEvidenceIds: string[];
  playerUtterance: string;
}

export interface TestimonyResponse {
  lineText: string;
  emotionDelta: -1 | 0 | 1;
  disclosureFlags: string[];
}

export interface AIProvider {
  readonly layer: AILayer;
  isAvailable(): boolean | Promise<boolean>;
  generateTestimony(
    request: TestimonyRequest,
  ): TestimonyResponse | Promise<TestimonyResponse>;
}

export interface SynchronousAIProvider extends AIProvider {
  readonly layer: "A";
  isAvailable(): true;
  generateTestimony(request: TestimonyRequest): TestimonyResponse;
}
