// SCR-00 タイトル画面 / SCR-02 事件選択画面(詳細設計書 3.1〜3.2節)。
// 純粋なDOM構築関数のみを提供する。状態管理・永続化・音声API呼び出しは
// 呼び出し元(app.ts)が担当する(settingsScreen.tsと同じ分離方針)。

import type { EndingId } from "../core/types";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { className?: string; text?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  return node;
}

const ENDING_BADGE_LABEL: Record<EndingId, string> = {
  true_confession: "自白",
  released: "釈放",
  wrongful_conviction: "冤罪",
};

const ENDING_BADGE_CLASS: Record<EndingId, string> = {
  true_confession: "ending-badge-true",
  released: "ending-badge-released",
  wrongful_conviction: "ending-badge-wrongful",
};

// --- SCR-00 タイトル ---

export interface TitleScreenActions {
  onOpenCaseSelect(): void;
  onOpenSettings(): void;
}

export function renderTitleScreen(actions: TitleScreenActions): HTMLElement {
  const section = el("section", { className: "panel title-screen" });

  const logo = el("div", { className: "title-logo" });
  logo.appendChild(el("p", { className: "title-logo-main", text: "尋問 -JINMON-" }));
  logo.appendChild(
    el("p", { className: "title-logo-sub", text: "嘘をつくAI容疑者 尋問アドベンチャー" }),
  );
  section.appendChild(logo);

  const menu = el("div", { className: "title-menu" });

  const openCaseSelectBtn = el("button", {
    className: "primary title-menu-btn",
    text: "事件ファイルを開く",
  });
  openCaseSelectBtn.type = "button";
  openCaseSelectBtn.addEventListener("click", () => actions.onOpenCaseSelect());
  menu.appendChild(openCaseSelectBtn);

  const settingsBtn = el("button", { className: "title-menu-btn", text: "設定" });
  settingsBtn.type = "button";
  settingsBtn.addEventListener("click", () => actions.onOpenSettings());
  menu.appendChild(settingsBtn);

  section.appendChild(menu);

  section.appendChild(
    el("p", { className: "title-footnote", text: "配信・収益化・切り抜き自由" }),
  );

  return section;
}

// --- SCR-02 事件選択 ---

/**
 * 事件選択カード1枚分の表示用データ。
 * "locked" は隠し事件が未解放の状態(caseId/titleを画面に一切渡さない)。
 */
export type CaseSelectCardVm =
  | { kind: "open"; caseId: string; title: string; difficulty: number; clearedEndings: EndingId[] }
  | { kind: "locked" };

const DIFFICULTY_MAX_STARS = 5;

function difficultyStars(difficulty: number): string {
  const filled = Math.min(DIFFICULTY_MAX_STARS, Math.max(1, Math.round(difficulty)));
  return "★".repeat(filled) + "☆".repeat(DIFFICULTY_MAX_STARS - filled);
}

export interface CaseSelectScreenActions {
  onSelectCase(caseId: string): void;
  onBackToTitle(): void;
}

function renderCaseCard(card: CaseSelectCardVm, actions: CaseSelectScreenActions): HTMLElement {
  if (card.kind === "locked") {
    const locked = el("div", { className: "case-card case-card-locked" });
    locked.appendChild(
      el("p", { className: "case-card-caseid", text: "CASE FILE No. ▓▓▓▓▓▓" }),
    );
    locked.appendChild(el("h3", { text: "▓▓▓▓▓▓▓▓(機密事件)" }));
    locked.appendChild(
      el("p", { className: "case-card-hint", text: "全事件の真相解明後に開示" }),
    );
    return locked;
  }

  const cardBtn = el("button", { className: "case-card" });
  cardBtn.type = "button";
  cardBtn.appendChild(
    el("p", { className: "case-card-caseid", text: `CASE FILE No. ${card.caseId}` }),
  );
  cardBtn.appendChild(el("h3", { text: card.title }));
  cardBtn.appendChild(
    el("p", { className: "case-card-difficulty", text: `難易度 ${difficultyStars(card.difficulty)}` }),
  );

  const badgeRow = el("div", { className: "case-card-badges" });
  if (card.clearedEndings.length === 0) {
    badgeRow.appendChild(
      el("span", { className: "ending-badge ending-badge-unsolved", text: "未解決" }),
    );
  } else {
    for (const endingId of card.clearedEndings) {
      badgeRow.appendChild(
        el("span", {
          className: `ending-badge ${ENDING_BADGE_CLASS[endingId]}`,
          text: ENDING_BADGE_LABEL[endingId],
        }),
      );
    }
  }
  cardBtn.appendChild(badgeRow);

  cardBtn.addEventListener("click", () => actions.onSelectCase(card.caseId));
  return cardBtn;
}

export function renderCaseSelectScreen(
  cards: CaseSelectCardVm[],
  actions: CaseSelectScreenActions,
): HTMLElement {
  const section = el("section", { className: "panel case-select" });
  section.appendChild(el("h2", { text: "事件ファイルを選ぶ" }));

  const grid = el("div", { className: "case-card-grid" });
  for (const card of cards) {
    grid.appendChild(renderCaseCard(card, actions));
  }
  section.appendChild(grid);

  const backBtn = el("button", { className: "back-to-title", text: "タイトルへ戻る" });
  backBtn.type = "button";
  backBtn.addEventListener("click", () => actions.onBackToTitle());
  section.appendChild(backBtn);

  return section;
}
