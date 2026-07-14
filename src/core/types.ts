export type EmotionState = "calm" | "shaken" | "hardened";
export type GamePhase = "briefing" | "interrogation" | "confrontation" | "ending";
export type EndingType = "wrongful_conviction" | "true_confession" | "released";
export type AILayer = "A" | "B" | "C";

export interface Briefing {
  scenePhotos: string[];
  autopsyReport: string;
  initialMemo: string;
}

export interface CaseDefinition {
  caseId: string;
  title: string;
  isFreeDemo: boolean;
  detentionLimitMinutes: number;
  wrongfulPressureThreshold?: number;
  briefing: Briefing;
  suspectId: string;
  endings: EndingType[];
  hiddenCaseUnlockFlag: string | null;
}

export interface LieDefinition {
  lieId: string;
  relatedTruthId: string;
  text: string;
  contradictingEvidenceIds: string[];
  requiredEmotionNotIn?: EmotionState[];
}

export interface SuspectDefinition {
  suspectId: string;
  name: string;
  silhouetteAssetSet: string;
  initialEmotion: EmotionState;
  truthTable: Record<string, string>;
  lieTable: LieDefinition[];
}

export interface QuestionResponseRule {
  emotion: EmotionState;
  requiredEvidenceIds: string[];
  responseTextId: string;
  lieId?: string;
}

export interface QuestionDefinition {
  questionId: string;
  category: string;
  label: string;
  freeTextKeywords: string[];
  responseTable: QuestionResponseRule[];
}

export interface EvidenceDefinition {
  evidenceId: string;
  name: string;
  description: string;
  unlockedFrom: string;
  imageAsset?: string;
}

export type ResponseCatalog = Record<string, string>;

export interface CaseBundle {
  case: CaseDefinition;
  suspect: SuspectDefinition;
  questions: QuestionDefinition[];
  evidence: EvidenceDefinition[];
  responses: ResponseCatalog;
}

export interface Testimony {
  testimonyId: string;
  turn: number;
  questionId: string;
  text: string;
  lieId?: string;
  emotionAtTime: EmotionState;
  contradictionResolved: boolean;
}

export interface GameState {
  caseId: string;
  currentPhase: GamePhase;
  detentionRemainingMinutes: number;
  emotionScore: number;
  emotionState: EmotionState;
  testimonyLog: Testimony[];
  disclosedEvidenceIds: string[];
  resolvedLieIds: string[];
  wrongfulPressureCount: number;
  falseConfessionTriggered: boolean;
  aiLayerActive: AILayer;
  turn: number;
  selectedTestimonyId: string | null;
  ending: EndingType | null;
  lastResult: string;
}
