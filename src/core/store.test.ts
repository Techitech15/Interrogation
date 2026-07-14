import { describe, expect, it } from "vitest";
import { ScriptedProvider } from "../ai/ScriptedProvider";
import type {
  TestimonyRequest,
  TestimonyResponse,
} from "../ai/AIProvider";
import { loadCase001 } from "../data/loadCase";
import { createGameStore } from "./store";
import type { CaseBundle, GameState, Testimony } from "./types";
import type { DeepReadonly } from "./immutability";

class CountingProvider extends ScriptedProvider {
  calls = 0;

  override generateTestimony(request: TestimonyRequest): TestimonyResponse {
    this.calls += 1;
    return super.generateTestimony(request);
  }
}

function mutableBundle(): CaseBundle {
  return structuredClone(loadCase001()) as CaseBundle;
}

function makeStore(bundle: DeepReadonly<CaseBundle> = loadCase001()) {
  return createGameStore(bundle, new ScriptedProvider(bundle));
}

function askAndSelect(
  store: ReturnType<typeof makeStore>,
  questionId: string,
): string {
  store.askQuestion(questionId);
  const testimony = store.getState().testimonyLog.at(-1);
  expect(testimony).toBeDefined();
  if (testimony === undefined) {
    throw new Error("供述が作成されませんでした");
  }
  store.beginConfrontation(testimony.testimonyId);
  return testimony.testimonyId;
}

function gameResources(state: DeepReadonly<GameState>) {
  return {
    detentionRemainingMinutes: state.detentionRemainingMinutes,
    emotionScore: state.emotionScore,
    emotionState: state.emotionState,
    testimonyLog: state.testimonyLog,
    resolvedLieIds: state.resolvedLieIds,
    wrongfulPressureCount: state.wrongfulPressureCount,
    falseConfessionTriggered: state.falseConfessionTriggered,
    turn: state.turn,
    ending: state.ending,
  };
}

describe("game store core loop", () => {
  it("事件概要から開始し質問で同期供述を追加して30分消費する", () => {
    const store = makeStore();
    store.startInterrogation();
    store.askQuestion("Q-ALIBI-01");

    const state = store.getState();
    expect(state.currentPhase).toBe("interrogation");
    expect(state.detentionRemainingMinutes).toBe(2850);
    expect(state.testimonyLog).toHaveLength(1);
    expect(state.testimonyLog[0]!.testimonyId).toBe(
      "case-001:1:Q-ALIBI-01",
    );
    expect(state.testimonyLog[0]!.lieId).toBe("LIE-01");
  });

  it("キャンセルはゲーム資源を変更しない", () => {
    const store = makeStore();
    store.startInterrogation();
    store.askQuestion("Q-ALIBI-01");
    const before = gameResources(store.getState());
    const testimonyId = store.getState().testimonyLog[0]!.testimonyId;
    store.beginConfrontation(testimonyId);
    expect(store.getState().currentPhase).toBe("confrontation");
    store.cancelConfrontation();

    expect(store.getState().currentPhase).toBe("interrogation");
    expect(gameResources(store.getState())).toEqual(before);
    expect(store.getState().lastResult).toBe("追及をキャンセルしました。");
  });

  it("正解追及を反映してから全嘘解消で自白へ到達する", () => {
    const store = makeStore();
    store.startInterrogation();
    askAndSelect(store, "Q-ALIBI-01");
    store.confront("EV-01");
    expect(store.getState().resolvedLieIds).toEqual(["LIE-01"]);
    expect(store.getState().detentionRemainingMinutes).toBe(2790);
    expect(store.getState().emotionState).toBe("shaken");

    askAndSelect(store, "Q-SINK-01");
    store.confront("EV-02");
    expect(store.getState().currentPhase).toBe("ending");
    expect(store.getState().ending).toBe("true_confession");
  });

  it("誤追及3回で冤罪へ到達する", () => {
    const store = makeStore();
    store.startInterrogation();
    const testimonyId = askAndSelect(store, "Q-ALIBI-01");
    store.confront("EV-03");
    store.beginConfrontation(testimonyId);
    store.confront("EV-03");
    store.beginConfrontation(testimonyId);
    store.confront("EV-03");

    expect(store.getState().wrongfulPressureCount).toBe(3);
    expect(store.getState().falseConfessionTriggered).toBe(true);
    expect(store.getState().emotionState).toBe("hardened");
    expect(store.getState().ending).toBe("wrongful_conviction");
  });

  it("質問で期限を跨ぐと結果反映後に釈放へ到達する", () => {
    const bundle = mutableBundle();
    bundle.case.detentionLimitMinutes = 30;
    const store = makeStore(bundle);
    store.startInterrogation();
    store.askQuestion("Q-MOTIVE-01");

    expect(store.getState().testimonyLog).toHaveLength(1);
    expect(store.getState().detentionRemainingMinutes).toBe(0);
    expect(store.getState().ending).toBe("released");
  });

  it("期限を跨ぐ正解結果を反映して自白を釈放より優先する", () => {
    const bundle = mutableBundle();
    bundle.case.detentionLimitMinutes = 90;
    bundle.suspect.lieTable = [bundle.suspect.lieTable[0]!];
    const store = makeStore(bundle);
    store.startInterrogation();
    askAndSelect(store, "Q-ALIBI-01");
    store.confront("EV-01");

    expect(store.getState().detentionRemainingMinutes).toBe(0);
    expect(store.getState().resolvedLieIds).toEqual(["LIE-01"]);
    expect(store.getState().ending).toBe("true_confession");
  });

  it("解消済み供述への再追及は完全に無変更", () => {
    const store = makeStore();
    store.startInterrogation();
    const testimonyId = askAndSelect(store, "Q-ALIBI-01");
    store.confront("EV-01");
    const before = store.getState();
    store.beginConfrontation(testimonyId);
    expect(store.getState()).toBe(before);
  });

  it("lieIdのない供述も追及でき、誤追及として処理する", () => {
    const store = makeStore();
    store.startInterrogation();
    store.askQuestion("Q-MOTIVE-01");
    const testimony = store.getState().testimonyLog[0]!;
    expect(testimony.lieId).toBeUndefined();

    expect(store.beginConfrontation(testimony.testimonyId)).toEqual({
      ok: true,
      code: "ok",
    });
    store.confront("EV-03");
    expect(store.getState().wrongfulPressureCount).toBe(1);
    expect(store.getState().detentionRemainingMinutes).toBe(2730);
  });

  it("未知IDと無効phaseは例外や課金なしの失敗結果にする", () => {
    const bundle = loadCase001();
    const provider = new CountingProvider(bundle);
    const store = createGameStore(bundle, provider);
    const briefingState = store.getState();

    expect(store.askQuestion("Q-NOT-FOUND")).toEqual({
      ok: false,
      code: "invalid_phase",
    });
    expect(store.getState()).toBe(briefingState);

    store.startInterrogation();
    const interrogationState = store.getState();
    expect(store.askQuestion("Q-NOT-FOUND")).toEqual({
      ok: false,
      code: "unknown_question",
    });
    expect(provider.calls).toBe(0);
    expect(store.getState()).toBe(interrogationState);

    expect(store.beginConfrontation("TESTIMONY-NOT-FOUND")).toEqual({
      ok: false,
      code: "unknown_testimony",
    });
    expect(store.getState()).toBe(interrogationState);
  });

  it("未知または未開示の証拠を無変更で拒否する", () => {
    const bundle = mutableBundle();
    bundle.evidence[2]!.unlockedFrom = "interrogation";
    const store = makeStore(bundle);
    store.startInterrogation();
    askAndSelect(store, "Q-ALIBI-01");
    const before = store.getState();

    expect(store.confront("EV-NOT-FOUND")).toEqual({
      ok: false,
      code: "unknown_evidence",
    });
    expect(store.getState()).toBe(before);
    expect(store.confront("EV-03")).toEqual({
      ok: false,
      code: "evidence_unavailable",
    });
    expect(store.getState()).toBe(before);
  });

  it("公開状態をdeep freezeして外部破壊を拒否する", () => {
    const store = makeStore();
    const state = store.getState();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.testimonyLog)).toBe(true);
    if (false) {
      // @ts-expect-error DeepReadonly prevents array mutation.
      state.testimonyLog.push({} as Testimony);
      // @ts-expect-error DeepReadonly prevents nested assignment.
      state.emotionScore = 2;
    }
    expect(() =>
      (state.testimonyLog as Testimony[]).push({} as Testimony),
    ).toThrow(TypeError);
    expect(store.getState().testimonyLog).toHaveLength(0);
  });

  it("生成後に入力bundleを破壊してもStore正本へ影響させない", () => {
    const supplied = mutableBundle();
    const store = createGameStore(supplied, new ScriptedProvider(supplied));
    supplied.case.detentionLimitMinutes = 1;
    supplied.questions[0]!.label = "改ざん質問";

    store.startInterrogation();
    store.askQuestion("Q-ALIBI-01");
    expect(store.getState().detentionRemainingMinutes).toBe(2850);
    expect(store.getState().testimonyLog[0]!.text).not.toContain("改ざん");
  });
});
