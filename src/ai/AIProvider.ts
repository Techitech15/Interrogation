import type { AiProfile, EmotionState } from "../core/types";

export interface TestimonyRequest {
  aiProfile: AiProfile;
  emotionState: EmotionState;
  disclosedEvidenceSummaries: string[];
  /** 直近の供述テキスト(最大5件)。一貫性維持用 */
  recentTestimonies: string[];
  playerUtterance: string;
}

export interface TestimonyResponse {
  lineText: string;
  emotionDelta: -1 | 0 | 1;
}

export interface AIProvider {
  readonly layer: "B" | "C";
  isAvailable(): Promise<boolean>;
  generateTestimony(req: TestimonyRequest): Promise<TestimonyResponse>;
}

/**
 * レイヤーB/Cの応答がJSONとしてパースできない、または
 * TestimonyResponseの形状に一致しない場合に投げるエラー。
 * AIProviderRouterはこれを "invalid_response" として扱う。
 */
export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

/**
 * レイヤーB/C共通のプロンプト生成。
 * 設計書 6.3 のシステムプロンプト構成に準拠する。
 * 真実の核心(truthTable.TR-*)はここに一切渡さないこと。
 */
export function buildSystemPrompt(req: TestimonyRequest): string {
  const { aiProfile, emotionState, disclosedEvidenceSummaries, recentTestimonies } = req;

  const knownFacts = aiProfile.knownFactsForSuspect.map((f) => `- ${f}`).join("\n");
  const liesToMaintain = aiProfile.liesToMaintain.map((l) => `- ${l}`).join("\n");
  const disclosedEvidence =
    disclosedEvidenceSummaries.length > 0
      ? disclosedEvidenceSummaries.map((e) => `- ${e}`).join("\n")
      : "(なし)";
  const recent =
    recentTestimonies.length > 0
      ? recentTestimonies.map((t) => `- ${t}`).join("\n")
      : "(なし)";

  return `[役割] あなたは取調室にいる容疑者です。
${aiProfile.caseSummaryForAI}

[知っている事実]
${knownFacts}

[維持すべき嘘]
${liesToMaintain}

[現在の感情状態]
${emotionState}

[開示済み証拠の要約]
${disclosedEvidence}

[直近の供述(一貫性を保つこと)]
${recent}

[指示] 与えられた事実の範囲内で答え、新しい虚偽の事実を作らないこと。核心的な事実を悟られないよう、曖昧な返答をしてもよいが、矛盾のない一貫した供述を保つこと。

[出力形式] 以下のJSONのみを出力すること。他の文章は一切含めないこと。
{"line": string, "emotionDelta": -1 | 0 | 1}`;
}

export function buildUserPrompt(req: TestimonyRequest): string {
  return req.playerUtterance;
}
