import { useRef } from "react";
import { Tabs, usePaneHeaderTabs, type PaneHeaderTabsRegistration } from "gloomberb/components";
import { truncateWithEllipsis } from "gloomberb/utils";
import type { AiScreenerTab, ScreenerEditorState } from "./model";

/**
 * The screener tab strip. On the desktop the pane chrome draws it in the title
 * bar; the terminal keeps it in the body, so `tabsInHeader` tells the pane
 * whether to render `AiScreenerTabsBar` and reserve its row.
 */
export function useAiScreenerTabs({
  activeTab,
  addTab,
  editTab,
  editorState,
  focused,
  removeTab,
  setActiveTabId,
  setCursorSymbol,
  tabs,
}: {
  activeTab: AiScreenerTab | null;
  addTab: () => void;
  editTab: (tab: AiScreenerTab | null) => void;
  editorState: ScreenerEditorState | null;
  focused: boolean;
  removeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string | null) => void;
  setCursorSymbol: (symbol: string | null) => void;
  tabs: AiScreenerTab[];
}): { registration: PaneHeaderTabsRegistration; tabsInHeader: boolean } {
  const lastTabClickRef = useRef<{ tabId: string; at: number } | null>(null);
  const displayTabs = editorState?.mode === "create"
    ? [...tabs.map((tab) => ({ id: tab.id, title: tab.title })), { id: "__draft__", title: "New Screener" }]
    : tabs.map((tab) => ({ id: tab.id, title: tab.title }));

  const registration: PaneHeaderTabsRegistration = {
    tabs: displayTabs.map((tab) => {
      const isDraft = tab.id === "__draft__";
      return {
        label: truncateWithEllipsis(tab.title, isDraft ? 20 : 18),
        value: tab.id,
        onClose: !editorState && !isDraft ? removeTab : undefined,
      };
    }),
    activeValue: editorState?.mode === "create" ? "__draft__" : activeTab?.id ?? null,
    onSelect: (tabId) => {
      if (editorState || tabId === "__draft__") return;
      const tab = tabs.find((entry) => entry.id === tabId);
      if (!tab) return;
      setActiveTabId(tab.id);
      setCursorSymbol(null);
      const now = Date.now();
      const last = lastTabClickRef.current;
      if (last?.tabId === tab.id && now - last.at <= 350) {
        lastTabClickRef.current = null;
        editTab(tab);
        return;
      }
      lastTabClickRef.current = { tabId: tab.id, at: now };
    },
    closeMode: "active",
    onAdd: editorState ? undefined : addTab,
    focused: focused && !editorState,
  };

  const tabsInHeader = usePaneHeaderTabs(registration);
  return { registration, tabsInHeader };
}

export function AiScreenerTabsBar({ registration }: { registration: PaneHeaderTabsRegistration }) {
  return <Tabs {...registration} compact variant="pill" />;
}
