import { usePaneFooter } from "gloomberb/components";
import { t } from "gloomberb/i18n";
import { useAppLanguage } from "gloomberb/i18n";
import type { AiScreenerTab, RunState, ScreenerEditorState } from "./model";

interface UseAiScreenerFooterOptions {
  activeTab: AiScreenerTab | null;
  editorState: ScreenerEditorState | null;
  isRunningActiveTab: boolean;
  promptDirty: boolean;
  runState: RunState | null;
  onAddTab: () => void;
  onCancelRun: () => void;
  onEdit: () => void;
  onFocusModel: () => void;
  onSaveEditor: () => void;
}

export function useAiScreenerFooter({
  activeTab,
  editorState,
  isRunningActiveTab,
  promptDirty,
  runState,
  onAddTab,
  onCancelRun,
  onEdit,
  onFocusModel,
  onSaveEditor,
}: UseAiScreenerFooterOptions) {
  const language = useAppLanguage();
  usePaneFooter("ai-screener", () => ({
    info: isRunningActiveTab && runState
      ? [{
          id: "running",
          parts: [{
            text: t("Refreshing…"),
            tone: "muted" as const,
          }],
        }]
      : [
          ...(activeTab?.lastError
            ? [{
                id: "error",
                parts: [{ text: activeTab.lastError, tone: "warning" as const }],
              }]
            : []),
          // Lookup warnings are the notice footer's.
          ...(activeTab && promptDirty && activeTab.results.length > 0
            ? [{
                id: "stale",
                parts: [{ text: t("Prompt or provider changed since this run"), tone: "warning" as const }],
              }]
            : []),
        ],
    // The editor draws Save and Cancel; Esc cancels.
    hints: editorState
      ? [
          {
            id: "save",
            key: "Ctrl+S",
            label: t("save"),
            onPress: onSaveEditor,
          },
          {
            id: "model",
            key: "Ctrl+O",
            label: t("model"),
            onPress: onFocusModel,
          },
        ]
      : isRunningActiveTab
        ? [
            {
              id: "stop",
              key: "Esc",
              label: t("stop"),
              onPress: onCancelRun,
            },
          ]
        : [
            {
              id: "new",
              key: "t",
              label: t("new"),
              onPress: onAddTab,
            },
            {
              id: "edit",
              key: "e",
              label: t("dit"),
              onPress: onEdit,
              disabled: !activeTab,
            },
          ],
  }), [
    activeTab,
    editorState,
    isRunningActiveTab,
    language,
    onAddTab,
    onCancelRun,
    onEdit,
    onFocusModel,
    onSaveEditor,
    promptDirty,
    runState,
  ]);
}
