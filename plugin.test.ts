import { afterEach, describe, expect, test } from "bun:test";
import { createDefaultConfig } from "gloomberb/types/config";
import type { PaneDef, PaneTemplateDef } from "gloomberb/types/plugin";
import { createByokAiPlugin } from "./plugin";
import {
  AI_PROVIDER_IDS,
  getAiProviderDefinition,
  setDetectedProviders,
  type AiProviderId,
} from "./providers";
import {
  getAiRuntimeCatalog,
  setAiRunHost,
  setAiRuntimeCatalog,
  type AiRuntimeCatalog,
} from "./runner";

function catalog(readyProviderIds: readonly AiProviderId[]): AiRuntimeCatalog {
  const ready = new Set(readyProviderIds);
  return {
    providers: AI_PROVIDER_IDS.map((providerId) => {
      const definition = getAiProviderDefinition(providerId)!;
      const connected = ready.has(providerId);
      return {
        providerId,
        label: definition.name,
        status: connected ? "ready" : "not_authenticated",
        ...(!connected ? { unavailableReason: "Not connected." } : {}),
        outputModes: ["plain", "structured", "screener"],
        defaultModelId: definition.preferredModelIds[0],
      };
    }),
    accounts: AI_PROVIDER_IDS.map((providerId) => {
      const definition = getAiProviderDefinition(providerId)!;
      const connected = ready.has(providerId);
      const supportsOAuth = [
        "anthropic",
        "openai-codex",
        "github-copilot",
        "xai",
      ].includes(providerId);
      return {
        providerId,
        providerLabel: definition.name,
        connectionState: connected ? "connected" : "not_connected",
        connectionLabel: connected ? "Connected" : "Not connected.",
        ...(connected ? {
          credentialSource: "OAuth",
          credentialOrigin: "stored" as const,
        } : {}),
        authMethods: supportsOAuth
          ? [{ type: "oauth" as const, label: "Sign in", canLogin: true }]
          : [{ type: "api_key" as const, label: "API key", canLogin: false }],
        canLogin: supportsOAuth,
        canDisconnect: connected,
        ...(supportsOAuth ? { loginType: "oauth" as const } : {}),
      };
    }),
    models: AI_PROVIDER_IDS.map((providerId) => {
      const definition = getAiProviderDefinition(providerId)!;
      return {
        id: definition.preferredModelIds[0]!,
        providerId,
        label: definition.preferredModelIds[0]!,
        available: ready.has(providerId),
      };
    }),
  };
}

function setupPlugin(config = createDefaultConfig("/tmp/gloomberb-ai-plugin")) {
  const hostSetups: number[] = [];
  const aiPlugin = createByokAiPlugin({ setupRunHost: () => hostSetups.push(1) });
  const panes: PaneDef[] = [];
  const templates: PaneTemplateDef[] = [];
  const setCalls: Array<[string, unknown]> = [];
  const listeners: {
    configChanged?: (payload: { config: typeof config }) => void;
  } = {};

  aiPlugin.setup?.({
    getConfig: () => config,
    configState: {
      get: (key: string) => config.pluginConfig.ai?.[key] ?? null,
      set: async (key: string, value: unknown) => {
        config.pluginConfig.ai = { ...(config.pluginConfig.ai ?? {}), [key]: value };
        setCalls.push([key, value]);
      },
      delete: async () => {},
      keys: () => Object.keys(config.pluginConfig.ai ?? {}),
    },
    resume: {
      getState: () => null,
      setState() {},
      deleteState() {},
      getPaneState: () => null,
      setPaneState() {},
      deletePaneState() {},
    },
    registerPane: (pane: PaneDef) => panes.push(pane),
    registerPaneTemplate: (template: PaneTemplateDef) => templates.push(template),
    registerTickerResearchTab() {},
    on: (event: string, listener: (payload: { config: typeof config }) => void) => {
      if (event === "config:changed") listeners.configChanged = listener;
      return () => {};
    },
    log: { warn() {} },
  } as any);

  return { config, hostSetups, listeners, panes, setCalls, templates };
}

afterEach(() => {
  setDetectedProviders(null);
  setAiRunHost(null);
  setAiRuntimeCatalog({ providers: [], accounts: [], models: [] });
});

describe("AI plugin shared provider settings", () => {
  test("disconnects a Pi-owned account without offering a CLI fallback", async () => {
    setAiRuntimeCatalog(catalog(["anthropic"]));
    const disconnectedCatalog = catalog([]);
    const disconnectCalls: string[] = [];
    setAiRunHost({
      run: () => ({ done: Promise.resolve("unused"), cancel() {} }),
      disconnect: async (providerId) => {
        disconnectCalls.push(providerId);
        return disconnectedCatalog;
      },
    });
    const { config, panes } = setupPlugin();
    const workspacePane = panes.find((pane) => pane.id === "local-agent-workspace");
    const settingsContext = {
      config,
      layout: config.layout,
      paneId: "agent-pane",
      paneType: "local-agent-workspace",
      pane: { instanceId: "agent-pane", paneId: "local-agent-workspace", title: "AI Agent" },
      settings: {},
      paneState: {},
      activeTicker: null,
      activeCollectionId: null,
    };
    const getWorkspaceSettings = () => (
      typeof workspacePane?.settings === "function"
        ? workspacePane.settings(settingsContext)
        : null
    );
    const disconnectField = getWorkspaceSettings()?.fields.find(
      (field) => field.key === "account:anthropic",
    );
    if (disconnectField?.type !== "action") throw new Error("Expected Claude account action");
    expect(disconnectField.actionLabel).toBe("Disconnect");

    const notifications: Array<{ body: string; type?: string }> = [];
    await disconnectField.action({
      ...settingsContext,
      surface: "pane-dialog",
      close() {},
      openCommandBar() {},
      notify: (notification: { body: string; type?: string }) => {
        notifications.push(notification);
      },
    } as any);

    expect(disconnectCalls).toEqual(["anthropic"]);
    expect(getAiRuntimeCatalog()).toEqual(disconnectedCatalog);
    expect(notifications.at(-1)).toMatchObject({
      body: "Claude is disconnected from Gloomberb.",
      type: "success",
    });
    expect(notifications.at(-1)?.body).not.toContain("fallback");
    expect(getWorkspaceSettings()?.fields.find(
      (field) => field.key === "account:anthropic",
    )).toMatchObject({ type: "action", actionLabel: "Connect" });
  });

  test("on a host that cannot say it on the row, device codes from the sign-in stream are toasts", async () => {
    const disconnectedCatalog = catalog([]);
    const connectedCatalog = catalog(["github-copilot"]);
    setAiRuntimeCatalog(disconnectedCatalog);
    setAiRunHost({
      run: () => ({ done: Promise.resolve("unused"), cancel() {} }),
      connect: async (_providerId, _authType, onAuthEvent) => {
        onAuthEvent?.({
          type: "device_code",
          userCode: "ABCD-EFGH",
          verificationUri: "https://github.com/login/device",
        });
        return connectedCatalog;
      },
    });
    const { config, panes } = setupPlugin();
    const workspacePane = panes.find((pane) => pane.id === "local-agent-workspace");
    const settingsContext = {
      config,
      layout: config.layout,
      paneId: "agent-pane",
      paneType: "local-agent-workspace",
      pane: { instanceId: "agent-pane", paneId: "local-agent-workspace", title: "AI Agent" },
      settings: {},
      paneState: {},
      activeTicker: null,
      activeCollectionId: null,
    };
    const settings = typeof workspacePane?.settings === "function"
      ? workspacePane.settings(settingsContext)
      : null;
    const connectField = settings?.fields.find(
      (field) => field.key === "account:github-copilot",
    );
    if (connectField?.type !== "action") throw new Error("Expected Copilot account action");

    const notifications: Array<{
      title?: string;
      body: string;
      type?: string;
      persistent?: boolean;
    }> = [];
    await connectField.action({
      ...settingsContext,
      surface: "pane-dialog",
      close() {},
      openCommandBar() {},
      notify(notification: {
        title?: string;
        body: string;
        type?: string;
        persistent?: boolean;
      }) {
        notifications.push(notification);
      },
    } as any);

    expect(notifications).toContainEqual(expect.objectContaining({
      title: "GitHub Copilot device sign-in",
      body: "Enter code ABCD-EFGH at https://github.com/login/device. The sign-in page has been opened in your browser.",
      type: "info",
      persistent: true,
    }));
    expect(notifications.at(-1)).toMatchObject({
      body: "GitHub Copilot is connected.",
      type: "success",
    });
  });

  test("a host that can say it on the account's row gets the sign-in, its device code and its failure there, not in toasts", async () => {
    setAiRuntimeCatalog(catalog([]));
    let finish: (error?: Error) => void = () => {};
    setAiRunHost({
      run: () => ({ done: Promise.resolve("unused"), cancel() {} }),
      connect: (_providerId, _authType, onAuthEvent) => new Promise((resolve, reject) => {
        onAuthEvent?.({ type: "device_code", userCode: "ABCD-EFGH", verificationUri: "https://github.com/login/device" });
        finish = (error) => (error ? reject(error) : resolve(catalog(["github-copilot"])));
      }),
    });
    const { config, panes } = setupPlugin();
    const workspacePane = panes.find((pane) => pane.id === "local-agent-workspace");
    const settingsContext = {
      config,
      layout: config.layout,
      paneId: "agent-pane",
      paneType: "local-agent-workspace",
      pane: { instanceId: "agent-pane", paneId: "local-agent-workspace", title: "AI Agent" },
      settings: {},
      paneState: {},
      activeTicker: null,
      activeCollectionId: null,
    };
    const copilotRow = () => {
      const settings = typeof workspacePane?.settings === "function" ? workspacePane.settings(settingsContext) : null;
      const field = settings?.fields.find((entry) => entry.key === "account:github-copilot");
      if (field?.type !== "action") throw new Error("Expected Copilot account action");
      return field;
    };

    const notes: unknown[] = [];
    const toasts: unknown[] = [];
    let closed = 0;
    let rowShown = true;
    const running = copilotRow().action({
      ...settingsContext,
      surface: "pane-dialog",
      close() { closed += 1; },
      openCommandBar() {},
      notify(notification: unknown) { toasts.push(notification); },
      setRowNote(note: unknown) {
        if (!rowShown) return false;
        notes.push(note);
        return true;
      },
    } as any);
    await Promise.resolve();

    // The dialog stays open on the row, which says it waits and carries the code, even reopened.
    expect(closed).toBe(0);
    expect(notes.at(-1)).toEqual({ status: "Waiting for sign-in", tone: "warning" });
    expect(copilotRow().description).toBe("Enter code ABCD-EFGH at https://github.com/login/device. The sign-in page has been opened in your browser.");

    finish(new Error("The device code expired."));
    await running;
    expect(notes.at(-1)).toEqual({ status: "Sign-in failed", text: "The device code expired.", tone: "negative" });
    expect(copilotRow().description).toBe("Not connected.");
    expect(toasts).toEqual([]);

    // Once the dialog has closed the row is gone, and what the sign-in came to is a toast.
    const again = copilotRow().action({
      ...settingsContext,
      surface: "pane-dialog",
      close() {},
      openCommandBar() {},
      notify(notification: unknown) { toasts.push(notification); },
      setRowNote(note: unknown) {
        if (!rowShown) return false;
        notes.push(note);
        return true;
      },
    } as any);
    await Promise.resolve();
    rowShown = false;
    finish();
    await again;
    expect(toasts.at(-1)).toMatchObject({ body: "GitHub Copilot is connected.", type: "success" });
  });

  test("opens the Agent pane directly while keeping every adapter in shared settings", async () => {
    setAiRuntimeCatalog(catalog(["anthropic"]));
    const config = createDefaultConfig("/tmp/gloomberb-ai-plugin-settings");
    config.pluginConfig.ai = {
      defaultProviderId: "claude",
      defaultModelId: "claude-custom",
    };
    const { panes, templates } = setupPlugin(config);

    const workspaceTemplate = templates.find(
      (template) => template.id === "new-local-agent-workspace",
    );
    const screenerTemplate = templates.find(
      (template) => template.id === "new-ai-screener-pane",
    );
    expect(workspaceTemplate?.wizard).toBeUndefined();
    const workspaceInstance = workspaceTemplate?.createInstance?.({} as any, {});
    expect(workspaceInstance).toMatchObject({
      title: "AI Agent",
      placement: "floating",
      params: { newThreadId: expect.any(String) },
    });
    expect((workspaceInstance as any)?.params?.newThreadId).not.toBe("");
    expect(workspaceTemplate?.keywords).toContain("ai");
    expect(workspaceTemplate?.keywords).not.toContain("opencode");

    const workspacePane = panes.find((pane) => pane.id === "local-agent-workspace");
    const settings = typeof workspacePane?.settings === "function"
      ? workspacePane.settings({
          config,
          layout: config.layout,
          paneId: "agent-pane",
          paneType: "local-agent-workspace",
          pane: { instanceId: "agent-pane", paneId: "local-agent-workspace", title: "AI Agent" },
          settings: {},
          paneState: {},
          activeTicker: null,
          activeCollectionId: null,
        })
      : null;
    const defaultProviderField = settings?.fields.find(
      (field) => field.key === "defaultProviderId",
    );
    if (defaultProviderField?.type !== "select") {
      throw new Error("Expected shared default provider selector");
    }
    expect(defaultProviderField.options.map((option) => option.value)).toEqual([...AI_PROVIDER_IDS]);

    config.pluginConfig.ai = {
      defaultProviderId: "codex",
      defaultModelId: "gpt-custom",
    };
    setAiRuntimeCatalog(catalog(["openai-codex"]));

    expect(screenerTemplate?.wizard?.find((step) => step.key === "providerId")?.defaultValue)
      .toBe("openai-codex");
  });
});
