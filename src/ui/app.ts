import {
  askFreeText,
  askScriptedQuestion,
  confront,
  createInitialGameState,
  startInterrogation,
} from "../core/stateMachine";
import type { CaseBundle, EmotionState, GameState } from "../core/types";
import { loadCase } from "../data/caseLoader";
import { recordEnding } from "../persistence/saveStore";

interface UiState {
  bundle: CaseBundle;
  game: GameState;
  selectedTestimonyTurn: number | null;
  breakdownMessage: string | null;
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

export function mountApp(rootEl: HTMLElement): void {
  root = rootEl;
  const bundle = loadCase("case-001");
  ui = {
    bundle,
    game: createInitialGameState(bundle),
    selectedTestimonyTurn: null,
    breakdownMessage: null,
  };
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

function render(): void {
  root.replaceChildren();

  const container = el("div", { className: "dossier-frame" });
  container.appendChild(renderHeader());

  if (ui.game.currentPhase === "briefing") {
    container.appendChild(renderBriefing());
  } else if (ui.game.currentPhase === "ending" && !ui.breakdownMessage) {
    container.appendChild(renderEnding());
  } else {
    // Show the breakdown overlay first even if this confrontation also
    // ended the case — otherwise the finishing blow skips straight past it.
    container.appendChild(renderInterrogation());
  }

  root.appendChild(container);
}

function renderHeader(): HTMLElement {
  const header = el("header", { className: "app-header" });
  header.appendChild(el("h1", { text: "尋問 -JINMON- (プロトタイプ／P1)" }));
  header.appendChild(el("p", { className: "case-title", text: ui.bundle.case.title }));
  return header;
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
    render();
  });
  section.appendChild(startBtn);
  return section;
}

function renderInterrogation(): HTMLElement {
  const wrap = el("div", { className: "interrogation-layout" });

  wrap.appendChild(renderSuspectPanel());
  wrap.appendChild(renderDialoguePanel());
  wrap.appendChild(renderEvidencePanel());

  if (ui.breakdownMessage) {
    wrap.appendChild(renderBreakdownOverlay());
  }

  return wrap;
}

function renderSuspectPanel(): HTMLElement {
  const panel = el("div", { className: `panel suspect-panel emotion-${ui.game.emotionState}` });
  panel.appendChild(el("h2", { text: "容疑者" }));

  const silhouette = el("div", { className: "placeholder-silhouette" });
  silhouette.title = "仮アセット（後日差し替え予定）";
  panel.appendChild(silhouette);

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

function renderDialoguePanel(): HTMLElement {
  const panel = el("div", { className: "panel dialogue-panel" });
  panel.appendChild(el("h2", { text: "尋問" }));

  const questionList = el("div", { className: "question-list" });
  for (const q of ui.bundle.questions) {
    const btn = el("button", { className: "question-btn", text: q.label });
    btn.addEventListener("click", () => {
      ui.game = askScriptedQuestion(ui.game, ui.bundle, q.questionId);
      afterGameStateChange();
    });
    questionList.appendChild(btn);
  }
  panel.appendChild(questionList);

  const freeTextForm = el("form", { className: "free-text-form" });
  const input = el("input", { className: "free-text-input" });
  input.setAttribute("type", "text");
  input.setAttribute("placeholder", "自由に質問を入力…");
  const submitBtn = el("button", { text: "質問する" });
  freeTextForm.appendChild(input);
  freeTextForm.appendChild(submitBtn);
  freeTextForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    ui.game = askFreeText(ui.game, ui.bundle, value);
    afterGameStateChange();
  });
  panel.appendChild(freeTextForm);

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
    item.appendChild(el("span", { className: "testimony-text", text: entry.text }));
    if (entry.contradictionResolved) {
      item.appendChild(el("span", { className: "resolved-badge", text: "崩壊済" }));
    } else if (entry.lieId) {
      const selectBtn = el("button", { className: "confront-select-btn", text: "この供述を追及" });
      selectBtn.addEventListener("click", () => {
        ui.selectedTestimonyTurn = ui.selectedTestimonyTurn === entry.turn ? null : entry.turn;
        render();
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
        handleConfront(evidence.evidenceId);
      });
      card.appendChild(confrontBtn);
    }

    list.appendChild(card);
  }
  panel.appendChild(list);
  return panel;
}

function handleConfront(evidenceId: string): void {
  if (ui.selectedTestimonyTurn === null) return;
  const turn = ui.selectedTestimonyTurn;
  const wasResolved = ui.game.testimonyLog.find((t) => t.turn === turn)?.contradictionResolved;

  ui.game = confront(ui.game, ui.bundle, turn, evidenceId);
  ui.selectedTestimonyTurn = null;

  const nowResolved = ui.game.testimonyLog.find((t) => t.turn === turn)?.contradictionResolved;
  if (!wasResolved && nowResolved) {
    ui.breakdownMessage = "供述が崩れた……。";
  }

  afterGameStateChange();
}

function renderBreakdownOverlay(): HTMLElement {
  const overlay = el("div", { className: "breakdown-overlay" });
  overlay.appendChild(el("p", { text: ui.breakdownMessage ?? "" }));
  const continueBtn = el("button", { text: "続ける" });
  continueBtn.addEventListener("click", () => {
    ui.breakdownMessage = null;
    render();
  });
  overlay.appendChild(continueBtn);
  return overlay;
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
    ui.breakdownMessage = null;
    render();
  });
  section.appendChild(restartBtn);

  return section;
}

function afterGameStateChange(): void {
  if (ui.game.currentPhase === "ending" && ui.game.endingId) {
    recordEnding(ui.game.caseId, ui.game.endingId);
  }
  render();
}
