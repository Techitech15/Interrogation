import {
  AI_FREE_DIALOGUE_QUESTION_ID,
  applyAiTestimony,
  askFreeText,
  askScriptedQuestion,
  confront,
  createInitialGameState,
  startInterrogation,
} from "../core/stateMachine";
import type { Case, CaseBundle, EmotionState, EndingId, GameState } from "../core/types";
import { listCases, loadCase } from "../data/caseLoader";
import { getProgress, recordEnding } from "../persistence/saveStore";
import { loadSettings, saveSettings } from "../persistence/settingsStore";
import type { Settings } from "../persistence/settingsStore";
import { initAudio, playSe, setMuted, startBgm, stopBgm } from "../audio/engine";
import { createSuspectView } from "./suspectCanvas";
import type { SuspectView } from "./suspectCanvas";
import { renderSettingsScreen } from "./settingsScreen";
import type { OllamaStatus, SettingsScreenActions, SettingsScreenState } from "./settingsScreen";
import { renderPhaseTransition } from "./phaseTransition";
import type { PhaseSceneId } from "./phaseTransition";
import { renderCaseSelectScreen, renderTitleScreen } from "./titleScreen";
import type { CaseSelectCardVm } from "./titleScreen";
import { AIProviderRouter } from "../ai/AIProviderRouter";
import { GeminiBYOKProvider } from "../ai/GeminiBYOKProvider";
import { OllamaLocalProvider } from "../ai/OllamaLocalProvider";
import type { TestimonyRequest } from "../ai/AIProvider";

type Screen = "title" | "caseSelect" | "game";

interface UiState {
  screen: Screen;
  bundle: CaseBundle;
  game: GameState;
  selectedTestimonyTurn: number | null;
  breakdownPending: boolean;
  settings: Settings;
  settingsOpen: boolean;
  settingsApiKeyDraft: string;
  settingsShowApiKey: boolean;
  ollamaStatus: OllamaStatus;
  aiLoading: boolean;
  aiFallbackNotice: string | null;
}

function buildCaseSelectEntries(): CaseSelectCardVm[] {
  const allCases = listCases();
  const progress = getProgress();

  const isHiddenCase = (c: Case) => c.hiddenCaseUnlockFlag === "all_true_confessions";
  const regularCases = allCases.filter((c) => !isHiddenCase(c));
  const allRegularTrueConfession =
    regularCases.length > 0 &&
    regularCases.every((c) => (progress.clearedCases[c.caseId] ?? []).includes("true_confession"));

  return allCases.map((c): CaseSelectCardVm => {
    if (isHiddenCase(c) && !allRegularTrueConfession) {
      return { kind: "locked" };
    }
    return {
      kind: "open",
      caseId: c.caseId,
      title: c.title,
      difficulty: c.difficulty,
      clearedEndings: progress.clearedCases[c.caseId] ?? [],
    };
  });
}

const EMOTION_LABEL: Record<EmotionState, string> = {
  calm: "冷静",
  shaken: "動揺",
  hardened: "硬化",
};

const ENDING_LABEL: Record<string, string> = {
  true_confession: "自白 — TRUE END",
  released: "証拠不十分 — 釈放",
  wrongful_conviction: "冤罪 — BAD END",
};

let ui: UiState;
let root: HTMLElement;
let suspectView: SuspectView | null = null;
let suspectCanvasWrap: HTMLElement | null = null;
let audioInitialized = false;
let phaseScene: PhaseSceneId | null = null;
let phaseSceneContinue: (() => void) | null = null;

export function mountApp(rootEl: HTMLElement): void {
  root = rootEl;
  const bundle = loadCase("case-001");
  const settings = loadSettings();

  ui = {
    screen: "title",
    bundle,
    game: createInitialGameState(bundle),
    selectedTestimonyTurn: null,
    breakdownPending: false,
    settings,
    settingsOpen: false,
    settingsApiKeyDraft: settings.geminiApiKey,
    settingsShowApiKey: false,
    ollamaStatus: "checking",
    aiLoading: false,
    aiFallbackNotice: null,
  };

  // setMuted is a safe no-op before initAudio(); it still records the
  // desired mute state so it applies correctly once audio does init.
  setMuted(ui.settings.muted);

  suspectCanvasWrap = el("div", { className: "suspect-canvas-wrap" });
  suspectView = createSuspectView(suspectCanvasWrap, ui.bundle.suspect.suspectId);
  suspectView.setEmotion(ui.game.emotionState);

  root.addEventListener(
    "pointerdown",
    () => {
      if (audioInitialized) return;
      audioInitialized = true;
      initAudio();
    },
    { capture: true, once: true },
  );

  render();
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

function goToTitle(): void {
  clearPhaseScene();
  ui.screen = "title";
  stopBgm();
  render();
}

function goToCaseSelect(): void {
  clearPhaseScene();
  ui.screen = "caseSelect";
  stopBgm();
  render();
}

function startCase(caseId: string): void {
  clearPhaseScene();
  ui.bundle = loadCase(caseId);
  ui.game = createInitialGameState(ui.bundle);
  ui.selectedTestimonyTurn = null;
  ui.breakdownPending = false;
  ui.aiFallbackNotice = null;
  suspectView?.setSuspect(ui.bundle.suspect.suspectId);
  suspectView?.setEmotion(ui.game.emotionState);
  ui.screen = "game";
  showPhaseScene("briefing", () => render());
}

function clearPhaseScene(): void {
  phaseScene = null;
  phaseSceneContinue = null;
}

function showPhaseScene(phase: PhaseSceneId, onContinue: () => void): void {
  phaseScene = phase;
  phaseSceneContinue = onContinue;
  render();
}

function continuePhaseScene(): void {
  const onContinue = phaseSceneContinue;
  clearPhaseScene();
  if (onContinue) onContinue();
  else render();
}

function render(): void {
  root.replaceChildren();

  const container = el("div", { className: "dossier-frame" });
  container.appendChild(renderHeader());

  if (ui.screen === "title") {
    container.appendChild(
      renderTitleScreen({
        onOpenCaseSelect: () => goToCaseSelect(),
        onOpenSettings: () => openSettings(),
      }),
    );
  } else if (ui.screen === "caseSelect") {
    container.appendChild(
      renderCaseSelectScreen(buildCaseSelectEntries(), {
        onSelectCase: (caseId) => startCase(caseId),
        onBackToTitle: () => goToTitle(),
      }),
    );
  } else if (ui.game.currentPhase === "briefing") {
    container.appendChild(renderBriefing());
  } else if (ui.game.currentPhase === "ending" && !ui.breakdownPending) {
    container.appendChild(renderEnding());
  } else {
    // Show the breakdown overlay first even if this confrontation also
    // ended the case — otherwise the finishing blow skips straight past it.
    container.appendChild(renderInterrogation());
  }

  root.appendChild(container);

  if (ui.settingsOpen) {
    root.appendChild(renderSettingsOverlay());
  }

  if (phaseScene) {
    root.appendChild(renderPhaseTransition(phaseScene, continuePhaseScene));
  }
}

function renderHeader(): HTMLElement {
  const header = el("header", { className: "app-header" });

  const titleBlock = el("div", { className: "app-header-title" });
  const h1 = el("h1");
  const titleBtn = el("button", {
    className: "app-header-title-btn",
    text: "尋問 / JINMON",
  });
  titleBtn.type = "button";
  titleBtn.setAttribute("aria-label", "タイトルへ戻る");
  titleBtn.addEventListener("click", () => goToTitle());
  h1.appendChild(titleBtn);
  titleBlock.appendChild(h1);
  if (ui.screen === "game") {
    titleBlock.appendChild(el("p", { className: "case-title", text: ui.bundle.case.title }));
  }
  header.appendChild(titleBlock);

  const controls = el("div", { className: "app-header-controls" });

  const muteBtn = el("button", {
    className: "header-icon-btn",
    text: ui.settings.muted ? "🔇" : "🔊",
  });
  muteBtn.type = "button";
  muteBtn.setAttribute("aria-label", "ミュート切り替え");
  muteBtn.addEventListener("click", () => {
    setMutedAndPersist(!ui.settings.muted);
    render();
  });
  controls.appendChild(muteBtn);

  const settingsBtn = el("button", { className: "header-icon-btn", text: "⚙" });
  settingsBtn.type = "button";
  settingsBtn.setAttribute("aria-label", "設定を開く");
  settingsBtn.addEventListener("click", () => openSettings());
  controls.appendChild(settingsBtn);

  header.appendChild(controls);
  return header;
}

function setMutedAndPersist(muted: boolean): void {
  ui.settings = { ...ui.settings, muted };
  setMuted(muted);
  saveSettings(ui.settings);
}

function openSettings(): void {
  ui.settingsOpen = true;
  ui.settingsApiKeyDraft = ui.settings.geminiApiKey;
  ui.settingsShowApiKey = false;
  ui.ollamaStatus = "checking";
  render();

  const ollama = new OllamaLocalProvider();
  void ollama.isAvailable().then((available) => {
    ui.ollamaStatus = available ? "detected" : "not_detected";
    if (ui.settingsOpen) render();
  });
}

function renderSettingsOverlay(): HTMLElement {
  const state: SettingsScreenState = {
    settings: ui.settings,
    apiKeyDraft: ui.settingsApiKeyDraft,
    showApiKey: ui.settingsShowApiKey,
    ollamaStatus: ui.ollamaStatus,
  };

  const actions: SettingsScreenActions = {
    onApiKeyDraftChange(value: string) {
      // Intentionally does not re-render: the draft only needs to be
      // captured for the Save click. Re-rendering on every keystroke would
      // rebuild the whole DOM tree (see render()) and drop input focus.
      ui.settingsApiKeyDraft = value;
    },
    onToggleShowApiKey() {
      ui.settingsShowApiKey = !ui.settingsShowApiKey;
      render();
    },
    onSaveApiKey() {
      ui.settings = { ...ui.settings, geminiApiKey: ui.settingsApiKeyDraft.trim() };
      saveSettings(ui.settings);
      render();
    },
    onToggleAiDialogue() {
      if (ui.settings.geminiApiKey.trim().length === 0) return;
      ui.settings = { ...ui.settings, aiDialogueEnabled: !ui.settings.aiDialogueEnabled };
      saveSettings(ui.settings);
      render();
    },
    onToggleStreamerMode() {
      ui.settings = { ...ui.settings, streamerMode: !ui.settings.streamerMode };
      saveSettings(ui.settings);
      render();
    },
    onToggleMuted() {
      setMutedAndPersist(!ui.settings.muted);
      render();
    },
    onClose() {
      ui.settingsOpen = false;
      render();
    },
  };

  return renderSettingsScreen(state, actions);
}

function renderBriefing(): HTMLElement {
  const section = el("section", { className: "panel briefing" });
  section.appendChild(el("h2", { text: "事件ファイル" }));
  section.appendChild(el("h3", { text: "検死報告" }));
  section.appendChild(el("p", { text: ui.bundle.case.briefing.autopsyReport }));
  section.appendChild(el("h3", { text: "初動捜査メモ" }));
  section.appendChild(el("p", { text: ui.bundle.case.briefing.initialMemo }));

  const startBtn = el("button", { className: "primary", text: "尋問を開始する" });
  startBtn.addEventListener("click", () => {
    ui.game = startInterrogation(ui.game);
    showPhaseScene("interrogation", () => {
      startBgm("interrogation");
      render();
    });
  });
  section.appendChild(startBtn);
  return section;
}

function renderInterrogation(): HTMLElement {
  const wrap = el("div", { className: "interrogation-layout" });

  wrap.appendChild(renderSuspectPanel());
  wrap.appendChild(renderDialoguePanel());
  wrap.appendChild(renderEvidencePanel());

  return wrap;
}

function renderSuspectPanel(): HTMLElement {
  const panel = el("div", { className: `panel suspect-panel emotion-${ui.game.emotionState}` });
  panel.appendChild(el("h2", { text: "容疑者" }));

  suspectView?.setEmotion(ui.game.emotionState);
  if (suspectCanvasWrap) {
    panel.appendChild(suspectCanvasWrap);
  }

  panel.appendChild(
    el("p", { className: "emotion-label", text: `感情: ${EMOTION_LABEL[ui.game.emotionState]}` }),
  );

  const clockPanel = el("div", { className: "detention-clock" });
  const hours = Math.floor(ui.game.detentionRemainingMinutes / 60);
  const minutes = ui.game.detentionRemainingMinutes % 60;
  clockPanel.appendChild(
    el("p", { text: `勾留期限 残り ${hours}時間${minutes}分` }),
  );
  panel.appendChild(clockPanel);

  return panel;
}

function aiDialogueActive(): boolean {
  return ui.settings.aiDialogueEnabled && ui.settings.geminiApiKey.trim().length > 0;
}

function buildAiRequest(playerUtterance: string): TestimonyRequest {
  const disclosedEvidenceSummaries = ui.bundle.evidence
    .filter((e) => ui.game.disclosedEvidenceIds.includes(e.evidenceId))
    .map((e) => `${e.name}: ${e.description}`);

  return {
    aiProfile: ui.bundle.aiProfile,
    emotionState: ui.game.emotionState,
    disclosedEvidenceSummaries,
    recentTestimonies: ui.game.testimonyLog.slice(-5).map((t) => t.text),
    playerUtterance,
  };
}

function fallbackNoticeFor(reason: string | null): string {
  if (reason === "rate_limit") return "(APIレート制限のため定型応答)";
  return "(通信不安定のため定型応答)";
}

async function sendAiFreeText(value: string): Promise<void> {
  ui.aiLoading = true;
  ui.aiFallbackNotice = null;
  render();

  const router = new AIProviderRouter([new GeminiBYOKProvider(ui.settings.geminiApiKey), new OllamaLocalProvider()], {
    streamerMode: ui.settings.streamerMode,
  });

  const routed = await router.generateTestimony(buildAiRequest(value));
  ui.aiLoading = false;

  if (routed.response !== null) {
    ui.game = applyAiTestimony(ui.game, ui.bundle, {
      lineText: routed.response.lineText,
      emotionDelta: routed.response.emotionDelta,
    });
    ui.aiFallbackNotice = null;
  } else {
    ui.game = askFreeText(ui.game, ui.bundle, value);
    ui.aiFallbackNotice = fallbackNoticeFor(routed.fallbackReason);
  }

  playSe("testimony_appear");
  afterGameStateChange();
}

function renderDialoguePanel(): HTMLElement {
  const panel = el("div", { className: "panel dialogue-panel" });
  panel.appendChild(el("h2", { text: "尋問" }));

  const inputsDisabled = ui.aiLoading;

  const questionList = el("div", { className: "question-list" });
  for (const q of ui.bundle.questions) {
    const btn = el("button", { className: "question-btn", text: q.label });
    btn.disabled = inputsDisabled;
    btn.addEventListener("click", () => {
      ui.aiFallbackNotice = null;
      playSe("question_send");
      ui.game = askScriptedQuestion(ui.game, ui.bundle, q.questionId);
      playSe("testimony_appear");
      afterGameStateChange();
    });
    questionList.appendChild(btn);
  }
  panel.appendChild(questionList);

  const freeTextForm = el("form", { className: "free-text-form" });
  const input = el("input", { className: "free-text-input" });
  input.setAttribute("type", "text");
  input.setAttribute("placeholder", "自由に質問を入力…");
  input.disabled = inputsDisabled;
  const submitBtn = el("button", { text: "質問する" });
  submitBtn.disabled = inputsDisabled;
  freeTextForm.appendChild(input);
  freeTextForm.appendChild(submitBtn);
  freeTextForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (ui.aiLoading) return;
    const value = input.value.trim();
    if (!value) return;

    ui.aiFallbackNotice = null;
    playSe("question_send");

    if (aiDialogueActive()) {
      void sendAiFreeText(value);
    } else {
      ui.game = askFreeText(ui.game, ui.bundle, value);
      playSe("testimony_appear");
      afterGameStateChange();
    }
  });
  panel.appendChild(freeTextForm);

  if (ui.aiLoading) {
    panel.appendChild(el("p", { className: "ai-loading", text: "……容疑者が考えている……" }));
  } else if (ui.aiFallbackNotice) {
    panel.appendChild(el("p", { className: "ai-fallback-notice", text: ui.aiFallbackNotice }));
  }

  panel.appendChild(renderTestimonyLog());

  return panel;
}

function renderTestimonyLog(): HTMLElement {
  const logPanel = el("div", { className: "testimony-log" });
  logPanel.appendChild(el("h3", { text: "供述ノート" }));

  if (ui.game.testimonyLog.length === 0) {
    logPanel.appendChild(el("p", { className: "empty-hint", text: "まだ供述はありません。" }));
    return logPanel;
  }

  const list = el("ul", { className: "testimony-list" });
  for (const entry of ui.game.testimonyLog) {
    const item = el("li", {
      className: `testimony-entry ${ui.selectedTestimonyTurn === entry.turn ? "selected" : ""}`,
    });
    item.appendChild(el("span", { className: "turn-no", text: `#${entry.turn}` }));
    if (entry.questionId === AI_FREE_DIALOGUE_QUESTION_ID) {
      item.appendChild(el("span", { className: "ai-badge", text: "AI" }));
    }
    item.appendChild(el("span", { className: "testimony-text", text: entry.text }));
    if (entry.contradictionResolved) {
      item.appendChild(el("span", { className: "resolved-badge", text: "崩壊済" }));
    } else if (entry.lieId) {
      const selectBtn = el("button", { className: "confront-select-btn", text: "この供述を追及" });
      selectBtn.addEventListener("click", () => {
        const wasSelected = ui.selectedTestimonyTurn === entry.turn;
        ui.selectedTestimonyTurn = wasSelected ? null : entry.turn;
        if (!wasSelected) playSe("confront_select");
        if (wasSelected) render();
        else showPhaseScene("confrontation", () => render());
      });
      item.appendChild(selectBtn);
    }
    list.appendChild(item);
  }
  logPanel.appendChild(list);
  return logPanel;
}

function renderEvidencePanel(): HTMLElement {
  const panel = el("div", { className: "panel evidence-panel" });
  panel.appendChild(el("h2", { text: "証拠品" }));

  const list = el("div", { className: "evidence-list" });
  for (const evidence of ui.bundle.evidence) {
    if (!ui.game.disclosedEvidenceIds.includes(evidence.evidenceId)) continue;

    const card = el("div", { className: "evidence-card" });
    card.appendChild(el("h3", { text: evidence.name }));
    card.appendChild(el("p", { text: evidence.description }));

    if (ui.selectedTestimonyTurn !== null) {
      const confrontBtn = el("button", { className: "confront-btn", text: "この証拠を突きつける" });
      confrontBtn.addEventListener("click", () => {
        void handleConfront(evidence.evidenceId);
      });
      card.appendChild(confrontBtn);
    }

    list.appendChild(card);
  }
  panel.appendChild(list);
  return panel;
}

async function handleConfront(evidenceId: string): Promise<void> {
  if (ui.selectedTestimonyTurn === null) return;
  const turn = ui.selectedTestimonyTurn;
  const wasResolved = ui.game.testimonyLog.find((t) => t.turn === turn)?.contradictionResolved;

  ui.game = confront(ui.game, ui.bundle, turn, evidenceId);
  ui.selectedTestimonyTurn = null;

  const nowResolved = ui.game.testimonyLog.find((t) => t.turn === turn)?.contradictionResolved;

  if (!wasResolved && nowResolved) {
    // confront_success's preset stops the BGM automatically (stopBgmFirst).
    playSe("confront_success");
    if (suspectView) {
      await suspectView.playBreakdown();
    }
    ui.breakdownPending = true;
    // Persist a finishing confrontation before the player advances through
    // the two-part breakdown -> ending presentation.
    if (ui.game.currentPhase === "ending" && ui.game.endingId) {
      recordEnding(ui.game.caseId, ui.game.endingId);
    }
    startBgm("silence");
    showPhaseScene("breakdown", () => {
      ui.breakdownPending = false;
      suspectView?.resetPose();
      if (ui.game.currentPhase === "ending") {
        showEndingPhase();
      } else {
        startBgm("interrogation");
        render();
      }
    });
    return;
  }

  playSe("confront_fail");
  afterGameStateChange();
}

function playEndingSe(endingId: EndingId): void {
  if (endingId === "true_confession") playSe("ending_true");
  else if (endingId === "wrongful_conviction") playSe("ending_bad");
  else playSe("ending_released");
}

function renderEnding(): HTMLElement {
  const section = el("section", { className: "panel ending" });
  const endingId = ui.game.endingId ?? "released";
  section.appendChild(el("h2", { text: ENDING_LABEL[endingId] ?? endingId }));

  section.appendChild(
    el("p", {
      text: `尋問ターン数: ${ui.game.turn} ／ 誤った追及: ${ui.game.wrongfulPressureCount}回`,
    }),
  );

  const restartBtn = el("button", { className: "primary", text: "もう一度この事件を尋問する" });
  restartBtn.addEventListener("click", () => {
    ui.game = createInitialGameState(ui.bundle);
    ui.selectedTestimonyTurn = null;
    ui.breakdownPending = false;
    suspectView?.resetPose();
    suspectView?.setEmotion(ui.game.emotionState);
    showPhaseScene("briefing", () => render());
  });
  section.appendChild(restartBtn);

  const backToSelectBtn = el("button", { className: "back-to-select-btn", text: "事件選択へ戻る" });
  backToSelectBtn.type = "button";
  backToSelectBtn.addEventListener("click", () => goToCaseSelect());
  section.appendChild(backToSelectBtn);

  return section;
}

function showEndingPhase(): void {
  if (ui.game.endingId) {
    recordEnding(ui.game.caseId, ui.game.endingId);
    playEndingSe(ui.game.endingId);
  }
  showPhaseScene("ending", () => render());
}

function afterGameStateChange(): void {
  if (ui.game.currentPhase === "ending") {
    showEndingPhase();
    return;
  }

  if (ui.game.currentPhase === "interrogation" && !ui.breakdownPending) {
    startBgm(ui.game.emotionState === "shaken" ? "tension" : "interrogation");
  }

  render();
}
