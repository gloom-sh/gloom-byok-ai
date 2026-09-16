import { createByokAiPlugin } from "./plugin";
import { setupBridgeAiRunHost } from "./host/bridge";

/**
 * The renderer entry, for the desktop view.
 *
 * Same panes, no runtime: the view is a browser context, which cannot hold a
 * credential store or a provider SDK, so prompts are forwarded to the Bun
 * process over the `ai.runner` capability. Nothing in this graph imports
 * `./pi`, which is what keeps the view compiling.
 */
export const byokAiPlugin = createByokAiPlugin({ setupRunHost: setupBridgeAiRunHost });

export default byokAiPlugin;
