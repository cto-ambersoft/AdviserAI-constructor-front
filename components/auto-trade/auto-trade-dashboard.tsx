"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import type { PriceLineInput } from "@/lib/trading/chart-types";
import { AutoTradeAiDecisionsCard } from "@/components/auto-trade/auto-trade-ai-decisions-card";
import { AgentAccuracyPanel } from "@/components/auto-trade/agent-accuracy-panel";
import { AutoTradeClosePositionsModal } from "@/components/auto-trade/auto-trade-close-positions-modal";
import { AutoTradeConfigForm } from "@/components/auto-trade/auto-trade-config-form";
import { AutoTradeChartPanel } from "@/components/auto-trade/auto-trade-chart-panel";
import { AutoTradeHealthCard } from "@/components/auto-trade/auto-trade-health-card";
import { AutoTradePositionTraceModal } from "@/components/auto-trade/auto-trade-position-trace-modal";
import { AutoTradePnlCards } from "@/components/auto-trade/auto-trade-pnl-cards";
import Link from "next/link";
import { AutoTradeSyncWarning } from "@/components/auto-trade/auto-trade-sync-warning";
import { StrategyStatusBadge } from "@/components/auto-trade/strategy-status-badge";
import { AutoTradeTradesTable } from "@/components/auto-trade/auto-trade-trades-table";
import {
  toAutoTradeForm,
  formatDateTime,
  getAutoTradeValidation,
  normalizeRiskMode,
  isSupportedAutoTradeExchange,
  buildStrategyProfilePayload,
  buildRiskConfigPayload,
} from "@/components/auto-trade/utils";
import type { AutoTradeFormState } from "@/components/auto-trade/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/trading/form-controls";
import {
  ApiError,
  getAccountTrades,
  getAutoTradeConfig,
  getAutoTradeEvents,
  getAutoTradePortfolio,
  getAutoTradePositions,
  getAutoTradeState,
  getStrategyHealth,
  getMarketMeta,
  getMarketOhlcv,
  listAutoTradeConfigs,
  listExchangeAccounts,
  listPersonalAnalysisProfiles,
  listStrategies,
  playAllAutoTrade,
  playAutoTrade,
  stopAllAutoTrade,
  stopAutoTrade,
  upsertAutoTradeConfig,
  type AccountAutoTradeEventRead,
  type AccountTradeRead,
  type AccountTradesPnlRead,
  type AutoTradeConfigRead,
  type AutoTradeEventRead,
  type AutoTradeStateResponse,
  type ExchangeAccountRead,
  type MarketMetaResponse,
  type AutoTradePositionWithPnlRead,
  type PersonalAnalysisProfileRead,
  type PortfolioSummaryResponse,
  type StrategyHealthRead,
  type StrategyRead,
} from "@/lib/api";
import {
  mapAccountTradesToChartMarkers,
  mapAutoTradeEventsToTimelineRows,
  normalizeSymbolForChart,
  normalizeSymbolForMarketQuery,
} from "@/lib/auto-trade/mappers";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { mapMarketRowsToCandles } from "@/lib/trading/mappers";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";
const EVENTS_LIMIT = 50;
const TRADES_LIMIT = 120;
const FALLBACK_TIMEFRAME = "1h";
const FALLBACK_BARS = 300;
// W9 / AC#7 — how often the live KPI view (portfolio + selected health) auto-
// refreshes. Polling (not SSE) matches the rest of the app; SSE is W12.
const KPI_POLL_INTERVAL_MS = 30_000;

export function AutoTradeDashboard() {
  const [profiles, setProfiles] = useState<PersonalAnalysisProfileRead[]>([]);
  const [accounts, setAccounts] = useState<ExchangeAccountRead[]>([]);
  const [strategies, setStrategies] = useState<StrategyRead[]>([]);
  const [configs, setConfigs] = useState<AutoTradeConfigRead[]>([]);
  const [marketMeta, setMarketMeta] = useState<MarketMetaResponse | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  // W7 asset-expansion: when one account holds two strategies (e.g. BTC +
  // ETH on the same sub-account), the dashboard scopes by config_id instead
  // of account_id alone. ``selectedAccountId`` is derived from the chosen
  // config so the existing account-scoped APIs keep working.
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [runtimeState, setRuntimeState] =
    useState<AutoTradeStateResponse | null>(null);
  const [accountTrades, setAccountTrades] = useState<AccountTradeRead[]>([]);
  const [accountTradesPnl, setAccountTradesPnl] =
    useState<AccountTradesPnlRead | null>(null);
  const [accountAutoEvents, setAccountAutoEvents] = useState<
    AccountAutoTradeEventRead[]
  >([]);
  const [events, setEvents] = useState<AutoTradeEventRead[]>([]);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [candles, setCandles] = useState<
    ReturnType<typeof mapMarketRowsToCandles>
  >([]);
  const [chartMarkers, setChartMarkers] = useState<
    ReturnType<typeof mapAccountTradesToChartMarkers>
  >([]);
  const [form, setForm] = useState<AutoTradeFormState>(toAutoTradeForm(null));
  const [timeframe, setTimeframe] = useState(FALLBACK_TIMEFRAME);
  const [bars, setBars] = useState(FALLBACK_BARS);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(true);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(false);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [isTradesLoading, setIsTradesLoading] = useState(false);
  const [isPnlLoading, setIsPnlLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayBusy, setIsPlayBusy] = useState(false);
  const [isStopBusy, setIsStopBusy] = useState(false);
  const [playBlockerMessage, setPlayBlockerMessage] = useState("");
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  // W7 — portfolio summary, sub-account balance, bulk lifecycle state.
  const [portfolio, setPortfolio] = useState<PortfolioSummaryResponse | null>(null);
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  // W9 — on-read composite health for the selected strategy (drill-down).
  const [strategyHealth, setStrategyHealth] =
    useState<StrategyHealthRead | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  // W9 — positions for the selected scope + the open trace drawer (post-trade).
  const [positions, setPositions] = useState<AutoTradePositionWithPnlRead[]>(
    [],
  );
  // positions are still fetched (used for the chart TP/SL lines), only the
  // loading flag's UI consumer (the removed positions card) is gone.
  const [, setIsPositionsLoading] = useState(false);
  const [tracePositionId, setTracePositionId] = useState<number | null>(null);

  const requestIdRef = useRef(0);
  const selectedFormAccount = useMemo(
    () => accounts.find((account) => account.id === form.account_id) ?? null,
    [accounts, form.account_id],
  );
  const selectedScopeAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );
  const supportedAccounts = useMemo(
    () => accounts.filter((account) => isSupportedAutoTradeExchange(account)),
    [accounts],
  );
  const configuredAccountIds = useMemo(
    () => new Set(configs.map((config) => config.account_id)),
    [configs],
  );
  const creatableAccounts = useMemo(
    () =>
      supportedAccounts.filter(
        (account) => !configuredAccountIds.has(account.id),
      ),
    [configuredAccountIds, supportedAccounts],
  );
  const hasConfigForScope = useMemo(() => {
    if (selectedAccountId === null) {
      return false;
    }
    return configuredAccountIds.has(selectedAccountId);
  }, [configuredAccountIds, selectedAccountId]);
  const configForScope = useMemo(() => {
    // W7: prefer the explicit config_id selection. Fall back to the first
    // config on the account so existing single-strategy users see no UX
    // change.
    if (selectedConfigId !== null) {
      return configs.find((item) => item.id === selectedConfigId) ?? null;
    }
    return configs.find((item) => item.account_id === selectedAccountId) ?? null;
  }, [configs, selectedAccountId, selectedConfigId]);
  const profileForScope = useMemo(() => {
    const profileId = configForScope?.profile_id ?? form.profile_id;
    if (!profileId) {
      return null;
    }
    return profiles.find((item) => item.id === profileId) ?? null;
  }, [configForScope?.profile_id, form.profile_id, profiles]);
  const scopeSymbol = useMemo(
    () => normalizeSymbolForChart(profileForScope?.symbol),
    [profileForScope?.symbol],
  );
  const scopeMarketSymbol = useMemo(
    () => normalizeSymbolForMarketQuery(profileForScope?.symbol),
    [profileForScope?.symbol],
  );
  // TP / SL of each open position, drawn as horizontal lines on the chart.
  const chartPriceLines = useMemo<PriceLineInput[]>(() => {
    const lines: PriceLineInput[] = [];
    for (const { position } of positions) {
      if (position.status !== "open") continue;
      if (Number.isFinite(position.tp_price)) {
        lines.push({
          id: `tp-${position.id}`,
          price: position.tp_price,
          color: "hsl(161 84% 42%)",
          title: "TP",
        });
      }
      if (Number.isFinite(position.sl_price)) {
        lines.push({
          id: `sl-${position.id}`,
          price: position.sl_price,
          color: "hsl(350 90% 61%)",
          title: "SL",
        });
      }
    }
    return lines;
  }, [positions]);
  const scopeExchangeName = selectedScopeAccount?.exchange_name;
  const availableTimeframes = useMemo(() => {
    const list = marketMeta?.common_timeframes ?? [];
    if (list.length > 0) {
      return list;
    }
    return [FALLBACK_TIMEFRAME];
  }, [marketMeta?.common_timeframes]);
  const minBars = marketMeta?.min_bars ?? 50;
  const maxBars = marketMeta?.max_bars ?? 2000;
  const quickTimelineRows = useMemo(
    () => mapAutoTradeEventsToTimelineRows(accountAutoEvents, []),
    [accountAutoEvents],
  );
  const validation = useMemo(
    () => getAutoTradeValidation(form, selectedFormAccount),
    [form, selectedFormAccount],
  );
  const canPlayStop = selectedAccountId !== null && hasConfigForScope;
  const atrStrategies = useMemo(
    () => strategies.filter((item) => item.strategy_type === "atr_order_block"),
    [strategies],
  );

  const loadScoped = useCallback(
    async ({
      accountId,
      configId,
      symbol,
      marketSymbol,
      timeframeValue,
      barsValue,
      exchangeName,
      showLoader = true,
    }: {
      accountId: number;
      // W7: optional explicit config scope for accounts that hold multiple
      // strategies. When present, every account-scoped fetch passes it on
      // to the backend so the two strategies do not bleed into one another.
      configId?: number;
      symbol: string;
      marketSymbol: string;
      timeframeValue: string;
      barsValue: number;
      exchangeName?: string;
      showLoader?: boolean;
    }) => {
      const requestId = ++requestIdRef.current;
      if (showLoader) {
        setIsConfigLoading(true);
        setIsRuntimeLoading(true);
        setIsEventsLoading(true);
        setIsTradesLoading(true);
        setIsPnlLoading(true);
        setIsChartLoading(true);
      }

      const applyIfCurrent = (apply: () => void) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        apply();
      };

      const configPromise = (async () => {
        try {
          const configResponse = await getAutoTradeConfig({
            account_id: accountId,
            ...(configId !== undefined ? { config_id: configId } : {}),
          });
          applyIfCurrent(() => {
            setForm(toAutoTradeForm(configResponse));
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            applyIfCurrent(() => {
              setForm((prev) => ({
                ...toAutoTradeForm(null),
                account_id: accountId,
                profile_id: prev.profile_id,
              }));
            });
            return;
          }
          throw error;
        } finally {
          applyIfCurrent(() => {
            setIsConfigLoading(false);
          });
        }
      })();

      const runtimePromise = (async () => {
        try {
          const stateResponse = await getAutoTradeState({
            account_id: accountId,
            ...(configId !== undefined ? { config_id: configId } : {}),
          });
          applyIfCurrent(() => {
            setRuntimeState(stateResponse);
          });
        } catch {
          applyIfCurrent(() => {
            setRuntimeState(null);
          });
        } finally {
          applyIfCurrent(() => {
            setIsRuntimeLoading(false);
          });
        }
      })();

      const eventsPromise = (async () => {
        try {
          const eventsResponse = await getAutoTradeEvents({
            account_id: accountId,
            ...(configId !== undefined ? { config_id: configId } : {}),
            limit: EVENTS_LIMIT,
          });
          applyIfCurrent(() => {
            setEvents(eventsResponse.events ?? []);
          });
        } catch {
          applyIfCurrent(() => {
            setEvents([]);
          });
        } finally {
          applyIfCurrent(() => {
            setIsEventsLoading(false);
          });
        }
      })();

      const tradesPromise = (async () => {
        if (!symbol) {
          applyIfCurrent(() => {
            setAccountTrades([]);
            setAccountAutoEvents([]);
            setSyncWarnings([]);
            setChartMarkers([]);
            setAccountTradesPnl(null);
            setIsTradesLoading(false);
            setIsPnlLoading(false);
          });
          return;
        }

        try {
          const tradesResponse = await getAccountTrades({
            account_id: accountId,
            symbol,
            limit: TRADES_LIMIT,
            events_limit: EVENTS_LIMIT,
          });
          applyIfCurrent(() => {
            const tradesRows = tradesResponse.trades ?? [];
            setAccountTrades(tradesRows);
            setAccountTradesPnl(tradesResponse.pnl ?? null);
            setAccountAutoEvents(tradesResponse.auto_trade_events ?? []);
            setSyncWarnings(tradesResponse.sync_warnings ?? []);
            setChartMarkers(mapAccountTradesToChartMarkers(tradesRows));
          });
        } catch {
          applyIfCurrent(() => {
            setAccountTrades([]);
            setAccountAutoEvents([]);
            setSyncWarnings([]);
            setChartMarkers([]);
            setAccountTradesPnl(null);
          });
        } finally {
          applyIfCurrent(() => {
            setIsTradesLoading(false);
            setIsPnlLoading(false);
          });
        }
      })();

      const chartPromise = (async () => {
        if (!marketSymbol || !exchangeName) {
          applyIfCurrent(() => {
            setCandles([]);
            setIsChartLoading(false);
          });
          return;
        }
        try {
          const marketResponse = await getMarketOhlcv({
            exchange_name: exchangeName,
            symbol: marketSymbol,
            timeframe: timeframeValue,
            bars: barsValue,
          });
          applyIfCurrent(() => {
            setCandles(mapMarketRowsToCandles(marketResponse));
          });
        } catch {
          applyIfCurrent(() => {
            setCandles([]);
          });
        } finally {
          applyIfCurrent(() => {
            setIsChartLoading(false);
          });
        }
      })();

      await Promise.allSettled([configPromise, runtimePromise, eventsPromise]);
      await Promise.allSettled([tradesPromise, chartPromise]);
    },
    [],
  );

  const loadPage = useCallback(async () => {
    setIsPageLoading(true);
    setIsMetaLoading(true);
    setIsStrategiesLoading(true);
    try {
      const [
        configsResult,
        profilesResult,
        accountsResult,
        marketMetaResult,
        strategiesResult,
      ] =
        await Promise.allSettled([
          listAutoTradeConfigs(),
          listPersonalAnalysisProfiles(),
          listExchangeAccounts(),
          getMarketMeta(),
          listStrategies({ strategy_type: "atr_order_block" }),
        ]);
      if (configsResult.status !== "fulfilled") {
        throw configsResult.reason;
      }
      const configsRes = configsResult.value;
      const nextConfigs = configsRes.configs ?? [];
      setConfigs(nextConfigs);

      const nextAccountId =
        configsRes.active_account_id ??
        configsRes.active_config?.account_id ??
        nextConfigs[0]?.account_id ??
        null;
      setSelectedAccountId(nextAccountId);
      setIsPageLoading(false);

      const nextProfiles =
        profilesResult.status === "fulfilled" ? profilesResult.value : [];
      const nextAccounts =
        accountsResult.status === "fulfilled" ? accountsResult.value : [];
      const nextStrategies =
        strategiesResult.status === "fulfilled" ? strategiesResult.value : [];
      setProfiles(nextProfiles);
      setAccounts(nextAccounts);
      setStrategies(nextStrategies);
      if (marketMetaResult.status === "fulfilled") {
        setMarketMeta(marketMetaResult.value);
        setTimeframe(
          marketMetaResult.value.default_timeframe || FALLBACK_TIMEFRAME,
        );
        setBars(
          clampBars(
            marketMetaResult.value.default_bars || FALLBACK_BARS,
            marketMetaResult.value.min_bars,
            marketMetaResult.value.max_bars,
          ),
        );
      } else {
        setMarketMeta(null);
      }

      setSelectedAccountId((prev) => {
        if (prev !== null) {
          return prev;
        }
        return supportedAccountsFrom(nextAccounts)[0]?.id ?? null;
      });
    } catch (error) {
      notifyError(toUserError(error, "Failed to load auto-trade page."));
    } finally {
      setIsPageLoading(false);
      setIsMetaLoading(false);
      setIsStrategiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (selectedAccountId === null || isPageLoading) {
      return;
    }
    setPlayBlockerMessage("");
    void loadScoped({
      accountId: selectedAccountId,
      configId: selectedConfigId ?? undefined,
      symbol: scopeSymbol,
      marketSymbol: scopeMarketSymbol,
      timeframeValue: timeframe,
      barsValue: bars,
      exchangeName: scopeExchangeName,
    });
  }, [
    bars,
    isPageLoading,
    loadScoped,
    scopeExchangeName,
    scopeMarketSymbol,
    scopeSymbol,
    selectedAccountId,
    selectedConfigId,
    timeframe,
  ]);

  // W7 — load portfolio summary once configs are known.
  const loadPortfolio = useCallback(async () => {
    setIsPortfolioLoading(true);
    try {
      const next = await getAutoTradePortfolio();
      setPortfolio(next);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      // Portfolio is non-critical for individual strategy editing — drop
      // the error silently and let the rest of the dashboard continue.
    } finally {
      setIsPortfolioLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPageLoading) return;
    void loadPortfolio();
  }, [configs, isPageLoading, loadPortfolio]);

  // W9 — on-read composite health for the selected (saved) strategy. Keyed by
  // the config id; non-fatal (404 / not-enough-trades clears it).
  const loadStrategyHealth = useCallback(async (configId: number) => {
    setIsHealthLoading(true);
    try {
      const next = await getStrategyHealth(configId);
      setStrategyHealth(next);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setStrategyHealth(null);
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  const healthConfigId = configForScope?.id ?? null;

  useEffect(() => {
    if (healthConfigId === null || isPageLoading) {
      setStrategyHealth(null);
      return;
    }
    void loadStrategyHealth(healthConfigId);
  }, [healthConfigId, isPageLoading, loadStrategyHealth]);

  // W9 — positions for the trace viewer, scoped like the rest of the dashboard.
  const loadPositions = useCallback(
    async (accountId: number, configId: number | null) => {
      setIsPositionsLoading(true);
      try {
        const next = await getAutoTradePositions({
          account_id: accountId,
          config_id: configId ?? undefined,
          limit: 25,
        });
        setPositions(next.positions ?? []);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        setPositions([]);
      } finally {
        setIsPositionsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedAccountId === null || isPageLoading) {
      setPositions([]);
      return;
    }
    void loadPositions(selectedAccountId, selectedConfigId);
  }, [
    isPageLoading,
    loadPositions,
    selectedAccountId,
    selectedConfigId,
  ]);

  // W9 / AC#7 — keep the live KPI view fresh. Polls portfolio + the selected
  // strategy's health on an interval, paused while the tab is hidden (skips
  // the fetch, so no requests fire in the background), and refreshes promptly
  // when the user returns. Manual Refresh + refresh-after-action still apply.
  //
  // The tick logic is held in a ref (useInterval pattern) so changing the
  // scope updates *what* is polled without tearing down and recreating the
  // timer — that keeps exactly one interval alive for the page's lifetime and
  // avoids resetting the 30s rhythm on every strategy switch.
  const pollTickRef = useRef<() => void>(() => {});
  useEffect(() => {
    pollTickRef.current = () => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      void loadPortfolio();
      if (healthConfigId !== null) {
        void loadStrategyHealth(healthConfigId);
      }
    };
  }, [healthConfigId, loadPortfolio, loadStrategyHealth]);

  useEffect(() => {
    if (isPageLoading) {
      return;
    }
    const interval = setInterval(() => pollTickRef.current(), KPI_POLL_INTERVAL_MS);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        pollTickRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isPageLoading]);

  const handlePlayAll = useCallback(async () => {
    setIsBulkBusy(true);
    try {
      const outcome = await playAllAutoTrade();
      notifySuccess(
        `Play-all: ${outcome.succeeded} started, ${outcome.skipped} skipped, ${outcome.failed} failed.`,
      );
      await loadPortfolio();
    } catch (error) {
      if (error instanceof ApiError) notifyError(error.message);
      else throw error;
    } finally {
      setIsBulkBusy(false);
    }
  }, [loadPortfolio]);

  const handleStopAll = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Stop every running strategy? Open positions stay open.")
    ) {
      return;
    }
    setIsBulkBusy(true);
    try {
      const outcome = await stopAllAutoTrade();
      notifySuccess(
        `Stop-all: ${outcome.succeeded} stopped, ${outcome.skipped} skipped, ${outcome.failed} failed.`,
      );
      await loadPortfolio();
    } catch (error) {
      if (error instanceof ApiError) notifyError(error.message);
      else throw error;
    } finally {
      setIsBulkBusy(false);
    }
  }, [loadPortfolio]);

  const portfolioEntryForScope = useMemo(() => {
    if (!portfolio?.strategies) return null;
    // W7 asset-expansion: prefer config_id match (so BTC + ETH on a single
    // sub-account each get their own portfolio row). Account-only fallback
    // remains for single-strategy users.
    if (selectedConfigId !== null) {
      return (
        portfolio.strategies.find((entry) => entry.config_id === selectedConfigId) ??
        null
      );
    }
    return (
      portfolio.strategies.find((entry) => entry.account_id === selectedAccountId) ??
      null
    );
  }, [portfolio?.strategies, selectedAccountId, selectedConfigId]);

  const handleRefresh = useCallback(async () => {
    await loadPage();
    notifySuccess("Auto-trade data refreshed.");
  }, [loadPage]);

  const handleSave = useCallback(async () => {
    if (!validation.isValid) {
      notifyError(validation.message);
      return;
    }

    setIsSaving(true);
    setPlayBlockerMessage("");
    try {
      const atrOverrides = Object.fromEntries(
        Object.entries(form.strategy_overrides).filter(([, value]) =>
          Number.isFinite(value),
        ),
      );
      const strategyProfilePayload = buildStrategyProfilePayload(form.strategy_profile);
      const payload = {
        enabled: form.enabled,
        profile_id: form.profile_id as number,
        account_id: form.account_id as number,
        position_size_usdt: form.position_size_usdt,
        leverage: Math.round(form.leverage),
        min_confidence_pct: form.min_confidence_pct,
        fast_close_confidence_pct: form.fast_close_confidence_pct,
        confirm_reports_required: Math.round(form.confirm_reports_required),
        risk_mode: normalizeRiskMode(form.risk_mode),
        sl_pct: form.sl_pct,
        tp_pct: form.tp_pct,
        // W8/W9 risk governance — always sent (controlled section). Unset
        // limits are null ("rule off"), matching the backend defaults.
        risk: buildRiskConfigPayload(form.risk),
        signal_source: form.signal_source,
        timeframe: form.timeframe.trim(),
        bars: Math.round(form.bars),
        poll_interval_seconds: Math.round(form.poll_interval_seconds),
        ...(form.signal_source === "strategy_atr_block"
          ? {
              strategy_id: form.strategy_id as number,
              strategy_overrides: atrOverrides,
            }
          : {}),
        ...(strategyProfilePayload !== null
          ? { strategy_profile: strategyProfilePayload }
          : {}),
        ...(form.strategy_name !== null && form.strategy_name !== undefined
          ? { strategy_name: form.strategy_name }
          : {}),
        // T16 (W12e): attach a catalogue forecast to this live strategy. Always
        // sent (null detaches) so clearing the field actually removes the link
        // — the backend update is guarded by model_fields_set (review I3).
        attached_forecast_id: form.attached_forecast_id ?? null,
      };

      const savedConfig = await upsertAutoTradeConfig(payload);
      const nextConfigsResponse = await listAutoTradeConfigs();
      setConfigs(nextConfigsResponse.configs ?? []);
      setSelectedAccountId(savedConfig.account_id);
      const savedProfile =
        profiles.find((item) => item.id === savedConfig.profile_id) ?? null;
      const savedAccount =
        accounts.find((item) => item.id === savedConfig.account_id) ?? null;
      await loadScoped({
        accountId: savedConfig.account_id,
        symbol: normalizeSymbolForChart(savedProfile?.symbol),
        marketSymbol: normalizeSymbolForMarketQuery(savedProfile?.symbol),
        timeframeValue: timeframe,
        barsValue: bars,
        exchangeName: savedAccount?.exchange_name,
      });
      notifySuccess("Auto-trade config saved.");
    } catch (error) {
      notifyError(toUserError(error, "Failed to save config."));
    } finally {
      setIsSaving(false);
    }
  }, [
    accounts,
    bars,
    form,
    loadScoped,
    profiles,
    timeframe,
    validation.isValid,
    validation.message,
  ]);

  const handlePlay = useCallback(async () => {
    if (!selectedAccountId) {
      notifyError("Select account scope first.");
      return;
    }
    setIsPlayBusy(true);
    setPlayBlockerMessage("");
    try {
      await playAutoTrade({ account_id: selectedAccountId });
      await loadScoped({
        accountId: selectedAccountId,
        symbol: scopeSymbol,
        marketSymbol: scopeMarketSymbol,
        timeframeValue: timeframe,
        barsValue: bars,
        exchangeName: scopeExchangeName,
      });
      notifySuccess("Auto-trade started.");
    } catch (error) {
      if (error instanceof ApiError && isAutoRunAccountBusyError(error)) {
        const blockerMessage = extractApiErrorDetail(error);
        setPlayBlockerMessage(
          blockerMessage ||
            "This account is already busy with an active auto-run. Stop current run first.",
        );
      }
      notifyError(toUserError(error, "Failed to start auto-trade."));
    } finally {
      setIsPlayBusy(false);
    }
  }, [
    bars,
    loadScoped,
    scopeExchangeName,
    scopeMarketSymbol,
    scopeSymbol,
    selectedAccountId,
    timeframe,
  ]);

  const handleAfterClose = useCallback(async () => {
    if (selectedAccountId === null) {
      return;
    }
    await loadScoped({
      accountId: selectedAccountId,
      symbol: scopeSymbol,
      marketSymbol: scopeMarketSymbol,
      timeframeValue: timeframe,
      barsValue: bars,
      exchangeName: scopeExchangeName,
    });
  }, [
    bars,
    loadScoped,
    scopeExchangeName,
    scopeMarketSymbol,
    scopeSymbol,
    selectedAccountId,
    timeframe,
  ]);

  const handleStop = useCallback(async () => {
    if (!selectedAccountId) {
      notifyError("Select account scope first.");
      return;
    }
    setIsStopBusy(true);
    try {
      await stopAutoTrade({ account_id: selectedAccountId });
      setPlayBlockerMessage("");
      await loadScoped({
        accountId: selectedAccountId,
        symbol: scopeSymbol,
        marketSymbol: scopeMarketSymbol,
        timeframeValue: timeframe,
        barsValue: bars,
        exchangeName: scopeExchangeName,
      });
      notifySuccess("Auto-trade stopped.");
    } catch (error) {
      notifyError(toUserError(error, "Failed to stop auto-trade."));
    } finally {
      setIsStopBusy(false);
    }
  }, [
    bars,
    loadScoped,
    scopeExchangeName,
    scopeMarketSymbol,
    scopeSymbol,
    selectedAccountId,
    timeframe,
  ]);

  // ``strategies`` is optional on the OpenAPI contract — narrow it once here so
  // the portfolio header block below can read ``.length`` safely.
  const portfolioStrategies = portfolio?.strategies ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Auto Trade</h1>
          <p className="text-sm text-muted-foreground">
            Configure, run, and monitor live strategies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/auto-trade/new">New strategy</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={isPageLoading}
          >
            {isPageLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* W7: aggregated portfolio header + bulk lifecycle. */}
      {portfolio && portfolioStrategies.length >= 1 ? (
        <Card className={`mb-4 ${CARD_CLASS}`}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Portfolio — {portfolioStrategies.length} strategies
                </CardTitle>
                <CardDescription className="text-xs">
                  {portfolio.total_running_strategies} running ·{" "}
                  {portfolio.total_open_positions} open positions
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePlayAll()}
                  disabled={isBulkBusy || isPortfolioLoading || portfolioStrategies.length === 0}
                >
                  {isBulkBusy ? "..." : "Play All"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleStopAll()}
                  disabled={isBulkBusy || isPortfolioLoading || portfolio.total_running_strategies === 0}
                >
                  {isBulkBusy ? "..." : "Stop All"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <PortfolioMetric label="Realized PnL" value={portfolio.total_realized_pnl_usdt} />
            <PortfolioMetric label="Unrealized PnL" value={portfolio.total_unrealized_pnl_usdt} />
            <div className="flex flex-col text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">Strategies</span>
              <span className="text-base text-foreground">
                {portfolio.total_running_strategies}/{portfolioStrategies.length} running
              </span>
            </div>
            <div className="flex flex-col text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">Max DD (worst)</span>
              <span
                className="text-base text-foreground"
                title="Worst per-strategy drawdown — % of per-trade notional, not account equity (W9 proxy). A true merged-equity portfolio DD is W11."
              >
                {typeof portfolio.portfolio_max_dd_pct === "number"
                  ? `${portfolio.portfolio_max_dd_pct.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Config Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* W7 Asset Expansion: the picker is keyed by config_id so two
                  strategies on the same sub-account (e.g. BTC + ETH) remain
                  distinguishable. Empty-config options carry a "new:<acc>"
                  value to bootstrap a fresh config on that account. */}
              <select
                className={`${INPUT_CLASS} min-w-[320px] flex-1`}
                value={
                  selectedConfigId !== null
                    ? `cfg:${selectedConfigId}`
                    : selectedAccountId !== null
                      ? `new:${selectedAccountId}`
                      : ""
                }
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    setSelectedConfigId(null);
                    setSelectedAccountId(null);
                    return;
                  }
                  const [kind, idStr] = raw.split(":");
                  const id = Number(idStr);
                  if (!Number.isFinite(id)) return;
                  if (kind === "cfg") {
                    const cfg = configs.find((c) => c.id === id);
                    setSelectedConfigId(id);
                    setSelectedAccountId(cfg?.account_id ?? null);
                  } else if (kind === "new") {
                    setSelectedConfigId(null);
                    setSelectedAccountId(id);
                  }
                }}
                disabled={
                  isPageLoading ||
                  (isMetaLoading && supportedAccounts.length === 0)
                }
              >
                <option value="">
                  {supportedAccounts.length
                    ? "Select strategy"
                    : "No supported accounts"}
                </option>
                {configs.map((cfg) => {
                  const account = supportedAccounts.find(
                    (acc) => acc.id === cfg.account_id,
                  );
                  if (!account) return null;
                  const profile = profiles.find((p) => p.id === cfg.profile_id);
                  const strategyLabel = cfg.strategy_name?.trim();
                  const runningMark = cfg.is_running ? " ● running" : "";
                  const symbolHint = profile?.symbol ? ` · ${profile.symbol}` : "";
                  const label =
                    strategyLabel ||
                    profile?.symbol ||
                    `config #${cfg.id}`;
                  return (
                    <option key={`cfg:${cfg.id}`} value={`cfg:${cfg.id}`}>
                      {label}
                      {symbolHint && !strategyLabel ? "" : symbolHint}
                      {` · ${account.account_label}/${account.exchange_name}/${account.mode}`}
                      {runningMark}
                    </option>
                  );
                })}
                {/* Accounts without any config yet — selectable to bootstrap. */}
                {creatableAccounts.map((account) => (
                  <option key={`new:${account.id}`} value={`new:${account.id}`}>
                    new config · {account.account_label} / {account.exchange_name} /{" "}
                    {account.mode}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Runtime Controls</CardTitle>
            <CardDescription>
              Start/stop execution for current account scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StrategyStatusBadge
                lifecycleStage={configForScope?.lifecycle_stage}
                isRunning={
                  runtimeState?.config?.is_running ??
                  configForScope?.is_running ??
                  false
                }
                showDot
              />
              {runtimeState?.config?.enabled === false ? (
                <Badge variant="outline">disabled</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void handlePlay()}
                disabled={!canPlayStop || isPlayBusy}
              >
                {isPlayBusy ? "Starting..." : "Play"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleStop()}
                disabled={!canPlayStop || isStopBusy}
              >
                {isStopBusy ? "Stopping..." : "Stop"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCloseModalOpen(true)}
                disabled={!canPlayStop}
                title={
                  !canPlayStop
                    ? "Pick an account scope with a saved config first"
                    : "Cancel TP/SL and market-close every open position"
                }
              >
                <ShieldAlert className="mr-1.5 h-4 w-4" />
                Close positions
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Stop</strong> halts new signals; <strong>Close positions</strong>{" "}
              also flattens open trades.
            </p>
            {playBlockerMessage ? (
              <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{playBlockerMessage}</p>
                <Button
                  className="mt-2"
                  variant="destructive"
                  onClick={() => void handleStop()}
                  disabled={!canPlayStop || isStopBusy}
                >
                  {isStopBusy ? "Stopping..." : "Stop current"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AutoTradeSyncWarning warnings={syncWarnings} />

      <div className="mt-4">
        <AutoTradeChartPanel
          candles={candles}
          markers={chartMarkers}
          priceLines={chartPriceLines}
          symbol={scopeMarketSymbol}
          timeframe={timeframe}
          bars={bars}
          minBars={minBars}
          maxBars={maxBars}
          timeframes={availableTimeframes}
          isLoading={isChartLoading}
          onTimeframeChange={setTimeframe}
          onBarsChange={setBars}
        />
      </div>

      <div className="mt-4">
        <AutoTradePnlCards
          accountPnl={accountTradesPnl}
          isLoading={isPnlLoading}
        />
      </div>

      <div className="mt-4">
        <AutoTradeHealthCard
          entry={portfolioEntryForScope}
          health={strategyHealth}
          isLoading={isPortfolioLoading && !portfolioEntryForScope}
          isHealthLoading={isHealthLoading}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Auto Trade Config</CardTitle>
          </CardHeader>
          <CardContent>
            {isPageLoading || isConfigLoading ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading config...
              </p>
            ) : (
              <AutoTradeConfigForm
                form={form}
                profiles={profiles}
                accounts={accounts}
                strategies={atrStrategies}
                isStrategiesLoading={isStrategiesLoading}
                isBusy={isSaving}
                validationMessage={validation.message}
                onChange={(updater) => setForm((prev) => updater(prev))}
                onSubmit={() => void handleSave()}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={CARD_CLASS}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Runtime State & Trades</CardTitle>
                {isRuntimeLoading ? (
                  <Badge variant="outline" className="text-xs">
                    Loading...
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Row label="Last started" value={formatDateTime(runtimeState?.config?.last_started_at)} />
              <Row label="Last stopped" value={formatDateTime(runtimeState?.config?.last_stopped_at)} />
              <Row label="Symbol" value={scopeSymbol || "—"} />
              <Row label="Loaded trades" value={String(accountTrades.length)} />
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Quick Log (account trades sync)</CardTitle>
                {isTradesLoading ? (
                  <Badge variant="outline" className="text-xs">
                    Loading...
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {quickTimelineRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="max-h-[360px] overflow-auto rounded-md border border-border/70">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-2 py-2 text-left">Time</th>
                        <th className="px-2 py-2 text-left">Source</th>
                        <th className="px-2 py-2 text-left">Level</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickTimelineRows.map((event) => (
                        <tr
                          key={event.id}
                          className="border-t border-border/60"
                        >
                          <td className="px-2 py-1.5">
                            {formatDateTime(event.created_at)}
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge variant="outline">
                              {event.source === "account_trades"
                                ? "sync"
                                : "runtime"}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5">{event.level}</td>
                          <td className="px-2 py-1.5">{event.event_type}</td>
                          <td className="px-2 py-1.5">
                            {event.message ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {!hasConfigForScope && selectedScopeAccount ? (
            <Card className={CARD_CLASS}>
              <CardHeader>
                <CardTitle>Create Mode</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                No config exists for{" "}
                <span className="text-foreground">
                  {selectedScopeAccount.account_label}
                </span>{" "}
                yet. Fill the form and save to create one.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <AutoTradeTradesTable
              trades={accountTrades}
              isLoading={isTradesLoading}
            />
          </CardContent>
        </Card>
        {selectedAccountId !== null && closeModalOpen ? (
          <AutoTradeClosePositionsModal
            accountId={selectedAccountId}
            accountLabel={selectedScopeAccount?.account_label}
            open={closeModalOpen}
            onOpenChange={setCloseModalOpen}
            onClosed={() => {
              void handleAfterClose();
            }}
          />
        ) : null}
        {tracePositionId !== null ? (
          <AutoTradePositionTraceModal
            positionId={tracePositionId}
            open={tracePositionId !== null}
            onOpenChange={(open) => {
              if (!open) setTracePositionId(null);
            }}
          />
        ) : null}
        <Card className={CARD_CLASS}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Full Auto-mode Event Log</CardTitle>
              {isEventsLoading ? (
                <Badge variant="outline" className="text-xs">
                  Loading...
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="max-h-[360px] overflow-auto rounded-md border border-border/70">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-2 text-left">Time</th>
                      <th className="px-2 py-2 text-left">Level</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-t border-border/60">
                        <td className="px-2 py-1.5">
                          {formatDateTime(event.created_at)}
                        </td>
                        <td className="px-2 py-1.5">{event.level}</td>
                        <td className="px-2 py-1.5">{event.event_type}</td>
                        <td className="px-2 py-1.5">{event.message ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <AutoTradeAiDecisionsCard
          events={events}
          /* Decision events use the upstream profile symbol form
             (e.g. "BTCUSDT"), not the chart-normalised one. */
          symbol={profileForScope?.symbol ?? null}
        />
        {/* T17 (W12f): per-agent accuracy + weight-suggestion apply, now trader-facing. */}
        <AgentAccuracyPanel />
      </div>
    </main>
  );
}

function supportedAccountsFrom(accounts: ExchangeAccountRead[]) {
  return accounts.filter((account) => isSupportedAutoTradeExchange(account));
}

function toUserError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detail = extractApiErrorDetail(error);
    if (detail) {
      return detail;
    }
    if (error.status === 404) {
      return "Requested profile, strategy, or exchange account was not found.";
    }
    if (error.status === 422) {
      return "Business validation failed. Check config values and account runtime state.";
    }
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function clampBars(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function extractApiErrorDetail(error: ApiError): string {
  if (typeof error.data !== "object" || error.data === null) {
    return "";
  }
  const record = error.data as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }
  const message = record.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }
  return "";
}

function isAutoRunAccountBusyError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return false;
  }
  const source = `${error.code} ${error.message} ${extractApiErrorDetail(error)}`.toLowerCase();
  return (
    source.includes("already") &&
    (source.includes("active") || source.includes("running")) &&
    (source.includes("auto") || source.includes("run") || source.includes("account"))
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function PortfolioMetric({ label, value }: { label: string; value: number }) {
  const formatted = Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${value.toFixed(2)} USDT`
    : "—";
  const tone =
    !Number.isFinite(value) || value === 0
      ? "text-foreground"
      : value > 0
        ? "text-emerald-300"
        : "text-red-300";
  return (
    <div className="flex flex-col text-xs text-muted-foreground">
      <span className="uppercase tracking-wide">{label}</span>
      <span className={`text-base ${tone}`}>{formatted}</span>
    </div>
  );
}
