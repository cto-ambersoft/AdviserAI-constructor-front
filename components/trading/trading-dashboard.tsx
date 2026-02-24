"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ArrowDownRight,
  ArrowUpRight,
  LogOut,
  PanelLeft,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  INPUT_CLASS,
  Label,
  NumericField,
  TextField,
} from "@/components/trading/form-controls";
import { MarketChart } from "@/components/trading/market-chart";
import {
  AtrStrategyForm,
  GridStrategyForm,
  IntradayStrategyForm,
  KnifeStrategyForm,
  type AtrStrategyFormState,
  type GridStrategyFormState,
  type IntradayStrategyFormState,
  type KnifeStrategyFormState,
} from "@/components/trading/strategies";
import {
  createAuditEvent,
  createStrategy,
  deleteStrategy,
  getAuditMeta,
  getBacktestCatalog,
  getHealthStatus,
  getMarketMeta,
  getMarketOhlcv,
  listAnalysisRuns,
  getVwapIndicators,
  getVwapPresets,
  getVwapRegimes,
  listAuditEvents,
  listExchangeAccounts,
  listStrategies,
  runAtrOrderBlockBacktest,
  runGridBotBacktest,
  runIntradayMomentumBacktest,
  runKnifeCatcherBacktest,
  runAtrObLiveSignal,
  runBuilderLiveSignal,
  runPortfolioBacktest,
  triggerAnalysisNow,
  runVwapBacktest,
  type AnalysisRun,
  type AnalysisTrendExtraction,
  type AtrObSignalRequest,
  type AuditLogRead,
  type AuditMetaResponse,
  type BacktestCatalogResponse,
  type BacktestResponse,
  type BuilderSignalRequest,
  type ExchangeAccountRead,
  type SignalExecuteRequest,
  type LiveSignalResult,
  type JsonRecord,
  type StrategyRead,
  type VwapBacktestRequest,
} from "@/lib/api";
import type { CandlePoint, OverlayLine } from "@/lib/trading/chart-types";
import {
  mapBacktestToMarkers,
  mapBacktestToOverlays,
  mapMarketRowsToCandles,
  toKpiRows,
} from "@/lib/trading/mappers";
import {
  DASHBOARD_TABS,
  TIMEFRAMES,
  type DashboardTab,
  type Timeframe,
} from "@/stores/trading-store";
import { useAuthStore } from "@/stores/auth-store";
import { useTradingStore } from "@/providers/trading-store-provider";
import { AnalysisReport } from "@/components/trading/analysis-report";

const CARD_CLASS = "border-border/80 bg-card/80 shadow-sm backdrop-blur";
type BuiltInStrategyKey = "atr" | "knife" | "grid" | "intraday";
type LiveStrategyKey = "builder" | "atr_ob";

type LiveExecutionFormState = {
  mode: SignalExecuteRequest["mode"];
  execute: boolean;
  account_id: number | null;
  entry_usdt: number;
  fee_pct: number;
};

function normalizeStrategyLabel(label: string) {
  return label.trim().toLowerCase();
}

function mapBuiltinStrategyLabelToKey(label: string): BuiltInStrategyKey | null {
  const normalized = normalizeStrategyLabel(label);
  if (normalized.includes("atr") && (normalized.includes("order") || normalized.includes("block"))) {
    return "atr";
  }
  if (normalized.includes("knife")) {
    return "knife";
  }
  if (normalized.includes("grid")) {
    return "grid";
  }
  if (normalized.includes("intraday") || normalized.includes("momentum")) {
    return "intraday";
  }
  return null;
}

const TAB_META: Record<DashboardTab, { title: string; description: string }> = {
  builder: {
    title: "AMBuilder",
    description:
      "Configure and run builder backtests",
  },
  strategies: {
    title: "Strategies",
    description:
      "Run saved and built-in strategies",
  },
  live: {
    title: "Live Signals",
    description:
      "Preview, simulate, and execute live signals",
  },
  portfolio: {
    title: "Portfolio",
    description:
      "Build a portfolio from selected strategies",
  },
  analysis: {
    title: "AI Analysis",
    description:
      "Market forecasts, scenarios and reports",
  },
  audit: {
    title: "Audit & Tools",
    description:
      "Event history, action filters",
  },
};

export function TradingDashboard() {
  const router = useRouter();
  const symbol = useTradingStore((state) => state.symbol);
  const timeframe = useTradingStore((state) => state.timeframe);
  const bars = useTradingStore((state) => state.bars);
  const activeTab = useTradingStore((state) => state.activeTab);
  const lastPrice = useTradingStore((state) => state.lastPrice);
  const isLoading = useTradingStore((state) => state.isLoading);
  const setSymbol = useTradingStore((state) => state.setSymbol);
  const setTimeframe = useTradingStore((state) => state.setTimeframe);
  const setBars = useTradingStore((state) => state.setBars);
  const setActiveTab = useTradingStore((state) => state.setActiveTab);
  const setLastPrice = useTradingStore((state) => state.setLastPrice);
  const setLoading = useTradingStore((state) => state.setLoading);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [marketMeta, setMarketMeta] = useState<{
    symbols: string[];
    timeframes: string[];
    minBars: number;
    maxBars: number;
  } | null>(null);
  const [exchangeAccounts, setExchangeAccounts] = useState<ExchangeAccountRead[]>([]);
  const [catalog, setCatalog] = useState<BacktestCatalogResponse | null>(null);
  const [strategyList, setStrategyList] = useState<StrategyRead[]>([]);
  const [auditMeta, setAuditMeta] = useState<AuditMetaResponse | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditLogRead[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [overlays, setOverlays] = useState<OverlayLine[]>([]);
  const [chartMarkers, setChartMarkers] = useState<ReturnType<typeof mapBacktestToMarkers>>([]);
  const [latestBacktest, setLatestBacktest] = useState<BacktestResponse | null>(null);
  const [latestPortfolio, setLatestPortfolio] = useState<JsonRecord | null>(null);
  const [vwapPresetOptions, setVwapPresetOptions] = useState<string[]>([]);
  const [vwapRegimeOptions, setVwapRegimeOptions] = useState<string[]>([]);
  const [vwapIndicatorOptions, setVwapIndicatorOptions] = useState<string[]>([]);
  const [health, setHealth] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [portfolioSelection, setPortfolioSelection] = useState<number[]>([]);
  const [portfolioWeights, setPortfolioWeights] = useState<Record<number, number>>({});
  const [auditFilter, setAuditFilter] = useState("");
  const [auditLimit] = useState(200);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [activeLiveStrategy, setActiveLiveStrategy] = useState<LiveStrategyKey>("builder");
  const [liveBuilderForm, setLiveBuilderForm] = useState<BuilderSignalRequest>({
    symbol: "BTC/USDT",
    timeframe: "1h",
    bars: 500,
    enabled: [],
    regime: "Flat",
    rr: 2,
    atr_mult: 1.5,
    account_balance: 1000,
    risk_per_trade: 1,
    max_positions: 1,
    max_position_pct: 100,
    stop_mode: "ATR",
    swing_lookback: 20,
    swing_buffer_atr: 0.3,
    ob_impulse_atr: 1.5,
    ob_buffer_atr: 0.15,
    ob_lookback: 120,
  });
  const [liveAtrObForm, setLiveAtrObForm] = useState<AtrObSignalRequest>({
    symbol: "BTC/USDT",
    timeframe: "1h",
    bars: 500,
    ema_period: 50,
    atr_period: 14,
    impulse_atr: 1.5,
    ob_buffer_atr: 0.15,
    allocation_usdt: 1000,
  });
  const [liveExecutionForm, setLiveExecutionForm] = useState<LiveExecutionFormState>({
    mode: "dry_run",
    execute: false,
    account_id: null,
    entry_usdt: 1000,
    fee_pct: 0.06,
  });
  const [latestLiveSignal, setLatestLiveSignal] = useState<LiveSignalResult | null>(null);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [latestAnalysisRun, setLatestAnalysisRun] = useState<AnalysisRun | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false);

  const [builderForm, setBuilderForm] = useState<VwapBacktestRequest>({
    symbol: "BTC/USDT",
    timeframe: "1h",
    bars: 500,
    include_series: true,
    trades_limit: 1000,
    regime: "Flat",
    preset: "Custom",
    enabled: [],
    rr: 2,
    atr_mult: 1.5,
    cooldown_bars: 5,
    account_balance: 1000,
    risk_per_trade: 1,
    max_positions: 5,
    max_position_pct: 100,
    stop_mode: "ATR",
    swing_lookback: 20,
    swing_buffer_atr: 0.3,
    ob_impulse_atr: 1.5,
    ob_buffer_atr: 0.15,
    ob_lookback: 120,
  });
  const [builderName, setBuilderName] = useState("");
  const [builderAuditReason, setBuilderAuditReason] = useState("manual run");
  const [atrForm, setAtrForm] = useState<AtrStrategyFormState>({
    ema_period: 50,
    atr_period: 14,
    impulse_atr: 1.5,
    ob_buffer_atr: 0.15,
    one_trade_per_ob: true,
    allocation_usdt: 1000,
  });
  const [knifeForm, setKnifeForm] = useState<KnifeStrategyFormState>({
    include_series: true,
    trades_limit: 1000,
    side: "long",
    entry_mode_long: "OPEN_LOW",
    entry_mode_short: "OPEN_HIGH",
    knife_move_pct: 0.35,
    entry_k_pct: 65,
    tp_pct: 0.45,
    sl_pct: 0.35,
    use_max_range_filter: true,
    max_range_pct: 1.2,
    use_wick_filter: true,
    max_wick_share_pct: 65,
    requote_each_candle: true,
    max_requotes: 6,
  });
  const [gridForm, setGridForm] = useState<GridStrategyFormState>({
    ma_period: 50,
    grid_spacing_pct: 0.5,
    grids_down: 8,
    order_fee_pct: 0.06,
    allocation_usdt: 1000,
    initial_capital_usdt: 5000,
    order_size_usdt: 100,
    close_open_positions_on_eod: true,
  });
  const [intradayForm, setIntradayForm] = useState<IntradayStrategyFormState>({
    lookback: 20,
    atr_period: 14,
    atr_mult: 2,
    rr: 2,
    vol_sma: 20,
    vol_mult: 1.2,
    time_exit_bars: 48,
    side: "long",
    allocation_usdt: 1000,
    risk_per_trade_pct: 1,
    max_positions: 1,
    fee_pct: 0.06,
    entry_size_usdt: 100,
  });
  const [portfolioCapital, setPortfolioCapital] = useState(5000);
  const [portfolioAsyncJob, setPortfolioAsyncJob] = useState(false);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setIsCatalogLoading(true);
      setErrorMessage("");
      try {
        const [
          healthData,
          marketMetaData,
          backtestCatalog,
          indicatorsMap,
          presetsMap,
          regimesMap,
          strategiesData,
          exchangeAccountsData,
          auditMetaData,
          auditEventsData,
        ] = await Promise.all([
          getHealthStatus(),
          getMarketMeta(),
          getBacktestCatalog(),
          getVwapIndicators(),
          getVwapPresets(),
          getVwapRegimes(),
          listStrategies(),
          listExchangeAccounts(),
          getAuditMeta(),
          listAuditEvents(auditLimit),
        ]);
        setHealth(healthData);
        setMarketMeta({
          symbols: [marketMetaData.default_symbol],
          timeframes: marketMetaData.common_timeframes,
          minBars: marketMetaData.min_bars,
          maxBars: marketMetaData.max_bars,
        });
        setCatalog(backtestCatalog);
        setVwapIndicatorOptions(indicatorsMap.indicators ?? []);
        setVwapPresetOptions(presetsMap.presets ?? backtestCatalog.vwap.presets ?? []);
        setVwapRegimeOptions(regimesMap.regimes ?? backtestCatalog.vwap.regimes ?? []);
        setStrategyList(strategiesData);
        setExchangeAccounts(exchangeAccountsData);
        setAuditMeta(auditMetaData);
        setAuditEvents(auditEventsData);
        try {
          const analysisRunsData = await listAnalysisRuns({ limit: 50 });
          const initialRuns = analysisRunsData.runs ?? [];
          setAnalysisRuns(initialRuns);
          setLatestAnalysisRun(initialRuns[0] ?? null);
        } catch {
          // Analysis is optional for strategy builder controls.
          setAnalysisRuns([]);
          setLatestAnalysisRun(null);
          setInfoMessage("Analysis backend is unavailable.");
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load metadata");
      } finally {
        setIsCatalogLoading(false);
        setLoading(false);
      }
    };

    void init();
  }, [auditLimit, setLoading]);

  useEffect(() => {
    const loadMarket = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const response = await getMarketOhlcv({
          symbol,
          timeframe,
          bars,
        });
        const mapped = mapMarketRowsToCandles(response);
        setCandles(mapped);
        if (mapped.length > 0) {
          setLastPrice(mapped[mapped.length - 1].close);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load market candles");
      } finally {
        setLoading(false);
      }
    };

    void loadMarket();
  }, [bars, setLastPrice, setLoading, symbol, timeframe]);

  useEffect(() => {
    if (!analysisRuns.length) {
      setSelectedAnalysisId(null);
      return;
    }
    if (!selectedAnalysisId) {
      setSelectedAnalysisId(analysisRuns[0]._id);
      return;
    }
    const stillExists = analysisRuns.some((run) => run._id === selectedAnalysisId);
    if (!stillExists) {
      setSelectedAnalysisId(analysisRuns[0]._id);
    }
  }, [analysisRuns, selectedAnalysisId]);

  const kpiRows = useMemo(() => {
    return toKpiRows(latestBacktest?.summary as JsonRecord | undefined);
  }, [latestBacktest]);

  const selectedAnalysisRun = useMemo(() => {
    if (!selectedAnalysisId) {
      return analysisRuns[0] ?? null;
    }
    return analysisRuns.find((run) => run._id === selectedAnalysisId) ?? analysisRuns[0] ?? null;
  }, [analysisRuns, selectedAnalysisId]);

  const latestTrendExtraction = latestAnalysisRun?.trendExtraction ?? null;

  useEffect(() => {
    const preferredRegime = getPreferredRegime(latestTrendExtraction);
    if (!preferredRegime) {
      return;
    }
    setBuilderForm((current) =>
      current.regime === preferredRegime ? current : { ...current, regime: preferredRegime },
    );
    setLiveBuilderForm((current) =>
      current.regime === preferredRegime ? current : { ...current, regime: preferredRegime },
    );
  }, [latestTrendExtraction]);

  const filteredAudit = useMemo(() => {
    const term = auditFilter.trim().toLowerCase();
    if (!term) {
      return auditEvents;
    }
    return auditEvents.filter((item) => {
      const payloadText = JSON.stringify(item.payload).toLowerCase();
      return (
        (item.actor ?? "").toLowerCase().includes(term) ||
        item.event.toLowerCase().includes(term) ||
        (item.reason ?? "").toLowerCase().includes(term) ||
        payloadText.includes(term)
      );
    });
  }, [auditEvents, auditFilter]);

  const strategyById = useMemo(() => {
    const map = new Map<number, StrategyRead>();
    for (const strategy of strategyList) {
      map.set(strategy.id, strategy);
    }
    return map;
  }, [strategyList]);

  const runBacktestSafely = async (runner: () => Promise<BacktestResponse>, label: string) => {
    setLoading(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const result = await runner();
      setLatestBacktest(result);
      setOverlays(mapBacktestToOverlays(result));
      setChartMarkers(mapBacktestToMarkers(result));
      setInfoMessage(`${label} backtest complete`);
      await createAuditEvent({
        event: "BACKTEST_RUN",
        reason: builderAuditReason,
        target_type: "strategy",
        target_id: label,
        payload: {
          symbol,
          timeframe,
          bars,
          trades: result.trades.length,
        },
      });
      setAuditEvents(await listAuditEvents(auditLimit));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBuilderStrategy = async () => {
    if (!builderName.trim()) {
      setErrorMessage("Strategy name is required");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      await createStrategy({
        name: builderName.trim(),
        strategy_type: "builder_vwap",
        version: "1.0.0",
        is_active: true,
        config: builderForm as unknown as JsonRecord,
        description: "Saved from web builder",
      });
      setStrategyList(await listStrategies());
      setBuilderName("");
      setInfoMessage("Strategy saved");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save strategy");
    } finally {
      setLoading(false);
    }
  };

  const runSavedStrategy = async () => {
    if (!selectedStrategyId) {
      setErrorMessage("Select a saved strategy first");
      return;
    }
    const saved = strategyById.get(selectedStrategyId);
    if (!saved) {
      setErrorMessage("Selected strategy not found");
      return;
    }
    await runBacktestSafely(async () => {
      const config = (saved.config ?? {}) as Partial<VwapBacktestRequest>;
      return runVwapBacktest({
        symbol,
        timeframe,
        bars,
        include_series: true,
        trades_limit: 1000,
        regime: (config.regime as VwapBacktestRequest["regime"]) ?? "Flat",
        preset: (config.preset as VwapBacktestRequest["preset"]) ?? "Custom",
        enabled: (config.enabled as string[] | undefined) ?? [],
        rr: Number(config.rr ?? 2),
        atr_mult: Number(config.atr_mult ?? 1.5),
        cooldown_bars: Number(config.cooldown_bars ?? 5),
        account_balance: Number(config.account_balance ?? 1000),
        risk_per_trade: Number(config.risk_per_trade ?? 1),
        max_positions: Number(config.max_positions ?? 5),
        max_position_pct: Number(config.max_position_pct ?? 100),
        stop_mode: (config.stop_mode as VwapBacktestRequest["stop_mode"]) ?? "ATR",
        swing_lookback: Number(config.swing_lookback ?? 20),
        swing_buffer_atr: Number(config.swing_buffer_atr ?? 0.3),
        ob_impulse_atr: Number(config.ob_impulse_atr ?? 1.5),
        ob_buffer_atr: Number(config.ob_buffer_atr ?? 0.15),
        ob_lookback: Number(config.ob_lookback ?? 120),
      });
    }, saved.name);
  };

  const handleDeleteStrategy = async () => {
    if (!selectedStrategyId) {
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      await deleteStrategy(selectedStrategyId);
      const nextStrategies = await listStrategies();
      setStrategyList(nextStrategies);
      setSelectedStrategyId(null);
      setInfoMessage("Strategy deleted");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete strategy");
    } finally {
      setLoading(false);
    }
  };

  const runPortfolio = async () => {
    const selected = strategyList.filter((item) => portfolioSelection.includes(item.id));
    if (selected.length === 0) {
      setErrorMessage("Pick at least one strategy for portfolio run");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const weighted = selected.map((strategy) => ({
        strategy,
        weight: Number(portfolioWeights[strategy.id] ?? 0),
      }));
      const totalRawWeight = weighted.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
      const normalizedWeighted = weighted.map((item) => ({
        strategy: item.strategy,
        weight:
          totalRawWeight > 0
            ? Number(((Math.max(0, item.weight) / totalRawWeight) * 100).toFixed(4))
            : Number((100 / weighted.length).toFixed(4)),
      }));

      const result = await runPortfolioBacktest({
        total_capital: portfolioCapital,
        async_job: portfolioAsyncJob,
        strategies: normalizedWeighted.map(({ strategy, weight }) => ({
          name: strategy.name,
          weight,
          config: (strategy.config ?? {}) as JsonRecord,
          trades: [],
        })),
      });
      setLatestPortfolio(result);
      setInfoMessage("Portfolio backtest complete");
      await createAuditEvent({
        event: "PORTFOLIO_RUN",
        reason: builderAuditReason,
        target_type: "portfolio",
        target_id: "portfolio",
        payload: {
          strategies: selected.map((item) => item.name),
          total_capital: portfolioCapital,
        },
      });
      setAuditEvents(await listAuditEvents(auditLimit));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Portfolio run failed");
    } finally {
      setLoading(false);
    }
  };

  const runBuilder = async () => {
    await runBacktestSafely(
      () =>
        runVwapBacktest({
          ...builderForm,
          symbol,
          timeframe,
          bars,
          include_series: true,
        }),
      "VWAP",
    );
  };

  const runAtr = async () => {
    await runBacktestSafely(
      () =>
        runAtrOrderBlockBacktest({
          symbol,
          timeframe,
          bars,
          include_series: true,
          trades_limit: 1000,
          ...atrForm,
          tp_levels: [
            [0.6, 0.3],
            [1.2, 0.4],
            [2.0, 0.3],
          ],
        }),
      "ATR Order Block",
    );
  };

  const runKnife = async () => {
    await runBacktestSafely(
      () =>
        runKnifeCatcherBacktest({
          symbol,
          timeframe,
          bars,
          ...knifeForm,
        }),
      "Knife Catcher",
    );
  };

  const runGrid = async () => {
    await runBacktestSafely(
      () =>
        runGridBotBacktest({
          symbol,
          timeframe,
          bars,
          include_series: true,
          trades_limit: 1000,
          ...gridForm,
        }),
      "Grid Bot",
    );
  };

  const runIntraday = async () => {
    await runBacktestSafely(
      () =>
        runIntradayMomentumBacktest({
          symbol,
          timeframe,
          bars,
          include_series: true,
          trades_limit: 1000,
          ...intradayForm,
        }),
      "Intraday Momentum",
    );
  };

  const runLiveSignal = async () => {
    if (liveExecutionForm.mode === "live" && liveExecutionForm.execute) {
      if (!liveExecutionForm.account_id) {
        setErrorMessage("Select account_id before executing in live mode");
        return;
      }
      const accepted = window.confirm(
        "Live execution can place real orders on exchange accounts. Confirm you understand this risk.",
      );
      if (!accepted) {
        return;
      }
    }

    const execution: SignalExecuteRequest = {
      mode: liveExecutionForm.mode,
      execute: liveExecutionForm.execute,
      account_id: liveExecutionForm.account_id,
      entry_usdt: liveExecutionForm.entry_usdt > 0 ? liveExecutionForm.entry_usdt : null,
      fee_pct: liveExecutionForm.fee_pct,
    };

    setLoading(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const result =
        activeLiveStrategy === "builder"
          ? await runBuilderLiveSignal({
              signal: {
                ...liveBuilderForm,
                symbol,
                timeframe,
                bars,
              },
              execution,
            })
          : await runAtrObLiveSignal({
              signal: {
                ...liveAtrObForm,
                symbol,
                timeframe,
                bars,
              },
              execution,
            });
      setLatestLiveSignal(result);
      const executionStatus =
        typeof result.execution?.status === "string" ? result.execution.status : "n/a";
      setInfoMessage(`Live signal computed. Execution status: ${executionStatus}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Live signal request failed");
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalysisRuns = async (limit = 50) => {
    setIsAnalysisLoading(true);
    try {
      const response = await listAnalysisRuns({ limit });
      const runs = response.runs ?? [];
      setAnalysisRuns(runs);
      setLatestAnalysisRun(runs[0] ?? null);
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const triggerAnalysisJob = async () => {
    setIsTriggeringAnalysis(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const trigger = await triggerAnalysisNow();
      setInfoMessage(trigger.message);
      await refreshAnalysisRuns();
      const maxAttempts = 12;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await wait(2500);
        const response = await listAnalysisRuns({ limit: 50 });
        const runs = response.runs ?? [];
        setAnalysisRuns(runs);
        setLatestAnalysisRun(runs[0] ?? null);
        const triggeredRun = runs.find((item) => item._id === trigger.jobId);
        if (triggeredRun && triggeredRun.status !== "running") {
          setInfoMessage(
            triggeredRun.status === "success"
              ? "AI analysis completed successfully"
              : `AI analysis failed${triggeredRun.error ? `: ${triggeredRun.error}` : ""}`,
          );
          break;
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to trigger AI analysis");
    } finally {
      setIsTriggeringAnalysis(false);
    }
  };

  const activeMeta = TAB_META[activeTab];
  const tradeCount = latestBacktest?.trades.length ?? 0;
  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-[1600px] p-3 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3 md:mb-6">
        <div className="flex items-center gap-2">
          <Button
            className="lg:hidden"
            variant="outline"
            size="icon"
            aria-label={isSidebarOpen ? "Close parameters menu" : "Open parameters menu"}
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            {isSidebarOpen ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {user?.email ? <Badge variant="outline">{user.email}</Badge> : null}
          <Badge variant={isLoading ? "outline" : "default"}>
            {isLoading ? "Loading..." : "Ready"}
          </Badge>
          <Badge variant="outline">API {health.status ?? "unknown"}</Badge>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {isSidebarOpen ? (
        <button
          className="fixed inset-0 z-30 bg-background/75 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr] lg:gap-6">
        <aside
          className={`z-20 space-y-4 rounded-xl border border-border/80 bg-card/90 p-3 shadow-sm transition lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-auto ${
            isSidebarOpen
              ? "fixed inset-y-0 left-0 w-[88vw] max-w-[360px] overflow-auto rounded-none border-r border-border/80 bg-card/95 pb-4 pt-20"
              : "pointer-events-none fixed inset-y-0 -left-full w-[88vw] max-w-[360px] overflow-auto rounded-none border-r border-border/80 bg-card/95 opacity-0 lg:pointer-events-auto lg:static lg:opacity-100"
          }`}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium">Parameters Panel</p>
            <p className="text-xs text-muted-foreground">
              Select market settings, switch tabs, and run scenarios.
            </p>
          </div>
          <Separator />

          <div className="space-y-2">
            <Label text="Sections" />
            <div className="grid grid-cols-2 gap-2">
              {DASHBOARD_TABS.map((tab) => (
                <Button
                  key={tab}
                  variant={tab === activeTab ? "default" : "outline"}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setActiveTab(tab as DashboardTab);
                    setIsSidebarOpen(false);
                  }}
                >
                  {TAB_META[tab as DashboardTab].title}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Market
            </p>
            <Label text="Symbol" />
            <select className={INPUT_CLASS} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(marketMeta?.symbols.length ? marketMeta.symbols : ["BTC/USDT"]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <Label text="Timeframe" />
            <select
              className={INPUT_CLASS}
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            >
              {(marketMeta?.timeframes.length ? marketMeta.timeframes : TIMEFRAMES).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <NumericField
              label="Bars"
              value={bars}
              onChange={(value) => setBars(value)}
              min={marketMeta?.minBars ?? 100}
              max={marketMeta?.maxBars ?? 20000}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Section Parameters
            </p>
            <SidebarTabQuickControls
              activeTab={activeTab}
              builderForm={builderForm}
              onBuilderFormChange={setBuilderForm}
              strategyList={strategyList}
              selectedStrategyId={selectedStrategyId}
              onSelectStrategy={setSelectedStrategyId}
              portfolioCapital={portfolioCapital}
              onPortfolioCapital={setPortfolioCapital}
              auditFilter={auditFilter}
              onAuditFilter={setAuditFilter}
              presetOptions={vwapPresetOptions}
              regimeOptions={vwapRegimeOptions}
              trendExtraction={latestTrendExtraction}
            />
          </div>

          <Separator />

          <div className="grid gap-2">
            <Button onClick={() => void runBuilder()}>Run Builder</Button>
            <Button variant="outline" onClick={() => void runSavedStrategy()}>
              Run Saved Strategy
            </Button>
            <Button variant="outline" onClick={() => void runPortfolio()}>
              Run Portfolio
            </Button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Card className={CARD_CLASS}>
              <CardHeader className="space-y-1 px-3 py-3 md:px-6 md:py-4">
                <CardDescription className="text-sm">Last price</CardDescription>
                <CardTitle className="text-xl md:text-2xl">${lastPrice.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>

            <Card className={CARD_CLASS}>
              <CardHeader className="space-y-1 px-3 py-3 md:px-6 md:py-4">
                <CardDescription className="text-sm">Active market</CardDescription>
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                  <BarChart3 className="h-5 w-5" />
                  {symbol}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 text-base text-muted-foreground md:px-6 md:pb-4">
                {timeframe}
              </CardContent>
            </Card>

            <Card className={CARD_CLASS}>
              <CardHeader className="space-y-1 px-3 py-3 md:px-6 md:py-4">
                <CardDescription className="text-sm">Backtest trades</CardDescription>
                <CardTitle className="text-xl md:text-2xl">{tradeCount.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 text-base text-muted-foreground md:px-6 md:pb-4">
                Latest run
              </CardContent>
            </Card>

            <Card className={CARD_CLASS}>
              <CardHeader className="space-y-1 px-3 py-3 md:px-6 md:py-4">
                <CardDescription className="text-sm">Active section</CardDescription>
                <CardTitle className="text-xl md:text-2xl">{activeMeta.title}</CardTitle>
              </CardHeader>
              <CardContent className="line-clamp-2 px-3 pb-3 pt-0 text-base text-muted-foreground md:px-6 md:pb-4">
                {activeMeta.description}
              </CardContent>
            </Card>
          </div>

          <Card className={CARD_CLASS}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Chart & Analytics</CardTitle>
              <CardDescription>
                Candlestick chart with overlays and trade markers ({symbol}, {timeframe})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-muted/25 p-2 md:p-4">
                <MarketChart candles={candles} overlays={overlays} markers={chartMarkers} />
              </div>
              <p className="text-xs text-muted-foreground md:text-sm">
                Tip: switch sections on the left to run scenarios quickly and compare results on the same chart.
              </p>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">{activeMeta.title}</CardTitle>
              <CardDescription>{activeMeta.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage ? (
                <p className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}
              {infoMessage ? (
                <p className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {infoMessage}
                </p>
              ) : null}
              {activeTab === "builder" ? (
                <BuilderTab
                  presetOptions={vwapPresetOptions}
                  regimeOptions={vwapRegimeOptions}
                  indicatorOptions={vwapIndicatorOptions}
                  builderForm={builderForm}
                  onBuilderFormChange={setBuilderForm}
                  onRun={runBuilder}
                  builderName={builderName}
                  onBuilderNameChange={setBuilderName}
                  onSave={handleSaveBuilderStrategy}
                  auditReason={builderAuditReason}
                  onAuditReasonChange={setBuilderAuditReason}
                  kpiRows={kpiRows}
                  latestBacktest={latestBacktest}
                  trendExtraction={latestTrendExtraction}
                  analysisStructured={latestAnalysisRun?.analysisStructured ?? null}
                />
              ) : null}
              {activeTab === "strategies" ? (
                <StrategiesTab
                  catalog={catalog}
                  isCatalogLoading={isCatalogLoading}
                  strategyList={strategyList}
                  selectedStrategyId={selectedStrategyId}
                  onSelectStrategy={setSelectedStrategyId}
                  onDelete={handleDeleteStrategy}
                  onRunSaved={runSavedStrategy}
                  atrForm={atrForm}
                  knifeForm={knifeForm}
                  gridForm={gridForm}
                  intradayForm={intradayForm}
                  onAtrFormChange={setAtrForm}
                  onKnifeFormChange={setKnifeForm}
                  onGridFormChange={setGridForm}
                  onIntradayFormChange={setIntradayForm}
                  onRunAtr={runAtr}
                  onRunKnife={runKnife}
                  onRunGrid={runGrid}
                  onRunIntraday={runIntraday}
                  latestBacktest={latestBacktest}
                />
              ) : null}
              {activeTab === "live" ? (
                <LiveSignalsTab
                  activeStrategy={activeLiveStrategy}
                  onStrategyChange={setActiveLiveStrategy}
                  builderSignal={liveBuilderForm}
                  onBuilderSignalChange={setLiveBuilderForm}
                  atrObSignal={liveAtrObForm}
                  onAtrObSignalChange={setLiveAtrObForm}
                  execution={liveExecutionForm}
                  onExecutionChange={setLiveExecutionForm}
                  exchangeAccounts={exchangeAccounts}
                  latestSignal={latestLiveSignal}
                  onRun={runLiveSignal}
                  indicatorOptions={vwapIndicatorOptions}
                  trendExtraction={latestTrendExtraction}
                  analysisStructured={latestAnalysisRun?.analysisStructured ?? null}
                />
              ) : null}
              {activeTab === "analysis" ? (
                <AnalysisTab
                  runs={analysisRuns}
                  selectedRun={selectedAnalysisRun}
                  selectedRunId={selectedAnalysisId}
                  isLoading={isAnalysisLoading}
                  isTriggering={isTriggeringAnalysis}
                  onSelectRun={setSelectedAnalysisId}
                  onRefresh={() => void refreshAnalysisRuns()}
                  onTrigger={() => void triggerAnalysisJob()}
                />
              ) : null}
              {activeTab === "portfolio" ? (
                <PortfolioTab
                  strategyList={strategyList}
                  selection={portfolioSelection}
                  onSelection={setPortfolioSelection}
                  weights={portfolioWeights}
                  onWeights={setPortfolioWeights}
                  capital={portfolioCapital}
                  onCapital={setPortfolioCapital}
                  asyncJob={portfolioAsyncJob}
                  onAsyncJob={setPortfolioAsyncJob}
                  onRun={runPortfolio}
                  latestPortfolio={latestPortfolio}
                  catalog={catalog}
                />
              ) : null}
              {activeTab === "audit" ? (
                <AuditTab
                  auditMeta={auditMeta}
                  auditEvents={filteredAudit}
                  auditFilter={auditFilter}
                  onAuditFilter={setAuditFilter}
                />
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function SidebarTabQuickControls({
  activeTab,
  builderForm,
  onBuilderFormChange,
  strategyList,
  selectedStrategyId,
  onSelectStrategy,
  portfolioCapital,
  onPortfolioCapital,
  auditFilter,
  onAuditFilter,
  presetOptions,
  regimeOptions,
  trendExtraction,
}: {
  activeTab: DashboardTab;
  builderForm: VwapBacktestRequest;
  onBuilderFormChange: (value: VwapBacktestRequest) => void;
  strategyList: StrategyRead[];
  selectedStrategyId: number | null;
  onSelectStrategy: (id: number | null) => void;
  portfolioCapital: number;
  onPortfolioCapital: (value: number) => void;
  auditFilter: string;
  onAuditFilter: (value: string) => void;
  presetOptions: string[];
  regimeOptions: string[];
  trendExtraction: AnalysisTrendExtraction | null;
}) {
  if (activeTab === "builder") {
    return (
      <div className="space-y-3">
        <Field
          label="Preset"
          value={builderForm.preset}
          onChange={(value) =>
            onBuilderFormChange({
              ...builderForm,
              preset: value as VwapBacktestRequest["preset"],
            })
          }
          options={presetOptions}
        />
        <Field
          label="Trend"
          value={builderForm.regime}
          onChange={(value) =>
            onBuilderFormChange({
              ...builderForm,
              regime: value as VwapBacktestRequest["regime"],
            })
          }
          options={regimeOptions}
        />
        <AiTrendHint trendExtraction={trendExtraction} compact />
      </div>
    );
  }

  if (activeTab === "strategies") {
    return (
      <div className="space-y-1">
        <Label text="Saved Strategy" />
        <select
          className={INPUT_CLASS}
          value={selectedStrategyId ?? ""}
          onChange={(event) =>
            onSelectStrategy(event.target.value ? Number(event.target.value) : null)
          }
        >
          <option value="">Select strategy</option>
          {strategyList.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (activeTab === "portfolio") {
    return (
      <NumericField
        label="Portfolio Capital"
        value={portfolioCapital}
        onChange={onPortfolioCapital}
      />
    );
  }

  if (activeTab === "live") {
    return <p className="text-xs text-muted-foreground">Configure signal and execution in the main panel.</p>;
  }

  if (activeTab === "analysis") {
    return <p className="text-xs text-muted-foreground">Browse runs and trigger analysis in the main panel.</p>;
  }

  return (
    <TextField label="Audit search" value={auditFilter} onChange={onAuditFilter} />
  );
}

function BuilderTab({
  presetOptions,
  regimeOptions,
  indicatorOptions,
  builderForm,
  onBuilderFormChange,
  onRun,
  builderName,
  onBuilderNameChange,
  onSave,
  auditReason,
  onAuditReasonChange,
  kpiRows,
  latestBacktest,
  trendExtraction,
  analysisStructured,
}: {
  presetOptions: string[];
  regimeOptions: string[];
  indicatorOptions: string[];
  builderForm: VwapBacktestRequest;
  onBuilderFormChange: (value: VwapBacktestRequest) => void;
  onRun: () => Promise<void>;
  builderName: string;
  onBuilderNameChange: (value: string) => void;
  onSave: () => Promise<void>;
  auditReason: string;
  onAuditReasonChange: (value: string) => void;
  kpiRows: Array<{ label: string; value: string }>;
  latestBacktest: BacktestResponse | null;
  trendExtraction: AnalysisTrendExtraction | null;
  analysisStructured: JsonRecord | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Preset"
          value={builderForm.preset}
          onChange={(value) =>
            onBuilderFormChange({
              ...builderForm,
              preset: value as VwapBacktestRequest["preset"],
            })
          }
          options={presetOptions}
        />
        <Field
          label="Trend"
          value={builderForm.regime}
          onChange={(value) =>
            onBuilderFormChange({
              ...builderForm,
              regime: value as VwapBacktestRequest["regime"],
            })
          }
          options={regimeOptions}
        />
        <div className="md:col-span-2 lg:col-span-2">
          <AiTrendHint trendExtraction={trendExtraction} compact />
        </div>
        <NumericField
          label="RR"
          value={builderForm.rr}
          onChange={(value) => onBuilderFormChange({ ...builderForm, rr: value })}
        />
        <NumericField
          label="ATR Mult"
          value={builderForm.atr_mult}
          onChange={(value) => onBuilderFormChange({ ...builderForm, atr_mult: value })}
        />
        <NumericField
          label="Cooldown Bars"
          value={builderForm.cooldown_bars}
          onChange={(value) => onBuilderFormChange({ ...builderForm, cooldown_bars: value })}
        />
        <NumericField
          label="Account Balance"
          value={builderForm.account_balance}
          onChange={(value) => onBuilderFormChange({ ...builderForm, account_balance: value })}
        />
        <NumericField
          label="Risk %"
          value={builderForm.risk_per_trade}
          onChange={(value) => onBuilderFormChange({ ...builderForm, risk_per_trade: value })}
        />
        <NumericField
          label="Max Positions"
          value={builderForm.max_positions}
          onChange={(value) => onBuilderFormChange({ ...builderForm, max_positions: value })}
        />
        <NumericField
          label="Max Position %"
          value={builderForm.max_position_pct}
          onChange={(value) => onBuilderFormChange({ ...builderForm, max_position_pct: value })}
        />
        <Field
          label="Stop Mode"
          value={builderForm.stop_mode}
          onChange={(value) =>
            onBuilderFormChange({
              ...builderForm,
              stop_mode: value as VwapBacktestRequest["stop_mode"],
            })
          }
          options={["ATR", "Swing", "Order Block (ATR-OB)"]}
        />
        <NumericField
          label="Swing Lookback"
          value={builderForm.swing_lookback}
          onChange={(value) => onBuilderFormChange({ ...builderForm, swing_lookback: value })}
        />
        <NumericField
          label="Swing Buffer ATR"
          value={builderForm.swing_buffer_atr}
          onChange={(value) => onBuilderFormChange({ ...builderForm, swing_buffer_atr: value })}
        />
        <NumericField
          label="OB Impulse ATR"
          value={builderForm.ob_impulse_atr}
          onChange={(value) => onBuilderFormChange({ ...builderForm, ob_impulse_atr: value })}
        />
        <NumericField
          label="OB Buffer ATR"
          value={builderForm.ob_buffer_atr}
          onChange={(value) => onBuilderFormChange({ ...builderForm, ob_buffer_atr: value })}
        />
        <NumericField
          label="OB Lookback"
          value={builderForm.ob_lookback}
          onChange={(value) => onBuilderFormChange({ ...builderForm, ob_lookback: value })}
        />
      </div>

      <AiLevelsHint trendExtraction={trendExtraction} analysisStructured={analysisStructured} />

      <div className="space-y-2">
        <Label text="Enabled indicators" />
        <div className="grid gap-2 md:grid-cols-3">
          {indicatorOptions.map((indicator) => {
            const checked = builderForm.enabled?.includes(indicator) ?? false;
            return (
              <label key={indicator} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const prev = new Set(builderForm.enabled ?? []);
                    if (event.target.checked) {
                      prev.add(indicator);
                    } else {
                      prev.delete(indicator);
                    }
                    onBuilderFormChange({ ...builderForm, enabled: Array.from(prev) });
                  }}
                />
                {indicator}
              </label>
            );
          })}
        </div>
      </div>
      <Separator />
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Strategy Name" value={builderName} onChange={onBuilderNameChange} />
        <TextField label="Audit Reason" value={auditReason} onChange={onAuditReasonChange} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void onRun()}>Run VWAP Backtest</Button>
        <Button variant="outline" onClick={() => void onSave()}>
          Save Strategy
        </Button>
      </div>
      <KpiGrid rows={kpiRows} />
      <TradesTable trades={latestBacktest?.trades ?? []} />
    </div>
  );
}

function StrategiesTab({
  catalog,
  isCatalogLoading,
  strategyList,
  selectedStrategyId,
  onSelectStrategy,
  onDelete,
  onRunSaved,
  atrForm,
  knifeForm,
  gridForm,
  intradayForm,
  onAtrFormChange,
  onKnifeFormChange,
  onGridFormChange,
  onIntradayFormChange,
  onRunAtr,
  onRunKnife,
  onRunGrid,
  onRunIntraday,
  latestBacktest,
}: {
  catalog: BacktestCatalogResponse | null;
  isCatalogLoading: boolean;
  strategyList: StrategyRead[];
  selectedStrategyId: number | null;
  onSelectStrategy: (id: number | null) => void;
  onDelete: () => Promise<void>;
  onRunSaved: () => Promise<void>;
  atrForm: AtrStrategyFormState;
  knifeForm: KnifeStrategyFormState;
  gridForm: GridStrategyFormState;
  intradayForm: IntradayStrategyFormState;
  onAtrFormChange: (value: AtrStrategyFormState) => void;
  onKnifeFormChange: (value: KnifeStrategyFormState) => void;
  onGridFormChange: (value: GridStrategyFormState) => void;
  onIntradayFormChange: (value: IntradayStrategyFormState) => void;
  onRunAtr: () => Promise<void>;
  onRunKnife: () => Promise<void>;
  onRunGrid: () => Promise<void>;
  onRunIntraday: () => Promise<void>;
  latestBacktest: BacktestResponse | null;
}) {
  const [activeBuiltInStrategy, setActiveBuiltInStrategy] = useState<BuiltInStrategyKey>("atr");
  const builtInStrategyItems = useMemo(() => {
    const labels = catalog?.portfolio.builtin_strategies ?? [];
    const seen = new Set<BuiltInStrategyKey>();
    return labels
      .map((label) => {
        const key = mapBuiltinStrategyLabelToKey(label);
        if (!key || seen.has(key)) {
          return null;
        }
        seen.add(key);
        return { key, label };
      })
      .filter((item): item is { key: BuiltInStrategyKey; label: string } => item !== null);
  }, [catalog?.portfolio.builtin_strategies]);

  const activeBuiltInStrategyKey = builtInStrategyItems.some((item) => item.key === activeBuiltInStrategy)
    ? activeBuiltInStrategy
    : (builtInStrategyItems[0]?.key ?? null);

  const knifeSideOptions = catalog?.knife_catcher.sides?.length
    ? catalog.knife_catcher.sides
    : [knifeForm.side];
  const knifeEntryModeLongOptions = catalog?.knife_catcher.entry_mode_long?.length
    ? catalog.knife_catcher.entry_mode_long
    : [knifeForm.entry_mode_long];
  const knifeEntryModeShortOptions = catalog?.knife_catcher.entry_mode_short?.length
    ? catalog.knife_catcher.entry_mode_short
    : [knifeForm.entry_mode_short];
  const intradaySideOptions = catalog?.intraday_momentum.sides?.length
    ? catalog.intraday_momentum.sides
    : [intradayForm.side];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Label text="Saved Strategies" />
        <select
          className={INPUT_CLASS}
          value={selectedStrategyId ?? ""}
          onChange={(event) =>
            onSelectStrategy(event.target.value ? Number(event.target.value) : null)
          }
        >
          <option value="">Select strategy</option>
          {strategyList.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void onRunSaved()}>Run Saved Strategy</Button>
        <Button variant="outline" onClick={() => void onDelete()}>
          Delete Saved Strategy
        </Button>
      </div>
      <Separator />
      {isCatalogLoading ? (
        <StrategiesCatalogSkeleton />
      ) : (
        <>
          <div className="space-y-3">
            <Label text="Built-in strategies" />
            <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-muted/15 p-2">
              {builtInStrategyItems.map((strategy) => (
                <Button
                  key={strategy.key}
                  size="sm"
                  variant={activeBuiltInStrategyKey === strategy.key ? "default" : "outline"}
                  onClick={() => setActiveBuiltInStrategy(strategy.key)}
                >
                  {strategy.label}
                </Button>
              ))}
              {builtInStrategyItems.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  No built-in strategies returned by backend catalog.
                </p>
              ) : null}
            </div>
          </div>

          {activeBuiltInStrategyKey === "atr" ? (
            <AtrStrategyForm value={atrForm} onChange={onAtrFormChange} onRun={onRunAtr} />
          ) : null}
          {activeBuiltInStrategyKey === "knife" ? (
            <KnifeStrategyForm
              value={knifeForm}
              onChange={onKnifeFormChange}
              onRun={onRunKnife}
              sideOptions={knifeSideOptions}
              entryModeLongOptions={knifeEntryModeLongOptions}
              entryModeShortOptions={knifeEntryModeShortOptions}
            />
          ) : null}
          {activeBuiltInStrategyKey === "grid" ? (
            <GridStrategyForm value={gridForm} onChange={onGridFormChange} onRun={onRunGrid} />
          ) : null}
          {activeBuiltInStrategyKey === "intraday" ? (
            <IntradayStrategyForm
              value={intradayForm}
              onChange={onIntradayFormChange}
              onRun={onRunIntraday}
              sideOptions={intradaySideOptions}
            />
          ) : null}
        </>
      )}

      <TradesTable trades={latestBacktest?.trades ?? []} />
    </div>
  );
}

function StrategiesCatalogSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="rounded-lg border border-border/70 bg-muted/15 p-2">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function LiveSignalsTab({
  activeStrategy,
  onStrategyChange,
  builderSignal,
  onBuilderSignalChange,
  atrObSignal,
  onAtrObSignalChange,
  execution,
  onExecutionChange,
  exchangeAccounts,
  latestSignal,
  onRun,
  indicatorOptions,
  trendExtraction,
  analysisStructured,
}: {
  activeStrategy: LiveStrategyKey;
  onStrategyChange: (value: LiveStrategyKey) => void;
  builderSignal: BuilderSignalRequest;
  onBuilderSignalChange: (value: BuilderSignalRequest) => void;
  atrObSignal: AtrObSignalRequest;
  onAtrObSignalChange: (value: AtrObSignalRequest) => void;
  execution: LiveExecutionFormState;
  onExecutionChange: (value: LiveExecutionFormState) => void;
  exchangeAccounts: ExchangeAccountRead[];
  latestSignal: LiveSignalResult | null;
  onRun: () => Promise<void>;
  indicatorOptions: string[];
  trendExtraction: AnalysisTrendExtraction | null;
  analysisStructured: JsonRecord | null;
}) {
  const executionStatus =
    typeof latestSignal?.execution?.status === "string" ? latestSignal.execution.status : "unknown";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label text="Strategy" />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeStrategy === "builder" ? "default" : "outline"}
            onClick={() => onStrategyChange("builder")}
          >
            Builder
          </Button>
          <Button
            size="sm"
            variant={activeStrategy === "atr_ob" ? "default" : "outline"}
            onClick={() => onStrategyChange("atr_ob")}
          >
            ATR-OB
          </Button>
        </div>
      </div>

      {activeStrategy === "builder" ? (
        <div className="space-y-4 rounded-lg border border-border/70 bg-muted/10 p-3">
          <p className="text-sm font-medium">Builder signal params</p>
          <div className="grid gap-3 md:grid-cols-4">
            <Field
              label="Regime"
              value={builderSignal.regime}
              options={["Bull", "Flat", "Bear"]}
              onChange={(value) =>
                onBuilderSignalChange({
                  ...builderSignal,
                  regime: value as BuilderSignalRequest["regime"],
                })
              }
            />
            <div className="md:col-span-3">
              <AiTrendHint trendExtraction={trendExtraction} compact />
            </div>
            <Field
              label="Stop mode"
              value={builderSignal.stop_mode}
              options={["ATR", "Swing", "Order Block (ATR-OB)"]}
              onChange={(value) =>
                onBuilderSignalChange({
                  ...builderSignal,
                  stop_mode: value as BuilderSignalRequest["stop_mode"],
                })
              }
            />
            <NumericField
              label="RR"
              value={builderSignal.rr}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, rr: value })}
            />
            <NumericField
              label="ATR Mult"
              value={builderSignal.atr_mult}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, atr_mult: value })}
            />
            <NumericField
              label="Account Balance"
              value={builderSignal.account_balance}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, account_balance: value })}
            />
            <NumericField
              label="Risk %"
              value={builderSignal.risk_per_trade}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, risk_per_trade: value })}
            />
            <NumericField
              label="Max Positions"
              value={builderSignal.max_positions}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, max_positions: value })}
            />
            <NumericField
              label="Max Position %"
              value={builderSignal.max_position_pct}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, max_position_pct: value })}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <NumericField
              label="Swing Lookback"
              value={builderSignal.swing_lookback}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, swing_lookback: value })}
            />
            <NumericField
              label="Swing Buffer ATR"
              value={builderSignal.swing_buffer_atr}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, swing_buffer_atr: value })}
            />
            <NumericField
              label="OB Impulse ATR"
              value={builderSignal.ob_impulse_atr}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, ob_impulse_atr: value })}
            />
            <NumericField
              label="OB Buffer ATR"
              value={builderSignal.ob_buffer_atr}
              onChange={(value) => onBuilderSignalChange({ ...builderSignal, ob_buffer_atr: value })}
            />
          </div>
          <div className="space-y-2">
            <Label text="Enabled indicators" />
            <div className="grid gap-2 md:grid-cols-3">
              {indicatorOptions.map((indicator) => {
                const checked = builderSignal.enabled?.includes(indicator) ?? false;
                return (
                  <label key={indicator} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = new Set(builderSignal.enabled ?? []);
                        if (event.target.checked) {
                          next.add(indicator);
                        } else {
                          next.delete(indicator);
                        }
                        onBuilderSignalChange({ ...builderSignal, enabled: Array.from(next) });
                      }}
                    />
                    {indicator}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border/70 bg-muted/10 p-3">
          <p className="text-sm font-medium">ATR-OB signal params</p>
          <div className="grid gap-3 md:grid-cols-5">
            <NumericField
              label="EMA"
              value={atrObSignal.ema_period}
              onChange={(value) => onAtrObSignalChange({ ...atrObSignal, ema_period: value })}
            />
            <NumericField
              label="ATR Period"
              value={atrObSignal.atr_period}
              onChange={(value) => onAtrObSignalChange({ ...atrObSignal, atr_period: value })}
            />
            <NumericField
              label="Impulse ATR"
              value={atrObSignal.impulse_atr}
              onChange={(value) => onAtrObSignalChange({ ...atrObSignal, impulse_atr: value })}
            />
            <NumericField
              label="OB Buffer ATR"
              value={atrObSignal.ob_buffer_atr}
              onChange={(value) => onAtrObSignalChange({ ...atrObSignal, ob_buffer_atr: value })}
            />
            <NumericField
              label="Allocation USDT"
              value={atrObSignal.allocation_usdt}
              onChange={(value) => onAtrObSignalChange({ ...atrObSignal, allocation_usdt: value })}
            />
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border/70 bg-muted/10 p-3">
        <p className="text-sm font-medium">Execution settings</p>
        <div className="grid gap-3 md:grid-cols-5">
          <Field
            label="Mode"
            value={execution.mode}
            options={["dry_run", "paper", "live"]}
            onChange={(value) =>
              onExecutionChange({
                ...execution,
                mode: value as SignalExecuteRequest["mode"],
              })
            }
          />
          <NumericField
            label="Entry USDT"
            value={execution.entry_usdt}
            onChange={(value) => onExecutionChange({ ...execution, entry_usdt: value })}
          />
          <NumericField
            label="Fee %"
            value={execution.fee_pct}
            onChange={(value) => onExecutionChange({ ...execution, fee_pct: value })}
          />
          <div className="space-y-1">
            <Label text="Account" />
            <select
              className={INPUT_CLASS}
              value={execution.account_id ?? ""}
              onChange={(event) =>
                onExecutionChange({
                  ...execution,
                  account_id: event.target.value ? Number(event.target.value) : null,
                })
              }
            >
              <option value="">No account</option>
              {exchangeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_label} / {account.exchange_name} / {account.mode}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input
              type="checkbox"
              checked={execution.execute}
              onChange={(event) => onExecutionChange({ ...execution, execute: event.target.checked })}
            />
            Execute
          </label>
        </div>
        {execution.mode === "live" ? (
          <p className="rounded-md border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Live mode can send real orders. Account selection and explicit confirmation are required.
          </p>
        ) : null}
        <Button onClick={() => void onRun()}>Run Live Signal</Button>
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Signal Result</p>
          <Badge variant="outline">execution: {executionStatus}</Badge>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <p>
            has_signal: <span className="font-medium">{String(latestSignal?.has_signal ?? false)}</span>
          </p>
          <p>
            side: <span className="font-medium">{latestSignal?.side ?? "-"}</span>
          </p>
          <p>
            entry: <span className="font-medium">{formatCellValue(latestSignal?.entry)}</span>
          </p>
          <p>
            sl/tp:{" "}
            <span className="font-medium">
              {formatCellValue(latestSignal?.sl)} / {formatCellValue(latestSignal?.tp)}
            </span>
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <JsonBlock title="Reasons" data={{ reasons: latestSignal?.reasons ?? [] }} />
          <JsonBlock title="Stop Explain" data={(latestSignal?.sl_explain ?? null) as JsonRecord | null} />
          <JsonBlock title="Execution" data={(latestSignal?.execution ?? null) as JsonRecord | null} />
        </div>
        <AiLevelsHint trendExtraction={trendExtraction} analysisStructured={analysisStructured} />
      </div>
    </div>
  );
}

function AiTrendHint({
  trendExtraction,
  compact = false,
}: {
  trendExtraction: AnalysisTrendExtraction | null;
  compact?: boolean;
}) {
  const scenarios = toScenarioRows(trendExtraction);
  if (!scenarios.length) {
    return <p className="text-xs text-muted-foreground">No AI regime probabilities yet.</p>;
  }

  return (
    <div className={`rounded-md border border-border/70 bg-muted/20 p-2 ${compact ? "" : "space-y-2"}`}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI trend confidence</p>
        <Badge variant="ai">AI</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((item) => (
          <Badge key={item.key} variant="outline" className="gap-2">
            <span className="capitalize">{item.label}</span>
            <span className="font-semibold">{item.probabilityPct}%</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function AiLevelsHint({
  trendExtraction,
  analysisStructured,
}: {
  trendExtraction: AnalysisTrendExtraction | null;
  analysisStructured: JsonRecord | null;
}) {
  const scenarios = toScenarioRows(trendExtraction);
  const currentPrice = Number((analysisStructured?.currentPrice as number | undefined) ?? NaN);
  const hasCurrentPrice = Number.isFinite(currentPrice);

  if (!scenarios.length && !hasCurrentPrice) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border border-violet-400/30 bg-violet-500/8 p-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">AI price levels</p>
        <Badge variant="ai">AI</Badge>
      </div>
      {hasCurrentPrice ? (
        <p className="text-sm text-muted-foreground">
          Current price: <span className="font-semibold text-foreground">{formatCellValue(currentPrice)}</span>
        </p>
      ) : null}
      <div className="grid gap-2 md:grid-cols-3">
        {scenarios.map((item) => (
          <div key={item.key} className="rounded-md border border-border/70 bg-background/30 p-2 text-sm">
            <p className="mb-1 font-medium capitalize">{item.label}</p>
            <p className="text-muted-foreground">
              TP: <span className="font-semibold text-foreground">{formatCellValue(item.takeProfit)}</span>
            </p>
            <p className="text-muted-foreground">
              SL: <span className="font-semibold text-foreground">{formatCellValue(item.stopLoss)}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisTab({
  runs,
  selectedRun,
  selectedRunId,
  isLoading,
  isTriggering,
  onSelectRun,
  onRefresh,
  onTrigger,
}: {
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  selectedRunId: string | null;
  isLoading: boolean;
  isTriggering: boolean;
  onSelectRun: (id: string) => void;
  onRefresh: () => void;
  onTrigger: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-3">
        <div>
          <p className="text-sm font-medium">AI analysis history</p>
          <p className="text-xs text-muted-foreground">Manual and cron runs sorted by latest trigger time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading || isTriggering}>
            Refresh
          </Button>
          <Button size="sm" onClick={onTrigger} disabled={isTriggering}>
            {isTriggering ? "Starting..." : "Run AI analysis now"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <div className="max-h-[620px] space-y-2 overflow-auto rounded-md border border-border/70 bg-muted/10 p-2">
          {runs.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No analysis runs yet.</p>
          ) : (
            runs.map((run) => {
              const active = selectedRunId === run._id;
              return (
                <button
                  key={run._id}
                  type="button"
                  onClick={() => onSelectRun(run._id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                    active
                      ? "border-violet-400/50 bg-violet-500/12"
                      : "border-border/70 bg-background/35 hover:bg-muted/30"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{run.symbol}</p>
                    <AnalysisStatusBadge status={run.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {run.source} / {run.sessionType}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(run.triggeredAt)}</p>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3">
          {selectedRun ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{selectedRun.symbol}</p>
                <AnalysisStatusBadge status={selectedRun.status} />
                <Badge variant="outline">{selectedRun.source}</Badge>
                <Badge variant="outline">{selectedRun.sessionType}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Triggered: {formatTimestamp(selectedRun.triggeredAt)} | Completed:{" "}
                {selectedRun.completedAt ? formatTimestamp(selectedRun.completedAt) : "-"}
              </p>

              {selectedRun.error ? (
                <p className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {selectedRun.error}
                </p>
              ) : null}

              <AiTrendHint trendExtraction={selectedRun.trendExtraction ?? null} />
              <AiLevelsHint
                trendExtraction={selectedRun.trendExtraction ?? null}
                analysisStructured={(selectedRun.analysisStructured as JsonRecord | null) ?? null}
              />

              <div className="space-y-1">
                <Label text="Report" />
                <AnalysisReport markdown={selectedRun.analysisReport ?? ""} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a run to inspect details.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioTab({
  strategyList,
  selection,
  onSelection,
  weights,
  onWeights,
  capital,
  onCapital,
  asyncJob,
  onAsyncJob,
  onRun,
  latestPortfolio,
  catalog,
}: {
  strategyList: StrategyRead[];
  selection: number[];
  onSelection: (value: number[]) => void;
  weights: Record<number, number>;
  onWeights: (value: Record<number, number>) => void;
  capital: number;
  onCapital: (value: number) => void;
  asyncJob: boolean;
  onAsyncJob: (value: boolean) => void;
  onRun: () => Promise<void>;
  latestPortfolio: JsonRecord | null;
  catalog: BacktestCatalogResponse | null;
}) {
  const selectedTotalWeight = selection.reduce((sum, strategyId) => {
    return sum + Math.max(0, Number(weights[strategyId] ?? 0));
  }, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Available built-ins: {catalog?.portfolio.builtin_strategies.join(", ") ?? "n/a"}
      </p>
      <p className="text-xs text-muted-foreground">
        Weight sum: {selectedTotalWeight.toFixed(2)}. Backend payload is normalized to 100%.
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        {strategyList.map((strategy) => {
          const checked = selection.includes(strategy.id);
          return (
            <label key={strategy.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const next = new Set(selection);
                  if (event.target.checked) {
                    next.add(strategy.id);
                  } else {
                    next.delete(strategy.id);
                  }
                  onSelection(Array.from(next));
                }}
              />
              {strategy.name}
            </label>
          );
        })}
      </div>
      {selection.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {strategyList
            .filter((strategy) => selection.includes(strategy.id))
            .map((strategy) => (
              <NumericField
                key={strategy.id}
                label={`Weight: ${strategy.name}`}
                value={Number(weights[strategy.id] ?? 0)}
                onChange={(value) =>
                  onWeights({
                    ...weights,
                    [strategy.id]: value,
                  })
                }
                min={0}
                step={0.1}
              />
            ))}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <NumericField label="Total Capital" value={capital} onChange={onCapital} />
        <label className="flex items-center gap-2 pt-7 text-sm">
          <input
            type="checkbox"
            checked={asyncJob}
            onChange={(event) => onAsyncJob(event.target.checked)}
          />
          Async Job
        </label>
      </div>
      <Button onClick={() => void onRun()}>
        <Wallet className="mr-2 h-4 w-4" />
        Run Portfolio Backtest
      </Button>
      <JsonBlock title="Portfolio Result" data={latestPortfolio} />
    </div>
  );
}

function AuditTab({
  auditMeta,
  auditEvents,
  auditFilter,
  onAuditFilter,
}: {
  auditMeta: AuditMetaResponse | null;
  auditEvents: AuditLogRead[];
  auditFilter: string;
  onAuditFilter: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Suggested events: {auditMeta?.suggested_events.join(", ") ?? "n/a"}
      </p>
      <TextField label="Audit search" value={auditFilter} onChange={onAuditFilter} />
      <div className="max-h-80 overflow-auto overscroll-contain rounded-md border border-border/70 bg-background/35">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((event) => (
              <tr key={event.id} className="border-b">
                <td className="px-3 py-2">{new Date(event.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{event.actor ?? "-"}</td>
                <td className="px-3 py-2">{event.event}</td>
                <td className="px-3 py-2">{event.reason ?? "-"}</td>
              </tr>
            ))}
            {auditEvents.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-muted-foreground" colSpan={4}>
                  No events found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Separator />
    </div>
  );
}

function KpiGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Run any backtest to populate KPIs and trade analytics.
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {rows.slice(0, 12).map((row) => (
        <Card key={row.label}>
          <CardHeader className="pb-2">
            <CardDescription>{row.label}</CardDescription>
            <CardTitle className={`text-base ${formatKpiToneClass(row.label, row.value)}`}>
              {row.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function TradesTable({ trades }: { trades: JsonRecord[] }) {
  if (trades.length === 0) {
    return <p className="text-sm text-muted-foreground">No trades to display.</p>;
  }
  const headers = Object.keys(trades[0]).slice(0, 8);
  return (
    <div className="max-h-96 overflow-auto overscroll-contain rounded-md border border-border/70 bg-background/35">
      <table className="w-full min-w-[640px] text-xs md:text-sm">
        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
          <tr className="border-b text-left">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.slice(0, 200).map((trade, rowIndex) => (
            <tr key={String(trade.id ?? rowIndex)} className="border-b">
              {headers.map((header) => (
                <td key={`${rowIndex}-${header}`} className="px-3 py-2">
                  {renderTradeCellValue(header, trade[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JsonBlock({ title, data }: { title: string; data: JsonRecord | null }) {
  return (
    <div className="space-y-1">
      <Label text={title} />
      <pre className="max-h-56 overflow-auto overscroll-contain rounded-md border border-border/70 bg-muted/25 p-3 text-[11px] md:text-xs">
        {data ? JSON.stringify(data, null, 2) : "No data"}
      </pre>
    </div>
  );
}

function AnalysisStatusBadge({ status }: { status: AnalysisRun["status"] }) {
  if (status === "success") {
    return <Badge className="bg-emerald-500/15 text-emerald-200">success</Badge>;
  }
  if (status === "failed") {
    return <Badge className="bg-red-500/15 text-red-200">failed</Badge>;
  }
  return <Badge className="bg-amber-500/15 text-amber-200">running</Badge>;
}

function toScenarioRows(trendExtraction: AnalysisTrendExtraction | null) {
  if (!trendExtraction) {
    return [];
  }
  const rows: Array<{
    key: "bull" | "bear" | "flat";
    label: "bull" | "bear" | "flat";
    probabilityPct: number;
    takeProfit: number | null;
    stopLoss: number | null;
  }> = [];
  const order: Array<"bull" | "flat" | "bear"> = ["bull", "flat", "bear"];
  for (const key of order) {
    const scenario = trendExtraction[key];
    if (!scenario || typeof scenario.probabilityPct !== "number") {
      continue;
    }
    rows.push({
      key,
      label: key,
      probabilityPct: scenario.probabilityPct,
      takeProfit: scenario.takeProfit,
      stopLoss: scenario.stopLoss,
    });
  }
  return rows;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

async function wait(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getPreferredRegime(
  trendExtraction: AnalysisTrendExtraction | null,
): VwapBacktestRequest["regime"] | BuilderSignalRequest["regime"] | null {
  if (!trendExtraction) {
    return null;
  }
  const candidates: Array<{
    key: "bull" | "flat" | "bear";
    regime: "Bull" | "Flat" | "Bear";
    probabilityPct: number;
  }> = [
    {
      key: "bull",
      regime: "Bull",
      probabilityPct: Number(trendExtraction.bull?.probabilityPct ?? Number.NEGATIVE_INFINITY),
    },
    {
      key: "flat",
      regime: "Flat",
      probabilityPct: Number(trendExtraction.flat?.probabilityPct ?? Number.NEGATIVE_INFINITY),
    },
    {
      key: "bear",
      regime: "Bear",
      probabilityPct: Number(trendExtraction.bear?.probabilityPct ?? Number.NEGATIVE_INFINITY),
    },
  ];
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (candidate.probabilityPct > best.probabilityPct) {
      best = candidate;
    }
  }
  return Number.isFinite(best.probabilityPct) ? best.regime : null;
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function renderTradeCellValue(header: string, value: unknown): ReactNode {
  const normalizedHeader = header.trim().toLowerCase();
  if (normalizedHeader === "side" && typeof value === "string") {
    return (
      <span className={`inline-flex items-center gap-1 ${formatSideToneClass(value)}`}>
        {isPositiveSide(value) ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
        {isNegativeSide(value) ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
        {value}
      </span>
    );
  }
  if ((normalizedHeader.includes("pnl") || normalizedHeader.includes("profit")) && typeof value === "number") {
    return <span className={formatSignedToneClass(value)}>{formatCellValue(value)}</span>;
  }
  return formatCellValue(value);
}

function formatKpiToneClass(label: string, value: string) {
  const normalizedLabel = label.trim().toLowerCase();
  const numericValue = parseDisplayNumber(value);
  if (numericValue === null) {
    return "";
  }

  if (normalizedLabel.includes("win_rate") || normalizedLabel.includes("win rate")) {
    if (numericValue >= 55) {
      return "text-emerald-300";
    }
    if (numericValue < 45) {
      return "text-red-300";
    }
    return "text-amber-300";
  }

  if (normalizedLabel === "wins" || normalizedLabel.endsWith(" wins")) {
    return numericValue > 0 ? "text-emerald-300" : "text-muted-foreground";
  }

  if (normalizedLabel === "losses" || normalizedLabel.endsWith(" losses")) {
    return numericValue > 0 ? "text-red-300" : "text-muted-foreground";
  }

  if (normalizedLabel.includes("drawdown")) {
    if (numericValue <= 10) {
      return "text-emerald-300";
    }
    if (numericValue > 20) {
      return "text-red-300";
    }
    return "text-amber-300";
  }

  if (normalizedLabel.includes("pnl") || normalizedLabel.includes("profit") || normalizedLabel.includes("return")) {
    return formatSignedToneClass(numericValue);
  }

  return "";
}

function parseDisplayNumber(value: string) {
  const normalized = value.replaceAll(",", "").replace("%", "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSignedToneClass(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return "text-muted-foreground";
  }
  return value > 0 ? "font-medium text-emerald-300" : "font-medium text-red-300";
}

function formatSideToneClass(side: string) {
  if (isPositiveSide(side)) {
    return "font-medium text-emerald-300";
  }
  if (isNegativeSide(side)) {
    return "font-medium text-red-300";
  }
  return "";
}

function isPositiveSide(side: string) {
  const normalized = side.trim().toLowerCase();
  return normalized === "buy" || normalized === "long";
}

function isNegativeSide(side: string) {
  const normalized = side.trim().toLowerCase();
  return normalized === "sell" || normalized === "short";
}
