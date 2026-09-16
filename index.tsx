import { createByokAiPlugin } from "./plugin";
import { aiCliCommand } from "./cli";
import { setupNativeAiRunHost } from "./host/native";

/**
 * The Bun entry: the terminal, and the process behind the desktop view.
 *
 * Nothing here reaches the Pi runtime. `setup()` runs while the app is
 * starting, and Pi's provider SDKs are hundreds of modules, so the host that
 * needs them is loaded from `host/native.ts` once the app is up, and the `ai`
 * command loads them only when it runs.
 */
export const byokAiPlugin = createByokAiPlugin({
  setupRunHost: setupNativeAiRunHost,
  cliCommands: [aiCliCommand],
});

export default byokAiPlugin;
