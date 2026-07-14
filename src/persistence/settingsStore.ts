// 設定の永続化(LocalStorage)。
// APIキーは設定本体と別キーに分離保存する(4.7節)。
// localStorageが利用できない環境(プライベートモード等)でも例外を投げない。

const SETTINGS_KEY = "jinmon.settings";
const API_KEY_STORAGE_KEY = "jinmon.apiKey.gemini";

export interface Settings {
  /** 空文字列 = 未設定 */
  geminiApiKey: string;
  streamerMode: boolean;
  aiDialogueEnabled: boolean;
  muted: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: "",
  streamerMode: true,
  aiDialogueEnabled: false,
  muted: false,
};

interface StoredSettingsShape {
  streamerMode?: unknown;
  aiDialogueEnabled?: unknown;
  muted?: unknown;
}

function readStoredSettings(): StoredSettingsShape {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as StoredSettingsShape;
  } catch {
    return {};
  }
}

function readApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function loadSettings(): Settings {
  const stored = readStoredSettings();
  return {
    geminiApiKey: readApiKey(),
    streamerMode: typeof stored.streamerMode === "boolean" ? stored.streamerMode : DEFAULT_SETTINGS.streamerMode,
    aiDialogueEnabled:
      typeof stored.aiDialogueEnabled === "boolean" ? stored.aiDialogueEnabled : DEFAULT_SETTINGS.aiDialogueEnabled,
    muted: typeof stored.muted === "boolean" ? stored.muted : DEFAULT_SETTINGS.muted,
  };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        streamerMode: s.streamerMode,
        aiDialogueEnabled: s.aiDialogueEnabled,
        muted: s.muted,
      }),
    );
  } catch {
    // localStorage unavailable — settings simply won't persist.
  }

  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, s.geminiApiKey);
  } catch {
    // localStorage unavailable — key simply won't persist.
  }
}
