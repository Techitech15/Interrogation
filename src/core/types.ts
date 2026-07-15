export type EmotionState = "calm" | "shaken" | "hardened";

export type GamePhase =
  | "briefing"
  | "interrogation"
  | "confrontation"
  | "breakdown"
  | "ending";

export type EndingId = "true_confession" | "released" | "wrongful_conviction";

export interface TruthTable {
  [truthId: string]: string;
}

export interface LieEntry {
  lieId: string;
  relatedTruthId: string;
  text: string;
  contradictingEvidenceIds: string[];
  requiredEmotionNotIn?: EmotionState[];
}

export interface Suspect {
  suspectId: string;
  name: string;
  initialEmotion: EmotionState;
  truthTable: TruthTable;
  lieTable: LieEntry[];
}

export interface ResponseRule {
  emotion: EmotionState;
  disclosedEvidence: string[];
  lieId?: string;
  responseTextId?: string;
  slipHintProbability?: number;
}

export interface Question {
  questionId: string;
  category: string;
  label: string;
  freeTextKeywords: string[];
  responseTable: ResponseRule[];
}

export interface Evidence {
  evidenceId: string;
  name: string;
  description: string;
  unlockedFrom: "briefing" | "interrogation";
  imageAsset: string;
}

export interface ResponseText {
  [responseTextId: string]: string;
}

export interface AiProfile {
  caseSummaryForAI: string;
  knownFactsForSuspect: string[];
  liesToMaintain: string[];
  bannedKeywords: string[];
}

export interface Case {
  caseId: string;
  title: string;
  isFreeDemo: boolean;
  detentionLimitMinutes: number;
  briefing: {
    scenePhotos: string[];
    autopsyReport: string;
    initialMemo: string;
  };
  suspectId: string;
  endings: EndingId[];
  wrongfulPressureThreshold: number;
  /** 隠し事件の開示条件。null = 常時表示。"all_true_confessions" = 他の全事件をTRUE ENDでクリアすると開示 */
  hiddenCaseUnlockFlag: string | null;
}

export interface CaseBundle {
  case: Case;
  suspect: Suspect;
  questions: Question[];
  evidence: Evidence[];
  responseTexts: ResponseText;
  aiProfile: AiProfile;
}

export interface TestimonyEntry {
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
  turn: number;
  detentionRemainingMinutes: number;
  emotionState: EmotionState;
  emotionScore: number;
  testimonyLog: TestimonyEntry[];
  disclosedEvidenceIds: string[];
  wrongfulPressureCount: number;
  endingId: EndingId | null;
}
