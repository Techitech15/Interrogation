// SCR-01 設定画面(詳細設計書 3.2 / 6.2〜6.3節)。
// ヘッダーの「設定」ボタンから開くモーダルパネルの純粋なDOM構築関数を提供する。
// 状態管理・永続化(settingsStore)・音声API呼び出しは呼び出し元(app.ts)が担当する。

import type { Settings } from "../persistence/settingsStore";

export type OllamaStatus = "checking" | "detected" | "not_detected";

export interface SettingsScreenState {
  settings: Settings;
  /** APIキー入力欄の未保存の下書き値 */
  apiKeyDraft: string;
  showApiKey: boolean;
  ollamaStatus: OllamaStatus;
}

export interface SettingsScreenActions {
  onApiKeyDraftChange(value: string): void;
  onToggleShowApiKey(): void;
  onSaveApiKey(): void;
  onToggleAiDialogue(): void;
  onToggleStreamerMode(): void;
  onToggleMuted(): void;
  onClose(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { className?: string; text?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  return node;
}

function renderToggleRow(
  label: string,
  description: string,
  checked: boolean,
  onToggle: () => void,
  disabled = false,
  disabledReason?: string,
): HTMLElement {
  const row = el("div", { className: "settings-toggle-row" });

  const textCol = el("div", { className: "settings-toggle-text" });
  textCol.appendChild(el("span", { className: "settings-toggle-label", text: label }));
  textCol.appendChild(el("p", { className: "settings-toggle-desc", text: description }));
  if (disabled && disabledReason) {
    textCol.appendChild(el("p", { className: "settings-toggle-disabled-reason", text: disabledReason }));
  }
  row.appendChild(textCol);

  const toggleBtn = el("button", {
    className: `toggle-switch ${checked ? "on" : "off"}`,
    text: checked ? "ON" : "OFF",
  });
  toggleBtn.type = "button";
  toggleBtn.disabled = disabled;
  toggleBtn.setAttribute("aria-pressed", String(checked));
  if (!disabled) {
    toggleBtn.addEventListener("click", onToggle);
  }
  row.appendChild(toggleBtn);

  return row;
}

const OLLAMA_STATUS_LABEL: Record<OllamaStatus, string> = {
  checking: "確認中…",
  detected: "検出済み",
  not_detected: "未検出",
};

export function renderSettingsScreen(state: SettingsScreenState, actions: SettingsScreenActions): HTMLElement {
  const backdrop = el("div", { className: "settings-backdrop" });

  const modal = el("div", { className: "settings-modal" });
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = el("div", { className: "settings-modal-header" });
  header.appendChild(el("h2", { text: "設定" }));
  const closeBtn = el("button", { className: "settings-close-btn", text: "×" });
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "設定を閉じる");
  closeBtn.addEventListener("click", () => actions.onClose());
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el("div", { className: "settings-modal-body" });

  // --- Gemini APIキー ---
  const keySection = el("section", { className: "settings-section" });
  keySection.appendChild(el("h3", { text: "Gemini APIキー(BYOK)" }));

  const steps = el("ol", { className: "settings-key-steps" });
  const step1 = el("li");
  const link = document.createElement("a");
  link.href = "https://aistudio.google.com/apikey";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Google AI Studio";
  step1.appendChild(document.createTextNode("1. "));
  step1.appendChild(link);
  step1.appendChild(document.createTextNode(" を開く"));
  steps.appendChild(step1);
  steps.appendChild(el("li", { text: "2. 「Create API key」を押す" }));
  steps.appendChild(el("li", { text: "3. 表示されたキーをコピーして下の欄に貼り付ける" }));
  keySection.appendChild(steps);

  const keyInputRow = el("div", { className: "settings-key-input-row" });
  const keyInput = el("input", { className: "settings-key-input" });
  keyInput.type = state.showApiKey ? "text" : "password";
  keyInput.placeholder = "APIキーを貼り付け…";
  keyInput.value = state.apiKeyDraft;
  keyInput.autocomplete = "off";
  keyInput.spellcheck = false;
  keyInput.addEventListener("input", () => actions.onApiKeyDraftChange(keyInput.value));
  keyInputRow.appendChild(keyInput);

  const showKeyBtn = el("button", { className: "settings-show-key-btn", text: state.showApiKey ? "隠す" : "表示" });
  showKeyBtn.type = "button";
  showKeyBtn.addEventListener("click", () => actions.onToggleShowApiKey());
  keyInputRow.appendChild(showKeyBtn);

  const saveKeyBtn = el("button", { className: "primary settings-save-key-btn", text: "保存" });
  saveKeyBtn.type = "button";
  saveKeyBtn.addEventListener("click", () => actions.onSaveApiKey());
  keyInputRow.appendChild(saveKeyBtn);

  keySection.appendChild(keyInputRow);

  const notices = el("div", { className: "settings-notices" });
  notices.appendChild(
    el("p", {
      className: "settings-notice",
      text: "※ キーはこの端末のブラウザにのみ保存され、外部に送信されません。",
    }),
  );
  notices.appendChild(
    el("p", {
      className: "settings-notice",
      text: "※ 無料枠の入力内容はGoogleのモデル改善に利用される場合があります。",
    }),
  );
  keySection.appendChild(notices);

  body.appendChild(keySection);

  // --- トグル類 ---
  const toggleSection = el("section", { className: "settings-section" });
  toggleSection.appendChild(el("h3", { text: "プレイ設定" }));

  const hasKey = state.settings.geminiApiKey.trim().length > 0;
  toggleSection.appendChild(
    renderToggleRow(
      "AI自由対話モード",
      "自由入力の質問をAI(レイヤーB/C)に送って応答を生成します。",
      state.settings.aiDialogueEnabled,
      () => actions.onToggleAiDialogue(),
      !hasKey,
      "Gemini APIキーを設定すると有効化できます。",
    ),
  );

  toggleSection.appendChild(
    renderToggleRow(
      "配信モード",
      "AI応答の検証を厳格化します。",
      state.settings.streamerMode,
      () => actions.onToggleStreamerMode(),
    ),
  );

  toggleSection.appendChild(
    renderToggleRow("ミュート", "すべてのSE/BGMを無音にします。", state.settings.muted, () =>
      actions.onToggleMuted(),
    ),
  );

  body.appendChild(toggleSection);

  // --- Ollama検出状態 ---
  const ollamaSection = el("section", { className: "settings-section" });
  ollamaSection.appendChild(el("h3", { text: "ローカルLLM(Ollama)" }));
  ollamaSection.appendChild(
    el("p", {
      className: `ollama-status ollama-status-${state.ollamaStatus}`,
      text: `検出状態: ${OLLAMA_STATUS_LABEL[state.ollamaStatus]}`,
    }),
  );
  body.appendChild(ollamaSection);

  modal.appendChild(body);
  backdrop.appendChild(modal);

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) actions.onClose();
  });

  return backdrop;
}
