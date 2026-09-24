import { useMemo } from "react";
import { Box, Text } from "gloomberb/ui";
import { Button, PaneStatusBody, TickerListTableView, type DataTableKeyEvent } from "gloomberb/components";
import type { ColumnConfig } from "gloomberb/types/config";
import type { TickerFinancials } from "gloomberb/types/financials";
import type { TickerRecord } from "gloomberb/types/ticker";
import { colors } from "gloomberb/theme";
import { t } from "gloomberb/i18n";
import { getColumnValue, type ColumnContext } from "gloomberb/components";
import type { ValidatedScreenerResult } from "./contract";
import type { AiScreenerTab, ScreenerSortPreference } from "./model";
import { truncateWithEllipsis, wrapTextLines } from "gloomberb/utils";

export function AiScreenerResultsView({
  activeSort,
  activeTab,
  columnContext,
  columns,
  cursorSymbol,
  financialsMap,
  focused,
  isRunningActiveTab,
  noProvidersReady,
  resultMap,
  sortedTickers,
  width,
  onCreate,
  onHeaderClick,
  onOpenSettings,
  onRootKeyDown,
  onRowActivate,
  onRun,
  setCursorSymbol,
}: {
  activeSort: ScreenerSortPreference;
  activeTab: AiScreenerTab | null;
  columnContext: ColumnContext;
  columns: ColumnConfig[];
  cursorSymbol: string | null;
  financialsMap: Map<string, TickerFinancials>;
  focused: boolean;
  isRunningActiveTab: boolean;
  noProvidersReady: boolean;
  resultMap: Map<string, ValidatedScreenerResult>;
  sortedTickers: TickerRecord[];
  width: number;
  onCreate: () => void;
  onHeaderClick: (columnId: string) => void;
  onOpenSettings: () => void;
  onRootKeyDown: (event: DataTableKeyEvent) => boolean | void;
  onRowActivate: (ticker: TickerRecord) => void;
  onRun: () => void;
  setCursorSymbol: (symbol: string) => void;
}) {
  const detailTextWidth = Math.max(12, width - 2);
  const summaryLines = useMemo(() => (
    activeTab?.summary
      ? wrapTextLines(activeTab.summary, detailTextWidth, 2)
      : []
  ), [activeTab?.summary, detailTextWidth]);
  // Run errors, lookup warnings and a stale prompt are the footer's; the body
  // keeps the results and says what to do when there are none.
  const providerMessage = noProvidersReady
    ? t("No AI providers are ready. Connect an account in pane settings.")
    : undefined;
  const settingsAction = (variant: "primary" | "secondary") => (
    <Button label={t("Open AI settings")} variant={variant} compact onPress={onOpenSettings} />
  );

  if (!activeTab) {
    return (
      <PaneStatusBody
        empty
        emptyTitle={t("No AI screeners yet.")}
        emptyMessage={providerMessage}
        actions={(
          <>
            <Button label={t("New screener")} variant="primary" compact onPress={onCreate} />
            {noProvidersReady && settingsAction("secondary")}
          </>
        )}
      />
    );
  }

  return (
    <>
      {summaryLines.length > 0 && !activeTab.lastError && (
        <Box flexDirection="column" paddingX={1}>
          {summaryLines.map((line, index) => (
            <Box key={`summary:${index}`} height={1}>
              <Text fg={colors.textDim}>{line || " "}</Text>
            </Box>
          ))}
        </Box>
      )}
      <Box flexGrow={1} minHeight={0}>
        {isRunningActiveTab && activeTab.results.length === 0 ? (
          <PaneStatusBody loading loadingLabel={t("Running AI screener...")} />
        ) : activeTab.results.length === 0 ? (
          <PaneStatusBody
            empty
            emptyTitle={activeTab.lastSuccessAt ? t("No resolved matches in this run.") : t("No matches yet.")}
            emptyMessage={providerMessage}
            actions={noProvidersReady
              ? settingsAction("primary")
              : <Button label={t("Run")} variant="primary" compact onPress={onRun} />}
          />
        ) : (
          <TickerListTableView
            focused={focused}
            columns={columns}
            tickers={sortedTickers}
            cursorSymbol={cursorSymbol}
            setCursorSymbol={setCursorSymbol}
            resolveCell={(column, ticker, financials) => {
              if (column.id === "ticker") {
                return {
                  text: ticker.metadata.ticker,
                };
              }
              if (column.id === "reason") {
                return {
                  text: truncateWithEllipsis(resultMap.get(ticker.metadata.ticker)?.reason ?? "", column.width),
                };
              }
              return getColumnValue(column, ticker, financials, columnContext);
            }}
            financialsMap={financialsMap}
            sortColumnId={activeSort.columnId}
            sortDirection={activeSort.direction}
            onHeaderClick={onHeaderClick}
            onRootKeyDown={onRootKeyDown}
            resetScrollKey={activeTab.id}
            onRowActivate={onRowActivate}
            emptyTitle={t("No matches yet.")}
            emptyHint=""
          />
        )}
      </Box>
    </>
  );
}
