import { describe, expect, it } from "vitest";
import { loadCase001 } from "../data/loadCase";
import {
  CaseDataValidationError,
  validateCaseBundle,
} from "./caseDataValidator";
import type { CaseBundle, QuestionDefinition } from "./types";

function mutableBundle(): CaseBundle {
  return structuredClone(loadCase001()) as CaseBundle;
}

describe("validateCaseBundle", () => {
  it("正しい事件データを受理する", () => {
    const bundle = loadCase001();
    expect(validateCaseBundle(structuredClone(bundle)).case.caseId).toBe(
      "case-001",
    );
  });

  it("loadごとに独立したdeep frozen bundleを返す", () => {
    const first = loadCase001();
    const second = loadCase001();
    expect(first).not.toBe(second);
    expect(first.questions).not.toBe(second.questions);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.questions)).toBe(true);
    expect(Object.isFrozen(first.questions[0]!.responseTable)).toBe(true);
    if (false) {
      // @ts-expect-error DeepReadonly prevents array mutation.
      first.questions.pop();
      // @ts-expect-error DeepReadonly prevents nested assignment.
      first.case.title = "改ざん";
    }
    expect(() =>
      (first.questions as QuestionDefinition[]).pop(),
    ).toThrow(TypeError);
    expect(second.questions).toHaveLength(3);
  });

  it("JSON Schema違反を拒否する", () => {
    const invalid = mutableBundle() as unknown as {
      case: { detentionLimitMinutes: unknown };
    };
    invalid.case.detentionLimitMinutes = "48時間";
    expect(() => validateCaseBundle(invalid)).toThrow(CaseDataValidationError);
  });

  it("不正なlie参照を拒否する", () => {
    const invalid = mutableBundle();
    invalid.questions[0]!.responseTable[0]!.lieId = "LIE-NOT-FOUND";
    expect(() => validateCaseBundle(invalid)).toThrow(/存在しない嘘/);
  });

  it("不正な証拠参照を拒否する", () => {
    const invalid = mutableBundle();
    invalid.suspect.lieTable[0]!.contradictingEvidenceIds = [
      "EV-NOT-FOUND",
    ];
    expect(() => validateCaseBundle(invalid)).toThrow(/存在しない証拠/);
  });

  it("不正な応答参照とID重複を拒否する", () => {
    const badResponse = mutableBundle();
    badResponse.questions[0]!.responseTable[0]!.responseTextId =
      "RESP-NOT-FOUND";
    expect(() => validateCaseBundle(badResponse)).toThrow(/存在しない応答/);

    const duplicate = mutableBundle();
    duplicate.evidence[1]!.evidenceId = duplicate.evidence[0]!.evidenceId;
    expect(() => validateCaseBundle(duplicate)).toThrow(/重複/);
  });

  it("各lieを提示する到達可能なresponse ruleを必須にする", () => {
    const invalid = mutableBundle();
    for (const question of invalid.questions) {
      for (const response of question.responseTable) {
        if (response.lieId === "LIE-01") {
          delete response.lieId;
        }
      }
    }
    expect(() => validateCaseBundle(invalid)).toThrow(/到達可能/);
  });

  it("各lieにbriefing開示可能な矛盾証拠を必須にする", () => {
    const invalid = mutableBundle();
    invalid.evidence[0]!.unlockedFrom = "interrogation";
    expect(() => validateCaseBundle(invalid)).toThrow(/briefing/);
  });

  it("先行catch-allによる後続ruleのshadowを拒否する", () => {
    const invalid = mutableBundle();
    const motive = invalid.questions.find(
      (question) => question.questionId === "Q-MOTIVE-01",
    );
    expect(motive).toBeDefined();
    if (motive === undefined) {
      return;
    }
    const specific = motive.responseTable[0]!;
    const catchAll = {
      ...specific,
      requiredEvidenceIds: [],
      responseTextId: "RESP-MOTIVE-CALM",
    };
    motive.responseTable = [
      catchAll,
      specific,
      ...motive.responseTable.slice(1),
    ];
    expect(() => validateCaseBundle(invalid)).toThrow(/shadow/);
  });

  it("P1固定証拠集合で永遠に条件不成立のruleを拒否する", () => {
    const invalid = mutableBundle();
    invalid.evidence[2]!.unlockedFrom = "interrogation";
    expect(() => validateCaseBundle(invalid)).toThrow(/永遠に条件不成立/);
  });

  it("P1の3 ending 宣言を必須にする", () => {
    const invalid = mutableBundle() as unknown as {
      case: { endings: string[] };
    };
    invalid.case.endings = ["true_confession", "released"];
    expect(() => validateCaseBundle(invalid)).toThrow(CaseDataValidationError);
  });

  it("30分の期限では3 ending実到達不能として拒否する", () => {
    const invalid = mutableBundle();
    invalid.case.detentionLimitMinutes = 30;
    expect(() => validateCaseBundle(invalid)).toThrow(/true_confession/);
  });

  it("誤追及経路のない事件をwrongful_conviction到達不能として拒否する", () => {
    const invalid = mutableBundle();
    invalid.suspect.lieTable = [
      {
        ...invalid.suspect.lieTable[0]!,
        requiredEmotionNotIn: [],
      },
    ];
    invalid.evidence = [invalid.evidence[0]!];
    invalid.questions = [
      {
        ...invalid.questions[0]!,
        responseTable: invalid.questions[0]!.responseTable.map((response) => ({
          ...response,
          requiredEvidenceIds: [],
          lieId: "LIE-01",
        })),
      },
    ];
    expect(() => validateCaseBundle(invalid)).toThrow(/wrongful_conviction/);
  });
});
