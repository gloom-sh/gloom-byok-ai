import { useEffect, useMemo, useSyncExternalStore } from "react";
import { aiProviderFromRuntime, detectProviders, type AiProvider } from "./providers";
import {
  type AiRuntimeCatalog,
  ensureAiRunHost,
  getAiRuntimeCatalogSnapshot,
  subscribeAiRuntimeCatalog,
} from "./runner";

export function useAiRuntimeCatalog(): AiRuntimeCatalog {
  // A pane on screen is the earliest point where the runtime is actually
  // needed, so it is also the deadline for loading it: the deferred install
  // from startup may not have run yet.
  useEffect(() => {
    void ensureAiRunHost();
  }, []);

  return useSyncExternalStore(
    subscribeAiRuntimeCatalog,
    getAiRuntimeCatalogSnapshot,
    getAiRuntimeCatalogSnapshot,
  );
}

export function useAiRuntimeProviders(): AiProvider[] {
  const catalog = useAiRuntimeCatalog();

  return useMemo(
    () => (
      catalog.providers.length > 0
        ? catalog.providers.map(aiProviderFromRuntime)
        : detectProviders()
    ),
    [catalog],
  );
}
