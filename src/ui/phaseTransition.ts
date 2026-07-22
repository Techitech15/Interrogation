import type { GamePhase } from "../core/types";

export type PhaseSceneId = GamePhase;

interface PhaseSceneCopy {
  number: string;
  title: string;
  description: string;
  continueLabel: string;
}

const PHASE_SCENE_COPY: Record<PhaseSceneId, PhaseSceneCopy> = {
  briefing: {
    number: "PHASE 01",
    title: "事件ファイル",
    description: "記録を読み、取調べに備えよ。",
    continueLabel: "事件ファイルを開く",
  },
  interrogation: {
    number: "PHASE 02",
    title: "尋問",
    description: "言葉の揺れを見逃すな。",
    continueLabel: "取調室へ入る",
  },
  confrontation: {
    number: "PHASE 03",
    title: "追及",
    description: "供述と証拠を突き合わせろ。",
    continueLabel: "証拠を選ぶ",
  },
  breakdown: {
    number: "PHASE 04",
    title: "供述崩壊",
    description: "ひとつの嘘が、音を立てて崩れる。",
    continueLabel: "沈黙の先へ",
  },
  ending: {
    number: "FINAL PHASE",
    title: "結末",
    description: "記録に残るのは、真実か、それとも。",
    continueLabel: "記録を閉じる",
  },
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { className?: string; text?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  return node;
}

export function renderPhaseTransition(
  phase: PhaseSceneId,
  onContinue: () => void,
): HTMLElement {
  const copy = PHASE_SCENE_COPY[phase];
  const section = el("section", { className: `phase-transition phase-transition-${phase}` });
  const titleId = `phase-transition-title-${phase}`;
  section.setAttribute("role", "dialog");
  section.setAttribute("aria-modal", "true");
  section.setAttribute("aria-labelledby", titleId);

  const artwork = el("img", { className: "phase-transition-art" });
  artwork.src = `${import.meta.env.BASE_URL}assets/common/phase-${phase}.webp`;
  artwork.alt = "";
  artwork.width = 1600;
  artwork.height = 900;
  section.appendChild(artwork);

  const content = el("div", { className: "phase-transition-content" });
  content.appendChild(el("p", { className: "phase-transition-number", text: copy.number }));
  const title = el("h2", { className: "phase-transition-title", text: copy.title });
  title.id = titleId;
  content.appendChild(title);
  content.appendChild(el("p", { className: "phase-transition-description", text: copy.description }));

  const continueButton = el("button", {
    className: "phase-transition-continue",
    text: copy.continueLabel,
  });
  continueButton.type = "button";
  continueButton.addEventListener("click", onContinue);
  content.appendChild(continueButton);
  section.appendChild(content);

  queueMicrotask(() => continueButton.focus());
  return section;
}
