import { describe, expect, it } from "vitest";
import { loadCase001 } from "../data/loadCase";
import { ScriptedProvider } from "./ScriptedProvider";

describe("ScriptedProvider", () => {
  it("Layer Aのwarmup後p99応答が100ms未満で完結する", () => {
    const bundle = loadCase001();
    const provider = new ScriptedProvider(bundle);
    const request = {
      canonicalQuestionId: "Q-ALIBI-01",
      caseSummaryForAI: "テスト",
      knownFactsForSuspect: [],
      emotionState: "calm" as const,
      disclosedEvidenceSummaries: [],
      disclosedEvidenceIds: ["EV-01", "EV-02", "EV-03"],
      playerUtterance: "どこにいましたか",
    };
    for (let index = 0; index < 200; index += 1) {
      provider.generateTestimony(request);
    }

    const iterations = 2_000;
    const durations: number[] = [];
    for (let index = 0; index < iterations; index += 1) {
      const startedAt = performance.now();
      provider.generateTestimony(request);
      durations.push(performance.now() - startedAt);
    }
    durations.sort((left, right) => left - right);
    const p99Index = Math.ceil(durations.length * 0.99) - 1;
    expect(durations[p99Index]).toBeDefined();
    expect(durations[p99Index]!).toBeLessThan(100);
  });
});
