import type { GameStore } from "../core/store";
import type {
  CaseBundle,
  EmotionState,
  EndingType,
  GamePhase,
  GameState,
  Testimony,
} from "../core/types";
import { SameTurnActionGuard } from "./SameTurnActionGuard";
import type { DeepReadonly } from "../core/immutability";

const phaseLabels: Record<GamePhase, string> = {
  briefing: "事件ファイル",
  interrogation: "尋問",
  confrontation: "追及",
  ending: "結末",
};

const emotionLabels: Record<EmotionState, string> = {
  calm: "冷静",
  shaken: "動揺",
  hardened: "硬化",
};

const endingContent: Record<
  EndingType,
  { title: string; description: string }
> = {
  wrongful_conviction: {
    title: "冤罪 — 強要された自白",
    description:
      "強引な追及によって自白は得られました。しかし、真実へ至る証拠はありませんでした。",
  },
  true_confession: {
    title: "自白 — 事件の真相",
    description:
      "すべての嘘を証拠で崩し、容疑者はついに事件の真相を語りました。",
  },
  released: {
    title: "釈放 — 証拠不十分",
    description:
      "勾留期限が尽きました。矛盾を崩し切れず、容疑者は釈放されました。",
  },
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRemainingTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours + "時間 " + rest + "分";
}

function renderStatus(state: DeepReadonly<GameState>): string {
  return [
    '<dl class="status-grid" aria-label="現在の状況">',
    "<div><dt>フェーズ</dt><dd>",
    phaseLabels[state.currentPhase],
    "</dd></div>",
    "<div><dt>残り時間</dt><dd>",
    formatRemainingTime(state.detentionRemainingMinutes),
    "</dd></div>",
    "<div><dt>感情</dt><dd>",
    emotionLabels[state.emotionState],
    "（",
    String(state.emotionScore),
    "）</dd></div>",
    "<div><dt>誤追及</dt><dd>",
    String(state.wrongfulPressureCount),
    "回</dd></div>",
    "</dl>",
  ].join("");
}

type IsActionBlocked = (actionKey: string) => boolean;

function renderBriefing(
  bundle: DeepReadonly<CaseBundle>,
  isBlocked: IsActionBlocked,
): string {
  return [
    '<main class="panel briefing-panel">',
    '<p class="eyebrow">CASE FILE ',
    escapeHtml(bundle.case.caseId.toUpperCase()),
    "</p>",
    "<h2>",
    escapeHtml(bundle.case.title),
    "</h2>",
    "<h3>検死報告</h3><p>",
    escapeHtml(bundle.case.briefing.autopsyReport),
    "</p>",
    "<h3>初動捜査メモ</h3><p>",
    escapeHtml(bundle.case.briefing.initialMemo),
    "</p>",
    '<button type="button" class="primary" data-action="start"',
    isBlocked("action:start") ? " disabled" : "",
    ">尋問開始</button>",
    "</main>",
  ].join("");
}

function renderQuestionArea(
  bundle: DeepReadonly<CaseBundle>,
  state: DeepReadonly<GameState>,
  isBlocked: IsActionBlocked,
): string {
  const hasBlockedQuestion = bundle.questions.some((question) =>
    isBlocked("question:" + question.questionId),
  );
  const buttons = bundle.questions
    .map((question) => {
      const disabled =
        state.currentPhase !== "interrogation" ||
        isBlocked("question:" + question.questionId);
      return [
        '<button type="button" class="question-button" data-question-id="',
        escapeHtml(question.questionId),
        '"',
        disabled ? " disabled" : "",
        ">",
        escapeHtml(question.label),
        "<span>30分</span></button>",
      ].join("");
    })
    .join("");
  return [
    '<section class="panel" aria-labelledby="questions-heading">',
    '<div class="section-heading"><h2 id="questions-heading">質問</h2>',
    state.currentPhase !== "interrogation"
      ? [
          '<span class="lock-label" role="status">',
          "追及中 — 質問入力ロック</span>",
        ].join("")
      : hasBlockedQuestion
        ? '<span class="lock-label" role="status">処理中 — 同じ質問を一時ロック</span>'
      : "",
    "</div>",
    '<div class="question-list">',
    buttons,
    "</div></section>",
  ].join("");
}

function testimonyStatus(testimony: DeepReadonly<Testimony>): string {
  if (testimony.contradictionResolved) {
    return '<span class="resolved-label">解消済み</span>';
  }
  return '<span class="neutral-label">記録済み</span>';
}

export function renderTestimonyLog(
  bundle: DeepReadonly<CaseBundle>,
  state: DeepReadonly<GameState>,
  isBlocked: IsActionBlocked = () => false,
): string {
  if (state.testimonyLog.length === 0) {
    return '<p class="empty-state">供述はまだありません。</p>';
  }
  return [...state.testimonyLog]
    .reverse()
    .map((testimony) => {
      const question = bundle.questions.find(
        (item) => item.questionId === testimony.questionId,
      );
      const canConfront =
        state.currentPhase === "interrogation" &&
        !testimony.contradictionResolved &&
        !isBlocked("testimony:" + testimony.testimonyId);
      return [
        '<article class="testimony-card',
        state.selectedTestimonyId === testimony.testimonyId ? " selected" : "",
        '">',
        '<div class="testimony-meta"><span>TURN ',
        String(testimony.turn),
        "</span>",
        testimonyStatus(testimony),
        "</div>",
        "<p><strong>",
        escapeHtml(question?.label ?? testimony.questionId),
        "</strong></p>",
        "<blockquote>",
        escapeHtml(testimony.text),
        "</blockquote>",
        '<p class="emotion-at-time">発言時の感情: ',
        emotionLabels[testimony.emotionAtTime],
        "</p>",
        [
          '<button type="button" data-testimony-id="',
          escapeHtml(testimony.testimonyId),
          '"',
          canConfront ? "" : " disabled",
          ">",
          testimony.contradictionResolved
            ? "この供述は解消済み"
            : "この供述を追及",
          "</button>",
        ].join(""),
        "</article>",
      ].join("");
    })
    .join("");
}

function renderEvidencePicker(
  bundle: DeepReadonly<CaseBundle>,
  state: DeepReadonly<GameState>,
  isBlocked: IsActionBlocked,
): string {
  if (state.currentPhase !== "confrontation") {
    return "";
  }
  const evidence = bundle.evidence
    .filter((item) => state.disclosedEvidenceIds.includes(item.evidenceId))
    .map((item) => {
      const disabled = isBlocked(
        "evidence:" +
          (state.selectedTestimonyId ?? "none") +
          ":" +
          item.evidenceId,
      );
      return [
        '<button type="button" class="evidence-card" data-evidence-id="',
        escapeHtml(item.evidenceId),
        '"',
        disabled ? " disabled" : "",
        "><strong>",
        escapeHtml(item.name),
        "</strong><span>",
        escapeHtml(item.description),
        "</span></button>",
      ].join("");
    })
    .join("");
  return [
    '<section class="panel confrontation-panel" aria-labelledby="evidence-heading">',
    '<h2 id="evidence-heading">追及する証拠を選択</h2>',
    '<div class="evidence-list">',
    evidence,
    "</div>",
    '<button type="button" class="secondary" data-action="cancel"',
    isBlocked(
      "action:cancel:" + (state.selectedTestimonyId ?? "none"),
    )
      ? " disabled"
      : "",
    ">キャンセル</button>",
    "</section>",
  ].join("");
}

function renderEvidenceInventory(
  bundle: DeepReadonly<CaseBundle>,
  state: DeepReadonly<GameState>,
): string {
  const items = bundle.evidence
    .filter((item) => state.disclosedEvidenceIds.includes(item.evidenceId))
    .map((item) =>
      [
        "<li><strong>",
        escapeHtml(item.name),
        "</strong><span>",
        escapeHtml(item.description),
        "</span></li>",
      ].join(""),
    )
    .join("");
  return [
    '<details class="panel evidence-inventory">',
    "<summary>所持証拠（",
    String(state.disclosedEvidenceIds.length),
    "件）</summary>",
    "<ul>",
    items,
    "</ul></details>",
  ].join("");
}

function renderInterrogation(
  bundle: DeepReadonly<CaseBundle>,
  state: DeepReadonly<GameState>,
  isBlocked: IsActionBlocked,
): string {
  return [
    '<main class="game-grid">',
    '<div class="main-column">',
    '<section class="panel suspect-panel" aria-labelledby="suspect-heading">',
    '<p class="eyebrow">SUSPECT</p><h2 id="suspect-heading">',
    escapeHtml(bundle.suspect.name),
    "</h2>",
    '<p class="suspect-emotion">現在の状態: <strong>',
    emotionLabels[state.emotionState],
    "</strong></p></section>",
    renderQuestionArea(bundle, state, isBlocked),
    renderEvidenceInventory(bundle, state),
    renderEvidencePicker(bundle, state, isBlocked),
    "</div>",
    '<aside class="panel testimony-panel" aria-labelledby="testimony-heading">',
    '<h2 id="testimony-heading">供述ノート</h2>',
    renderTestimonyLog(bundle, state, isBlocked),
    "</aside></main>",
  ].join("");
}

function renderEnding(
  state: DeepReadonly<GameState>,
  isBlocked: IsActionBlocked,
): string {
  if (state.ending === null) {
    return "";
  }
  const content = endingContent[state.ending];
  return [
    '<main class="panel ending-panel">',
    '<p class="eyebrow">CASE CLOSED</p>',
    "<h2>",
    escapeHtml(content.title),
    "</h2><p>",
    escapeHtml(content.description),
    "</p>",
    '<button type="button" class="primary" data-action="restart"',
    isBlocked("action:restart") ? " disabled" : "",
    ">事件ファイルへ戻る</button>",
    "</main>",
  ].join("");
}

export class App {
  constructor(
    private readonly root: HTMLElement,
    private readonly bundle: DeepReadonly<CaseBundle>,
    private readonly store: GameStore,
    private readonly actionGuard = new SameTurnActionGuard(),
  ) {
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.store.subscribe(() => this.render());
  }

  render(): void {
    const state = this.store.getState();
    const isBlocked = (actionKey: string): boolean =>
      this.actionGuard.isBlocked(actionKey);
    const resultClass = state.lastResult.startsWith("供述崩壊")
      ? "result-banner breakdown"
      : "result-banner";
    let content: string;
    if (state.currentPhase === "briefing") {
      content = renderBriefing(this.bundle, isBlocked);
    } else if (state.currentPhase === "ending") {
      content = renderEnding(state, isBlocked);
    } else {
      content = renderInterrogation(
        this.bundle,
        state,
        isBlocked,
      );
    }
    this.root.innerHTML = [
      '<div class="app-shell">',
      '<header class="app-header"><div><p class="eyebrow">INTERROGATION ADV</p>',
      "<h1>尋問 <span>-JINMON-</span></h1></div>",
      renderStatus(state),
      "</header>",
      '<div class="' + resultClass + '" role="status" aria-live="polite">',
      escapeHtml(state.lastResult),
      "</div>",
      content,
      "</div>",
    ].join("");
  }

  private handleClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest("button");
    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      return;
    }
    const actionKey = this.actionKey(button);
    if (actionKey === null) {
      return;
    }
    const accepted = this.actionGuard.run(actionKey, () =>
      this.executeButton(button),
    );
    if (accepted) {
      this.render();
      window.setTimeout(
        () => this.render(),
        Math.ceil(this.actionGuard.remainingMilliseconds(actionKey)) + 1,
      );
    }
  }

  private actionKey(button: HTMLButtonElement): string | null {
    if (button.dataset.action !== undefined) {
      if (button.dataset.action === "cancel") {
        return (
          "action:cancel:" +
          (this.store.getState().selectedTestimonyId ?? "none")
        );
      }
      return "action:" + button.dataset.action;
    }
    if (button.dataset.questionId !== undefined) {
      return "question:" + button.dataset.questionId;
    }
    if (button.dataset.testimonyId !== undefined) {
      return "testimony:" + button.dataset.testimonyId;
    }
    if (button.dataset.evidenceId !== undefined) {
      return (
        "evidence:" +
        (this.store.getState().selectedTestimonyId ?? "none") +
        ":" +
        button.dataset.evidenceId
      );
    }
    return null;
  }

  private executeButton(button: HTMLButtonElement): void {
    const action = button.dataset.action;
    if (action === "start") {
      this.store.startInterrogation();
      return;
    }
    if (action === "cancel") {
      this.store.cancelConfrontation();
      return;
    }
    if (action === "restart") {
      this.store.restart();
      return;
    }
    const questionId = button.dataset.questionId;
    if (questionId !== undefined) {
      this.store.askQuestion(questionId);
      return;
    }
    const testimonyId = button.dataset.testimonyId;
    if (testimonyId !== undefined) {
      this.store.beginConfrontation(testimonyId);
      return;
    }
    const evidenceId = button.dataset.evidenceId;
    if (evidenceId !== undefined) {
      this.store.confront(evidenceId);
    }
  }
}

export function renderFatalError(root: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = [
    '<main class="fatal-error" role="alert">',
    "<h1>事件データを読み込めません</h1>",
    "<p>起動時検証で問題が見つかりました。データを修正して再読み込みしてください。</p>",
    "<pre>",
    escapeHtml(message),
    "</pre></main>",
  ].join("");
}
