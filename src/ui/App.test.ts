import { describe, expect, it } from "vitest";
import { ScriptedProvider } from "../ai/ScriptedProvider";
import { createGameStore } from "../core/store";
import { loadCase001 } from "../data/loadCase";
import { escapeHtml, renderTestimonyLog } from "./App";

describe("UI output safety", () => {
  it("HTML特殊文字をescapeする", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">&')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;",
    );
  });

  it("未解消供述のlieId有無を外観や文言へ漏らさない", () => {
    const bundle = loadCase001();
    const store = createGameStore(bundle, new ScriptedProvider(bundle));
    store.startInterrogation();
    store.askQuestion("Q-ALIBI-01");
    store.askQuestion("Q-MOTIVE-01");
    const html = renderTestimonyLog(bundle, store.getState());

    expect(html.match(/記録済み/g)).toHaveLength(2);
    expect(html.match(/この供述を追及/g)).toHaveLength(2);
    expect(html).not.toContain("未解消");
    expect(html).not.toContain("通常供述");
    expect(html).not.toContain("LIE-");
  });
});
