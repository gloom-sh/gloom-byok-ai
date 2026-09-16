import type { GloomPluginContext } from "gloomberb/types/plugin";
import { getCurrentPluginTarget } from "gloomberb/utils";
import type { AiRunHost } from "../runner";
import { ensureAiRunHost, installAiRunHost, setAiRunHostLoader } from "../runner";
import { registerAiRunnerCapability } from "./capability";

const AI_STARTUP_READINESS_TIMEOUT_MS = 5_000;

/**
 * How long the runtime waits before loading itself when nothing has asked for
 * it. Long enough for the first layout to be on screen, so the module
 * evaluation the Pi runtime costs does not land in the middle of startup.
 */
const DEFERRED_INSTALL_DELAY_MS = 1_500;

/**
 * The app this host talks to when the agent drives the UI over remote control.
 *
 * The terminal declares its target; the Bun process behind the desktop view
 * never does, so anything else here is the desktop's backend (or the CLI,
 * which does not install a host at all).
 */
function remoteAppKind(): "tui" | "desktop" {
  return getCurrentPluginTarget() === "tui" ? "tui" : "desktop";
}

let piHost: Promise<AiRunHost> | null = null;

/**
 * The Pi runtime, loaded once and off the startup path.
 *
 * `import()` rather than a top-level import on purpose: Pi pulls in every
 * provider SDK it supports, and evaluating that during `setup()` would put it
 * in front of the app's first frame.
 */
export function loadPiAiHost(dataDir: string): Promise<AiRunHost> {
  piHost ??= import("../pi/host").then(({ createPiAiHost }) => createPiAiHost({
    appKind: remoteAppKind(),
    dataDir,
  }));
  return piHost;
}

/**
 * Wires the halves that run in Bun: the terminal, where the panes render in
 * this process, and the desktop's backend, where they render in the view and
 * reach this process over the `ai.runner` capability.
 */
export function setupNativeAiRunHost(ctx: GloomPluginContext): void {
  registerAiRunnerCapability(ctx);
  if (getCurrentPluginTarget() !== "tui") return;

  const dataDir = ctx.getConfig().dataDir;
  setAiRunHostLoader(async () => {
    try {
      return await installAiRunHost(await loadPiAiHost(dataDir), {
        catalogTimeoutMs: AI_STARTUP_READINESS_TIMEOUT_MS,
        timeoutMessage: "In-app AI provider discovery timed out during startup",
        onCatalogError(error) {
          ctx.log.warn("In-app AI provider discovery could not finish during startup", {
            error: error instanceof Error ? error.message : String(error),
          });
        },
      });
    } catch (error) {
      ctx.log.warn("In-app AI providers could not be initialized", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  });

  // Nothing on screen has to ask first: provider discovery talks to the
  // network and a pane opened cold should find the catalog already there.
  const timer = setTimeout(() => {
    void ensureAiRunHost();
  }, DEFERRED_INSTALL_DELAY_MS);
  timer.unref?.();
}
