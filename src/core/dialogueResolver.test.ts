import { describe, expect, it } from "vitest";
import { loadCase001 } from "../data/loadCase";
import { resolveDialogue } from "./dialogueResolver";
import type { CaseBundle } from "./types";

describe("resolveDialogue", () => {
  const bundle = loadCase001();

  it("必要証拠が揃った場合だけ事件固有応答を選ぶ", () => {
    const withoutEvidence = resolveDialogue(
      bundle,
      "Q-MOTIVE-01",
      "calm",
      [],
    );
    const withEvidence = resolveDialogue(
      bundle,
      "Q-MOTIVE-01",
      "calm",
      ["EV-03"],
    );

    expect(withoutEvidence.responseTextId).toBe("RESP-REFUSE-DEFAULT");
    expect(withEvidence.responseTextId).toBe("RESP-MOTIVE-DISCLOSED");
  });

  it("一致行がなければ既定拒否応答へ戻る", () => {
    const mutableBundle = structuredClone(bundle) as CaseBundle;
    const question = mutableBundle.questions.find(
      (item) => item.questionId === "Q-MOTIVE-01",
    );
    expect(question).toBeDefined();
    if (question === undefined) {
      return;
    }
    const original = question.responseTable;
    question.responseTable = original.filter((rule) => rule.emotion !== "calm");
    expect(
      resolveDialogue(mutableBundle, "Q-MOTIVE-01", "calm", []).responseTextId,
    ).toBe("RESP-REFUSE-DEFAULT");
    question.responseTable = original;
  });
});
