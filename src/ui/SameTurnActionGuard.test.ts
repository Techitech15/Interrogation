import { describe, expect, it } from "vitest";
import type {
  TestimonyRequest,
  TestimonyResponse,
} from "../ai/AIProvider";
import { ScriptedProvider } from "../ai/ScriptedProvider";
import { createGameStore } from "../core/store";
import { loadCase001 } from "../data/loadCase";
import { SameTurnActionGuard } from "./SameTurnActionGuard";

class CountingProvider extends ScriptedProvider {
  calls = 0;

  override generateTestimony(request: TestimonyRequest): TestimonyResponse {
    this.calls += 1;
    return super.generateTestimony(request);
  }
}

describe("SameTurnActionGuard", () => {
  it("同一event-loopの二重質問を1供述・30分・Provider1回に抑える", async () => {
    const bundle = loadCase001();
    const provider = new CountingProvider(bundle);
    const store = createGameStore(bundle, provider);
    let now = 1_000;
    const guard = new SameTurnActionGuard(250, () => now);
    store.startInterrogation();

    const first = guard.run(
      "question:Q-ALIBI-01",
      () => {
        store.askQuestion("Q-ALIBI-01");
      },
    );
    const second = guard.run(
      "question:Q-ALIBI-01",
      () => {
        store.askQuestion("Q-ALIBI-01");
      },
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(store.getState().testimonyLog).toHaveLength(1);
    expect(store.getState().detentionRemainingMinutes).toBe(2850);
    expect(provider.calls).toBe(1);
    await Promise.resolve();
    expect(
      guard.run("question:Q-ALIBI-01", () =>
        store.askQuestion("Q-ALIBI-01"),
      ),
    ).toBe(false);
    expect(
      guard.run("question:Q-SINK-01", () =>
        store.askQuestion("Q-SINK-01"),
      ),
    ).toBe(true);
    expect(provider.calls).toBe(2);

    now += 250;
    expect(
      guard.run("question:Q-ALIBI-01", () =>
        store.askQuestion("Q-ALIBI-01"),
      ),
    ).toBe(true);
    expect(provider.calls).toBe(3);
  });
});
