import "./styles.css";
import { ScriptedProvider } from "./ai/ScriptedProvider";
import { createGameStore } from "./core/store";
import { loadCase001 } from "./data/loadCase";
import { App, renderFatalError } from "./ui/App";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("#app が見つかりません");
}

try {
  const bundle = loadCase001();
  const provider = new ScriptedProvider(bundle);
  const store = createGameStore(bundle, provider);
  const app = new App(root, bundle, store);
  app.render();
} catch (error) {
  renderFatalError(root, error);
}
