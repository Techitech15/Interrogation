import { describe, expect, it } from "vitest";
import { loadCase001 } from "../data/loadCase";
import { evaluateContradiction } from "./contradictionJudge";
import type { EmotionState, Testimony } from "./types";

describe("evaluateContradiction", () => {
  const bundle = loadCase001();
  const emotions: EmotionState[] = ["calm", "shaken", "hardened"];
  const fixedCorrectExpectations: Record<
    string,
    Partial<Record<string, readonly EmotionState[]>>
  > = {
    "LIE-01": {
      "EV-01": ["calm", "shaken"],
    },
    "LIE-02": {
      "EV-02": ["calm", "shaken", "hardened"],
    },
  };

  it("固定期待表で全lieId×全証拠×全感情の正誤を判定する", () => {
    for (const lieId of ["LIE-01", "LIE-02"]) {
      const testimony: Testimony = {
        testimonyId: "matrix:" + lieId,
        turn: 1,
        questionId: "matrix",
        text: "固定テスト供述",
        lieId,
        emotionAtTime: "calm",
        contradictionResolved: false,
      };
      for (const evidence of bundle.evidence) {
        for (const emotion of emotions) {
          const correctEmotions =
            fixedCorrectExpectations[lieId]?.[evidence.evidenceId] ?? [];
          const expected = correctEmotions.includes(emotion)
            ? "correct"
            : "incorrect";
          expect(
            evaluateContradiction(
              testimony,
              evidence,
              bundle.suspect,
              emotion,
            ).kind,
            lieId + " × " + evidence.evidenceId + " × " + emotion,
          ).toBe(expected);
        }
      }
    }
  });

  it("制約のないlieはhardenedでも正しい証拠で成功する", () => {
    const testimony: Testimony = {
      testimonyId: "hard",
      turn: 1,
      questionId: "Q-SINK-01",
      text: "供述",
      lieId: "LIE-02",
      emotionAtTime: "hardened",
      contradictionResolved: false,
    };
    expect(
      evaluateContradiction(
        testimony,
        bundle.evidence[1]!,
        bundle.suspect,
        "hardened",
      ).kind,
    ).toBe("correct");
  });

  it("解消済み供述を明示的に拒否する", () => {
    const testimony: Testimony = {
      testimonyId: "resolved",
      turn: 1,
      questionId: "Q-ALIBI-01",
      text: "供述",
      lieId: "LIE-01",
      emotionAtTime: "calm",
      contradictionResolved: true,
    };
    expect(
      evaluateContradiction(
        testimony,
        bundle.evidence[0]!,
        bundle.suspect,
        "calm",
      ).kind,
    ).toBe("already_resolved");
  });
});
