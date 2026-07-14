// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import type {
  TestimonyRequest,
  TestimonyResponse,
} from "../ai/AIProvider";
import { ScriptedProvider } from "../ai/ScriptedProvider";
import { createGameStore } from "../core/store";
import { loadCase001 } from "../data/loadCase";
import { App } from "./App";
import { SameTurnActionGuard } from "./SameTurnActionGuard";

class CountingProvider extends ScriptedProvider {
  calls = 0;

  override generateTestimony(request: TestimonyRequest): TestimonyResponse {
    this.calls += 1;
    return super.generateTestimony(request);
  }
}

function getButton(root: HTMLElement, selector: string): HTMLButtonElement {
  const button = root.querySelector(selector);
  expect(button).toBeInstanceOf(HTMLButtonElement);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("button not found: " + selector);
  }
  return button;
}

describe("App + Store DOM integration", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>';
  });

  it("開始から質問・追及・キャンセル・誤追及・正解・結末まで実buttonで進行する", async () => {
    const root = document.querySelector<HTMLElement>("#test-root")!;
    const bundle = loadCase001();
    const provider = new CountingProvider(bundle);
    const store = createGameStore(bundle, provider);
    let now = 1_000;
    const guard = new SameTurnActionGuard(250, () => now);
    const app = new App(root, bundle, store, guard);
    app.render();

    getButton(root, '[data-action="start"]').click();
    expect(store.getState().currentPhase).toBe("interrogation");

    getButton(root, '[data-question-id="Q-ALIBI-01"]').click();
    expect(provider.calls).toBe(1);
    expect(store.getState().testimonyLog).toHaveLength(1);
    expect(store.getState().detentionRemainingMinutes).toBe(2850);
    expect(root.textContent).toContain("処理中");
    const blockedQuestion = getButton(
      root,
      '[data-question-id="Q-ALIBI-01"]',
    );
    expect(blockedQuestion.disabled).toBe(true);
    expect(getButton(root, '[data-question-id="Q-MOTIVE-01"]').disabled).toBe(
      false,
    );

    await Promise.resolve();
    blockedQuestion.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(provider.calls).toBe(1);
    expect(store.getState().testimonyLog).toHaveLength(1);
    expect(store.getState().detentionRemainingMinutes).toBe(2850);

    getButton(root, "[data-testimony-id]").click();
    expect(store.getState().currentPhase).toBe("confrontation");
    expect(root.textContent).toContain("追及中 — 質問入力ロック");
    expect(getButton(root, '[data-question-id="Q-SINK-01"]').disabled).toBe(
      true,
    );
    getButton(root, '[data-action="cancel"]').click();
    expect(store.getState().currentPhase).toBe("interrogation");
    expect(store.getState().lastResult).toBe("追及をキャンセルしました。");
    expect(root.textContent).toContain("追及をキャンセルしました");

    getButton(root, '[data-question-id="Q-MOTIVE-01"]').click();
    expect(provider.calls).toBe(2);
    const neutralTestimonyId = store.getState().testimonyLog.at(-1)!.testimonyId;
    getButton(
      root,
      '[data-testimony-id="' + neutralTestimonyId + '"]',
    ).click();
    getButton(root, '[data-evidence-id="EV-01"]').click();
    expect(store.getState().wrongfulPressureCount).toBe(1);
    expect(store.getState().emotionState).toBe("hardened");

    getButton(root, '[data-question-id="Q-SINK-01"]').click();
    expect(provider.calls).toBe(3);
    const sinkTestimonyId = store.getState().testimonyLog.at(-1)!.testimonyId;
    getButton(
      root,
      '[data-testimony-id="' + sinkTestimonyId + '"]',
    ).click();
    getButton(root, '[data-evidence-id="EV-02"]').click();
    expect(store.getState().resolvedLieIds).toContain("LIE-02");
    expect(store.getState().lastResult).toContain("供述崩壊");

    const alibiTestimonyId = store
      .getState()
      .testimonyLog.find((testimony) => testimony.lieId === "LIE-01")!
      .testimonyId;
    now += 250;
    app.render();
    getButton(
      root,
      '[data-testimony-id="' + alibiTestimonyId + '"]',
    ).click();
    getButton(root, '[data-evidence-id="EV-01"]').click();

    expect(store.getState().ending).toBe("true_confession");
    expect(root.textContent).toContain("CASE CLOSED");
    expect(root.textContent).toContain("自白 — 事件の真相");
  });
});
