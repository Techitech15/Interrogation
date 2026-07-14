const MAX_LENGTH_DEFAULT = 400;
const MAX_LENGTH_STREAMER_MODE = 300;

const META_UTTERANCE_PATTERN = /システム|プロンプト|指示|AI|モデル|assistant/i;
const URL_PATTERN = /https?:\/\//i;

export interface ValidationOptions {
  /** aiProfile.bannedKeywords */
  bannedKeywords: string[];
  /** 配信モード(デフォルトtrue想定)。検証を厳格化 */
  streamerMode: boolean;
}

/**
 * 判定は「表示してよいなら true」。
 */
export function validateTestimony(lineText: string, opts: ValidationOptions): boolean {
  if (lineText.trim().length === 0) return false;
  if (lineText.length > MAX_LENGTH_DEFAULT) return false;

  if (opts.bannedKeywords.some((keyword) => lineText.includes(keyword))) {
    return false;
  }

  if (opts.streamerMode) {
    if (lineText.length > MAX_LENGTH_STREAMER_MODE) return false;
    if (META_UTTERANCE_PATTERN.test(lineText)) return false;
    if (URL_PATTERN.test(lineText)) return false;
  }

  return true;
}
