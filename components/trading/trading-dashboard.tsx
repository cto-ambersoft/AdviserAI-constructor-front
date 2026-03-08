"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UTCTimestamp } from "lightweight-charts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Info,
  Lightbulb,
  Loader2,
  Minus,
  PanelLeft,
  Wallet,
  X,
  XCircle,
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
import { EquityCurveChart } from "@/components/trading/equity-curve-chart";
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
  createPersonalAnalysisProfile,
  deletePersonalAnalysisProfile,
  getPersonalAnalysisDefaults,
  getPersonalAnalysisJob,
  getPersonalAnalysisLatest,
  deleteStrategy,
  getAuditMeta,
  getBacktestCatalog,
  getMarketMeta,
  getMarketOhlcv,
  getStrategiesMeta,
  listAnalysisRuns,
  listPersonalAnalysisHistory,
  listPersonalAnalysisProfiles,
  getVwapIndicators,
  getVwapPresets,
  getVwapRegimes,
  listAuditEvents,
  listExchangeAccounts,
  listStrategies,
  pollLivePaper,
  playLivePaper,
  runAtrOrderBlockBacktest,
  runAtrObLiveSignal,
  runBuilderLiveSignal,
  runGridBotBacktest,
  runIntradayMomentumBacktest,
  runKnifeCatcherBacktest,
  runPortfolioBacktest,
  stopLivePaper,
  triggerPersonalAnalysisProfile,
  triggerAnalysisNow,
  upsertLivePaperProfile,
  updateStrategy,
  updatePersonalAnalysisProfile,
  runVwapBacktest,
  type AnalysisRun,
  type AnalysisTrendExtraction,
  type AtrOrderBlockRequest,
  type AtrObSignalRequest,
  type AuditLogRead,
  type AuditMetaResponse,
  type BacktestCatalogResponse,
  type BacktestResponse,
  type BuilderSignalRequest,
  type ExchangeAccountRead,
  type GridBotRequest,
  type IntradayMomentumRequest,
  type LivePaperEventRead,
  type LivePaperProfileRead,
  type LivePaperTradeRead,
  type KnifeCatcherRequest,
  type LiveSignalResult,
  type JsonRecord,
  type PersonalAgentFlags,
  type PersonalAgentWeights,
  type PersonalAnalysisDefaultsRead,
  type PersonalAnalysisHistoryRead,
  type PersonalAnalysisJobRead,
  type PersonalAnalysisProfileRead,
  type SignalExecuteRequest,
  type StrategyCreate,
  type StrategyMetaResponse,
  type StrategyRead,
  type VwapBacktestRequest,
} from "@/lib/api";
import type { CandlePoint, OverlayLine } from "@/lib/trading/chart-types";
import {
  mapBacktestToMarkers,
  mapBacktestToOverlays,
  normalizeBacktestMetrics,
  mapMarketRowsToCandles,
  toKpiRows,
} from "@/lib/trading/mappers";
import {
  calculatePosition,
  type TradeParams,
} from "@/lib/trading/risk-calculator";
import {
  DASHBOARD_TABS,
  TIMEFRAMES,
  type DashboardTab,
  type Timeframe,
} from "@/stores/trading-store";
import { useTradingStore } from "@/providers/trading-store-provider";
import { AnalysisReport } from "@/components/trading/analysis-report";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";
type BuiltInStrategyKey = "atr" | "knife" | "grid" | "intraday";

type LiveExecutionFormState = {
  mode: SignalExecuteRequest["mode"];
  execute: boolean;
  account_id: number | null;
  fee_pct: number;
};

type LivePaperPresetKind =
  | "builder"
  | "atr_ob"
  | "atr"
  | "knife"
  | "grid"
  | "intraday";
type LiveStrategyKey = LivePaperPresetKind;
type LivePaperSource = "saved" | "builtin";

type LivePaperMetrics = {
  current_balance: number | null;
  total_pnl: number | null;
  closed_trades: number | null;
  equity_curve: unknown[];
};

type LivePaperSessionStats = {
  closedTrades: number;
  totalPnl: number;
  winRatePct: number | null;
  avgTradePnl: number | null;
  sessionStartTradeId: number;
  sessionStartEventId: number;
  sessionStartRevision: number | null;
  sessionStartAt: string | null;
};

type LivePaperBuiltinPayloadInput = {
  key: BuiltInStrategyKey;
  strategyVersion: string;
  symbol: string;
  timeframe: string;
  bars: number;
  atrForm: AtrStrategyFormState;
  knifeForm: KnifeStrategyFormState;
  gridForm: GridStrategyFormState;
  intradayForm: IntradayStrategyFormState;
};

type RiskCalculatorFormState = Required<TradeParams>;
type AnalysisMode = "global" | "personal";
type PersonalProfileFormState = {
  id: number | null;
  symbol: string;
  queryPrompt: string;
  intervalMinutes: number;
  agents: PersonalAgentFlags;
  agentWeights: PersonalAgentWeights;
};

type PendingActionKey =
  | "run_builder"
  | "run_saved"
  | "run_atr"
  | "run_knife"
  | "run_grid"
  | "run_intraday"
  | "run_portfolio"
  | "save_strategy"
  | "delete_strategy"
  | "run_live_signal"
  | "refresh_analysis"
  | "trigger_analysis";

function normalizeStrategyLabel(label: string) {
  return label.trim().toLowerCase();
}

function roundMetric(value: number, digits = 4) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function maxPositionPctToUsdt(accountBalance: number, maxPositionPct: number) {
  if (
    !Number.isFinite(accountBalance) ||
    accountBalance <= 0 ||
    !Number.isFinite(maxPositionPct)
  ) {
    return 0;
  }
  return roundMetric((accountBalance * Math.max(0, maxPositionPct)) / 100, 2);
}

function maxPositionUsdtToPct(accountBalance: number, maxPositionUsdt: number) {
  if (
    !Number.isFinite(accountBalance) ||
    accountBalance <= 0 ||
    !Number.isFinite(maxPositionUsdt)
  ) {
    return 0;
  }
  return roundMetric((Math.max(0, maxPositionUsdt) / accountBalance) * 100, 4);
}

function getMaxEntityId<T extends { id: number }>(items: T[]) {
  if (!items.length) {
    return null;
  }
  return items.reduce((max, item) => (item.id > max ? item.id : max), items[0].id);
}

function mergeUniqueById<T extends { id: number }>(current: T[], incoming: T[]) {
  if (!incoming.length) {
    return current;
  }
  const existing = new Set(current.map((item) => item.id));
  const additions = incoming.filter((item) => !existing.has(item.id));
  if (!additions.length) {
    return current;
  }
  return [...current, ...additions];
}

function createEmptyPersonalProfileForm(symbol: string): PersonalProfileFormState {
  return {
    id: null,
    symbol,
    queryPrompt: "",
    intervalMinutes: 60,
    agents: {},
    agentWeights: {},
  };
}

function toPersonalProfileForm(
  defaults: PersonalAnalysisDefaultsRead | null,
  profile: PersonalAnalysisProfileRead | null,
  symbol: string,
): PersonalProfileFormState {
  const baseAgents = defaults?.agents ?? {};
  const baseWeights = defaults?.agent_weights ?? {};
  const profileAgents = profile?.agents ?? {};
  const profileWeights = profile?.agent_weights ?? {};
  return {
    id: profile?.id ?? null,
    symbol: profile?.symbol ?? symbol,
    queryPrompt: profile?.query_prompt ?? "",
    intervalMinutes: profile?.interval_minutes ?? 60,
    agents: {
      ...baseAgents,
      ...profileAgents,
    },
    agentWeights: {
      ...baseWeights,
      ...profileWeights,
    },
  };
}

function countEnabledAgents(agents: PersonalAgentFlags) {
  return Object.values(agents).filter(Boolean).length;
}

function mapLivePaperTradesToMarkers(trades: LivePaperTradeRead[]) {
  if (!trades.length) {
    return [] as ReturnType<typeof mapBacktestToMarkers>;
  }
  return mapBacktestToMarkers({
    trades: trades as unknown as JsonRecord[],
  } as BacktestResponse);
}

function buildLivePaperBuiltinStrategyPayload({
  key,
  strategyVersion,
  symbol,
  timeframe,
  bars,
  atrForm,
  knifeForm,
  gridForm,
  intradayForm,
}: LivePaperBuiltinPayloadInput): StrategyCreate {
  const base = {
    version: strategyVersion,
    is_active: true,
    description: "Auto-updated for live paper builtin mode",
  } as const;

  switch (key) {
    case "atr":
      return {
        ...base,
        name: "Live Paper Built-in ATR",
        strategy_type: "atr_order_block",
        config: {
          ...atrForm,
          symbol,
          timeframe,
          bars,
          include_series: true,
          trades_limit: 1000,
          tp_levels: [
            [0.6, 0.3],
            [1.2, 0.4],
            [2.0, 0.3],
          ],
        },
      };
    case "knife":
      return {
        ...base,
        name: "Live Paper Built-in Knife",
        strategy_type: "knife_catcher",
        config: {
          ...knifeForm,
          symbol,
          timeframe,
          bars,
          include_series: true,
          trades_limit: 1000,
        },
      };
    case "grid":
      return {
        ...base,
        name: "Live Paper Built-in Grid",
        strategy_type: "grid_bot",
        config: {
          ...gridForm,
          symbol,
          timeframe,
          bars,
          include_series: true,
          trades_limit: 1000,
        },
      };
    case "intraday":
      return {
        ...base,
        name: "Live Paper Built-in Intraday",
        strategy_type: "intraday_momentum",
        config: {
          ...intradayForm,
          symbol,
          timeframe,
          bars,
          include_series: true,
          trades_limit: 1000,
        },
      };
  }
}

function mapBuiltinStrategyLabelToKey(
  label: string,
): BuiltInStrategyKey | null {
  const normalized = normalizeStrategyLabel(label);
  if (
    normalized.includes("atr") &&
    (normalized.includes("order") || normalized.includes("block"))
  ) {
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

function normalizeBuiltinStrategyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function isPortfolioBuiltinStrategy(name: string) {
  const normalized = normalizeBuiltinStrategyName(name);
  return !normalized.includes("vwap") && !normalized.includes("builder");
}

function parsePortfolioParamValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return trimmed;
}

function humanizeParamName(name: string) {
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildKnownBuiltinConfig(
  strategyName: string,
  forms: {
    atr: AtrStrategyFormState;
    knife: KnifeStrategyFormState;
    grid: GridStrategyFormState;
    intraday: IntradayStrategyFormState;
  },
): JsonRecord {
  const key = mapBuiltinStrategyLabelToKey(strategyName);
  if (key === "atr") {
    return {
      ema_period: forms.atr.ema_period,
      atr_period: forms.atr.atr_period,
      impulse_atr: forms.atr.impulse_atr,
      ob_buffer_atr: forms.atr.ob_buffer_atr,
      one_trade_per_ob: forms.atr.one_trade_per_ob,
      allocation_usdt: forms.atr.allocation_usdt,
    };
  }
  if (key === "knife") {
    return { ...forms.knife };
  }
  if (key === "grid") {
    return { ...forms.grid };
  }
  if (key === "intraday") {
    return { ...forms.intraday };
  }
  return {};
}

const TAB_META: Record<DashboardTab, { title: string; description: string }> = {
  builder: {
    title: "AMBuilder",
    description: "Configure and run builder backtests",
  },
  strategies: {
    title: "Strategies",
    description: "Run saved and built-in strategies",
  },
  live: {
    title: "Live Signals",
    description: "Preview, simulate, and execute live signals",
  },
  portfolio: {
    title: "Portfolio",
    description: "Build a portfolio from selected strategies",
  },
  analysis: {
    title: "AI Analysis",
    description: "Market forecasts, scenarios and reports",
  },
  audit: {
    title: "Audit & Tools",
    description: "Event history, action filters",
  },
};

export function TradingDashboard() {
  const symbol = useTradingStore((state) => state.symbol);
  const timeframe = useTradingStore((state) => state.timeframe);
  const bars = useTradingStore((state) => state.bars);
  const activeTab = useTradingStore((state) => state.activeTab);
  const setSymbol = useTradingStore((state) => state.setSymbol);
  const setTimeframe = useTradingStore((state) => state.setTimeframe);
  const setBars = useTradingStore((state) => state.setBars);
  const setActiveTab = useTradingStore((state) => state.setActiveTab);
  const setLastPrice = useTradingStore((state) => state.setLastPrice);
  const setLoading = useTradingStore((state) => state.setLoading);

  const [marketMeta, setMarketMeta] = useState<{
    symbols: string[];
    timeframes: string[];
    minBars: number;
    maxBars: number;
  } | null>(null);
  const [exchangeAccounts, setExchangeAccounts] = useState<
    ExchangeAccountRead[]
  >([]);
  const [catalog, setCatalog] = useState<BacktestCatalogResponse | null>(null);
  const [strategyList, setStrategyList] = useState<StrategyRead[]>([]);
  const [auditMeta, setAuditMeta] = useState<AuditMetaResponse | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditLogRead[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [overlays, setOverlays] = useState<OverlayLine[]>([]);
  const [chartMarkers, setChartMarkers] = useState<
    ReturnType<typeof mapBacktestToMarkers>
  >([]);
  const [livePaperChartMarkers, setLivePaperChartMarkers] = useState<
    ReturnType<typeof mapBacktestToMarkers>
  >([]);
  const [latestBacktest, setLatestBacktest] = useState<BacktestResponse | null>(
    null,
  );
  const [latestPortfolio, setLatestPortfolio] =
    useState<BacktestResponse | null>(null);
  const [vwapPresetOptions, setVwapPresetOptions] = useState<string[]>([]);
  const [vwapRegimeOptions, setVwapRegimeOptions] = useState<string[]>([]);
  const [vwapIndicatorOptions, setVwapIndicatorOptions] = useState<string[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(
    null,
  );
  const [portfolioUserSelection, setPortfolioUserSelection] = useState<
    number[]
  >([]);
  const [portfolioUserAllocations, setPortfolioUserAllocations] = useState<
    Record<number, number>
  >({});
  const [portfolioBuiltinSelection, setPortfolioBuiltinSelection] = useState<
    string[]
  >([]);
  const [portfolioBuiltinAllocations, setPortfolioBuiltinAllocations] =
    useState<Record<string, number>>({});
  const [portfolioBuiltinParams, setPortfolioBuiltinParams] = useState<
    Record<string, Record<string, string>>
  >({});
  const [auditFilter, setAuditFilter] = useState("");
  const [auditLimit] = useState(200);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingActionKey | null>(
    null,
  );
  const [activeLiveStrategy, setActiveLiveStrategy] =
    useState<LiveStrategyKey>("builder");
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
  const [liveAtrObForm] = useState<AtrObSignalRequest>({
    symbol: "BTC/USDT",
    timeframe: "1h",
    bars: 500,
    ema_period: 50,
    atr_period: 14,
    impulse_atr: 1.5,
    ob_buffer_atr: 0.15,
    allocation_usdt: 1000,
  });
  const [liveExecutionForm, setLiveExecutionForm] =
    useState<LiveExecutionFormState>({
      mode: "dry_run",
      execute: false,
      account_id: null,
      fee_pct: 0.06,
    });
  const [latestLiveSignal, setLatestLiveSignal] =
    useState<LiveSignalResult | null>(null);
  const [livePaperTotalBalanceUsdt, setLivePaperTotalBalanceUsdt] =
    useState(5000);
  const [livePaperPerTradeUsdt, setLivePaperPerTradeUsdt] = useState(250);
  const [livePaperSource, setLivePaperSource] =
    useState<LivePaperSource>("saved");
  const [livePaperBuiltInStrategy, setLivePaperBuiltInStrategy] =
    useState<BuiltInStrategyKey>("atr");
  const [livePaperBuiltinStrategyId, setLivePaperBuiltinStrategyId] = useState<
    number | null
  >(null);
  const [livePaperProfile, setLivePaperProfile] =
    useState<LivePaperProfileRead | null>(null);
  const [livePaperTrades, setLivePaperTrades] = useState<LivePaperTradeRead[]>(
    [],
  );
  const [livePaperEvents, setLivePaperEvents] = useState<LivePaperEventRead[]>(
    [],
  );
  const [livePaperMetrics, setLivePaperMetrics] = useState<LivePaperMetrics>({
    current_balance: null,
    total_pnl: null,
    closed_trades: null,
    equity_curve: [],
  });
  const [livePaperSessionStartTradeId, setLivePaperSessionStartTradeId] =
    useState(0);
  const [livePaperSessionStartEventId, setLivePaperSessionStartEventId] =
    useState(0);
  const [livePaperSessionStartRevision, setLivePaperSessionStartRevision] =
    useState<number | null>(null);
  const [livePaperSessionStartAt, setLivePaperSessionStartAt] = useState<
    string | null
  >(null);
  const [livePaperIsRunning, setLivePaperIsRunning] = useState(false);
  const [livePaperIsSavingProfile, setLivePaperIsSavingProfile] = useState(false);
  const [livePaperIsPlaying, setLivePaperIsPlaying] = useState(false);
  const [livePaperIsStopping, setLivePaperIsStopping] = useState(false);
  const [livePaperPollNonce, setLivePaperPollNonce] = useState(0);
  const [strategyMeta, setStrategyMeta] = useState<StrategyMetaResponse | null>(
    null,
  );
  const livePaperBacktestMarkersRef = useRef<ReturnType<typeof mapBacktestToMarkers>>(
    [],
  );
  const livePaperTradesRef = useRef<LivePaperTradeRead[]>([]);
  const livePaperEventsRef = useRef<LivePaperEventRead[]>([]);
  const livePaperLastTradeIdRef = useRef<number | null>(null);
  const livePaperLastEventIdRef = useRef<number | null>(null);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [latestAnalysisRun, setLatestAnalysisRun] =
    useState<AnalysisRun | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(
    null,
  );
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false);
  const [analysisPollingJobId, setAnalysisPollingJobId] = useState<
    string | null
  >(null);
  const [isAnalysisAutoRefreshing, setIsAnalysisAutoRefreshing] =
    useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("global");
  const [personalDefaults, setPersonalDefaults] =
    useState<PersonalAnalysisDefaultsRead | null>(null);
  const [personalProfiles, setPersonalProfiles] = useState<
    PersonalAnalysisProfileRead[]
  >([]);
  const [selectedPersonalProfileId, setSelectedPersonalProfileId] = useState<
    number | null
  >(null);
  const [personalProfileForm, setPersonalProfileForm] =
    useState<PersonalProfileFormState>(createEmptyPersonalProfileForm(symbol));
  const [personalHistory, setPersonalHistory] = useState<
    PersonalAnalysisHistoryRead[]
  >([]);
  const [personalHistoryBefore, setPersonalHistoryBefore] = useState<
    string | null
  >(null);
  const [personalLatest, setPersonalLatest] =
    useState<PersonalAnalysisHistoryRead | null>(null);
  const [isPersonalLoading, setIsPersonalLoading] = useState(false);
  const [isPersonalSavePending, setIsPersonalSavePending] = useState(false);
  const [isPersonalTriggerPending, setIsPersonalTriggerPending] =
    useState(false);
  const [isPersonalHistoryLoading, setIsPersonalHistoryLoading] =
    useState(false);
  const [personalPollingJobId, setPersonalPollingJobId] = useState<
    string | null
  >(null);
  const [personalJobStatus, setPersonalJobStatus] =
    useState<PersonalAnalysisJobRead | null>(null);

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
    account_balance: 1000,
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
  const [riskCalculator, setRiskCalculator] = useState<RiskCalculatorFormState>(
    {
      riskUsd: 50,
      entryPrice: 100000,
      stopLoss: 99000,
      feePercent: 0.06,
      rrRatio: 3,
    },
  );
  const [isRiskCalculatorCollapsed, setIsRiskCalculatorCollapsed] =
    useState(true);

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
          marketMetaData,
          strategiesMetaData,
          backtestCatalog,
          indicatorsMap,
          presetsMap,
          regimesMap,
          strategiesData,
          exchangeAccountsData,
          auditMetaData,
          auditEventsData,
        ] = await Promise.all([
          getMarketMeta(),
          getStrategiesMeta(),
          getBacktestCatalog(),
          getVwapIndicators(),
          getVwapPresets(),
          getVwapRegimes(),
          listStrategies(),
          listExchangeAccounts(),
          getAuditMeta(),
          listAuditEvents(auditLimit),
        ]);
        setMarketMeta({
          symbols: [marketMetaData.default_symbol],
          timeframes: marketMetaData.common_timeframes,
          minBars: marketMetaData.min_bars,
          maxBars: marketMetaData.max_bars,
        });
        setStrategyMeta(strategiesMetaData);
        setCatalog(backtestCatalog);
        setVwapIndicatorOptions(indicatorsMap.indicators ?? []);
        setVwapPresetOptions(
          presetsMap.presets ?? backtestCatalog.vwap.presets ?? [],
        );
        setVwapRegimeOptions(
          regimesMap.regimes ?? backtestCatalog.vwap.regimes ?? [],
        );
        setStrategyList(strategiesData);
        setExchangeAccounts(exchangeAccountsData);
        setAuditMeta(auditMetaData);
        setAuditEvents(auditEventsData);
        try {
          const [analysisRunsData, personalDefaultsData, personalProfilesData] =
            await Promise.all([
              listAnalysisRuns({ limit: 50 }),
              getPersonalAnalysisDefaults(),
              listPersonalAnalysisProfiles(),
            ]);
          const initialRuns = analysisRunsData.runs ?? [];
          setAnalysisRuns(initialRuns);
          setLatestAnalysisRun(initialRuns[0] ?? null);
          setPersonalDefaults(personalDefaultsData);
          setPersonalProfiles(personalProfilesData);
        } catch {
          // Analysis is optional for strategy builder controls.
          setAnalysisRuns([]);
          setLatestAnalysisRun(null);
          setPersonalDefaults(null);
          setPersonalProfiles([]);
          setInfoMessage("Analysis backend is unavailable.");
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load metadata",
        );
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
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load market candles",
        );
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
    const stillExists = analysisRuns.some(
      (run) => run._id === selectedAnalysisId,
    );
    if (!stillExists) {
      setSelectedAnalysisId(analysisRuns[0]._id);
    }
  }, [analysisRuns, selectedAnalysisId]);

  useEffect(() => {
    if (!personalProfiles.length) {
      setSelectedPersonalProfileId(null);
      return;
    }
    if (!selectedPersonalProfileId) {
      setSelectedPersonalProfileId(personalProfiles[0].id);
      return;
    }
    const stillExists = personalProfiles.some(
      (profile) => profile.id === selectedPersonalProfileId,
    );
    if (!stillExists) {
      setSelectedPersonalProfileId(personalProfiles[0].id);
    }
  }, [personalProfiles, selectedPersonalProfileId]);

  useEffect(() => {
    const profile = selectedPersonalProfileId
      ? personalProfiles.find((item) => item.id === selectedPersonalProfileId) ??
        null
      : personalProfiles[0] ?? null;
    if (!profile) {
      setPersonalProfileForm((current) =>
        current.id === null && current.symbol === symbol
          ? current
          : createEmptyPersonalProfileForm(symbol),
      );
      return;
    }
    setPersonalProfileForm(
      toPersonalProfileForm(personalDefaults, profile, symbol),
    );
  }, [personalDefaults, personalProfiles, selectedPersonalProfileId, symbol]);

  const kpiRows = useMemo(() => {
    return toKpiRows(latestBacktest?.summary as JsonRecord | undefined);
  }, [latestBacktest]);
  const backtestMetrics = useMemo(
    () => normalizeBacktestMetrics(latestBacktest),
    [latestBacktest],
  );
  const equityCurveSeries = useMemo(
    () =>
      backtestMetrics?.equityCurve.map((point) => ({
        time: point.time,
        value: point.value,
      })) ?? [],
    [backtestMetrics],
  );
  const selectedAnalysisRun = useMemo(() => {
    if (!selectedAnalysisId) {
      return analysisRuns[0] ?? null;
    }
    return (
      analysisRuns.find((run) => run._id === selectedAnalysisId) ??
      analysisRuns[0] ??
      null
    );
  }, [analysisRuns, selectedAnalysisId]);

  const selectedPersonalProfile = useMemo(() => {
    if (!selectedPersonalProfileId) {
      return personalProfiles[0] ?? null;
    }
    return (
      personalProfiles.find((profile) => profile.id === selectedPersonalProfileId) ??
      personalProfiles[0] ??
      null
    );
  }, [personalProfiles, selectedPersonalProfileId]);

  const availablePersonalAgents = useMemo(() => {
    const defaults = personalDefaults?.available_agents ?? [];
    if (defaults.length) {
      return defaults;
    }
    const merged = new Set([
      ...Object.keys(personalProfileForm.agents),
      ...Object.keys(personalProfileForm.agentWeights),
    ]);
    return Array.from(merged);
  }, [
    personalDefaults?.available_agents,
    personalProfileForm.agents,
    personalProfileForm.agentWeights,
  ]);

  const latestTrendExtraction = latestAnalysisRun?.trendExtraction ?? null;

  useEffect(() => {
    const preferredRegime = getPreferredRegime(latestTrendExtraction);
    if (!preferredRegime) {
      return;
    }
    setBuilderForm((current) =>
      current.regime === preferredRegime
        ? current
        : { ...current, regime: preferredRegime },
    );
    setLiveBuilderForm((current) =>
      current.regime === preferredRegime
        ? current
        : { ...current, regime: preferredRegime },
    );
  }, [latestTrendExtraction]);

  const filteredAudit = useMemo(() => {
    const term = auditFilter.trim().toLowerCase();
    if (!term) {
      return auditEvents;
    }
    return auditEvents.filter((item) => {
      const payloadText = JSON.stringify(item.payload).toLowerCase();
      const actor = item.actor?.trim() ? item.actor : "system";
      const target = `${item.target_type}:${item.target_id}`.toLowerCase();
      return (
        actor.toLowerCase().includes(term) ||
        item.event.toLowerCase().includes(term) ||
        target.includes(term) ||
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
      .filter(
        (item): item is { key: BuiltInStrategyKey; label: string } =>
          item !== null,
      );
  }, [catalog?.portfolio.builtin_strategies]);

  const livePaperBuiltInStrategyKey = builtInStrategyItems.some(
    (item) => item.key === livePaperBuiltInStrategy,
  )
    ? livePaperBuiltInStrategy
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

  const livePaperSessionTrades = useMemo(
    () => livePaperTrades,
    [livePaperTrades],
  );

  const livePaperSessionStats = useMemo<LivePaperSessionStats>(() => {
    const closedTradesFromTrades = livePaperSessionTrades.length;
    const totalPnlFromTrades = roundMetric(
      livePaperSessionTrades.reduce((sum, trade) => sum + trade.pnl_usdt, 0),
      2,
    );
    const closedTrades = livePaperMetrics.closed_trades ?? closedTradesFromTrades;
    const totalPnl = livePaperMetrics.total_pnl ?? totalPnlFromTrades;
    const wins = livePaperSessionTrades.filter((trade) => trade.pnl_usdt > 0).length;
    return {
      closedTrades,
      totalPnl,
      winRatePct: closedTradesFromTrades
        ? roundMetric((wins / closedTradesFromTrades) * 100, 2)
        : null,
      avgTradePnl: closedTrades ? roundMetric(totalPnl / closedTrades, 2) : null,
      sessionStartTradeId: livePaperSessionStartTradeId,
      sessionStartEventId: livePaperSessionStartEventId,
      sessionStartRevision: livePaperSessionStartRevision,
      sessionStartAt: livePaperSessionStartAt,
    };
  }, [
    livePaperSessionStartAt,
    livePaperSessionStartEventId,
    livePaperSessionStartRevision,
    livePaperSessionStartTradeId,
    livePaperMetrics.closed_trades,
    livePaperMetrics.total_pnl,
    livePaperSessionTrades,
  ]);

  useEffect(() => {
    if (!selectedStrategyId) {
      return;
    }
    const selected = strategyById.get(selectedStrategyId);
    if (!selected) {
      return;
    }
    setBuilderName(selected.name);
    const config = (selected.config ?? {}) as Partial<VwapBacktestRequest>;
    setBuilderForm((current) => ({
      ...current,
      ...config,
      symbol: current.symbol,
      timeframe: current.timeframe,
      bars: current.bars,
      include_series: true,
    }));
  }, [selectedStrategyId, strategyById]);

  useEffect(() => {
    if (livePaperSource !== "builtin") {
      return;
    }
    if (!livePaperBuiltInStrategyKey) {
      return;
    }

    let isCancelled = false;
    const upsertBuiltInStrategy = async () => {
      const payload = buildLivePaperBuiltinStrategyPayload({
        key: livePaperBuiltInStrategyKey,
        strategyVersion: strategyMeta?.default_version ?? "1.0.0",
        symbol,
        timeframe,
        bars,
        atrForm,
        knifeForm,
        gridForm,
        intradayForm,
      });

      try {
        let strategyId = livePaperBuiltinStrategyId;
        if (strategyId) {
          await updateStrategy(strategyId, {
            name: payload.name,
            strategy_type: payload.strategy_type,
            version: payload.version,
            description: payload.description ?? null,
            is_active: payload.is_active,
            config: (payload.config ?? null) as JsonRecord | null,
          });
        } else {
          const created = await createStrategy(payload);
          strategyId = created.id;
        }
        const refreshed = await listStrategies();
        if (isCancelled) {
          return;
        }
        setStrategyList(refreshed);
        if (strategyId !== null) {
          setLivePaperBuiltinStrategyId(strategyId);
        }
      } catch {
        // Keep the built-in editor responsive even if strategy sync fails.
      }
    };

    const id = window.setTimeout(() => {
      void upsertBuiltInStrategy();
    }, 200);
    return () => {
      isCancelled = true;
      window.clearTimeout(id);
    };
  }, [
    atrForm,
    bars,
    gridForm,
    intradayForm,
    knifeForm,
    livePaperBuiltinStrategyId,
    livePaperBuiltInStrategyKey,
    livePaperSource,
    strategyMeta?.default_version,
    symbol,
    timeframe,
  ]);

  const isActionPending = (key: PendingActionKey) => pendingAction === key;

  const runWithPendingAction = async (
    key: PendingActionKey,
    task: () => Promise<void>,
  ) => {
    if (pendingAction) {
      return;
    }
    setPendingAction(key);
    try {
      await task();
    } finally {
      setPendingAction(null);
    }
  };

  const runBacktestSafely = async (
    runner: () => Promise<BacktestResponse>,
    label: string,
    pendingKey: PendingActionKey,
  ) => {
    setLoading(true);
    setPendingAction(pendingKey);
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
      setErrorMessage(
        error instanceof Error ? error.message : "Backtest failed",
      );
    } finally {
      setPendingAction(null);
      setLoading(false);
    }
  };

  const handleSaveBuilderStrategy = async () => {
    if (!builderName.trim()) {
      setErrorMessage("Strategy name is required");
      return;
    }
    const targetStrategyId = selectedStrategyId;
    await runWithPendingAction("save_strategy", async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const payload = {
          name: builderName.trim(),
          strategy_type: strategyMeta?.default_strategy_type ?? "builder_vwap",
          version: strategyMeta?.default_version ?? "1.0.0",
          is_active: true,
          config: {
            ...builderForm,
            symbol,
            timeframe,
            bars,
          } as unknown as JsonRecord,
          description: "Saved from web builder",
        };
        if (targetStrategyId) {
          await updateStrategy(targetStrategyId, payload);
        } else {
          await createStrategy(payload);
        }
        const refreshed = await listStrategies();
        setStrategyList(refreshed);
        if (!targetStrategyId) {
          setBuilderName("");
        }
        setInfoMessage(
          targetStrategyId ? "Strategy updated" : "Strategy saved",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to save strategy",
        );
      } finally {
        setLoading(false);
      }
    });
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
    await runBacktestSafely(
      async () => {
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
          stop_mode:
            (config.stop_mode as VwapBacktestRequest["stop_mode"]) ?? "ATR",
          swing_lookback: Number(config.swing_lookback ?? 20),
          swing_buffer_atr: Number(config.swing_buffer_atr ?? 0.3),
          ob_impulse_atr: Number(config.ob_impulse_atr ?? 1.5),
          ob_buffer_atr: Number(config.ob_buffer_atr ?? 0.15),
          ob_lookback: Number(config.ob_lookback ?? 120),
        });
      },
      saved.name,
      "run_saved",
    );
  };

  const handleDeleteStrategy = async () => {
    if (!selectedStrategyId) {
      return;
    }
    await runWithPendingAction("delete_strategy", async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        await deleteStrategy(selectedStrategyId);
        const nextStrategies = await listStrategies();
        setStrategyList(nextStrategies);
        setSelectedStrategyId(null);
        setInfoMessage("Strategy deleted");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to delete strategy",
        );
      } finally {
        setLoading(false);
      }
    });
  };

  const runPortfolio = async () => {
    const selectedUserStrategies = strategyList.filter((item) =>
      portfolioUserSelection.includes(item.id),
    );
    const selectedBuiltinStrategies = Array.from(
      new Set(portfolioBuiltinSelection),
    ).filter(isPortfolioBuiltinStrategy);
    if (
      selectedUserStrategies.length === 0 &&
      selectedBuiltinStrategies.length === 0
    ) {
      setErrorMessage(
        "Pick at least one saved or built-in strategy for portfolio run",
      );
      return;
    }
    await runWithPendingAction("run_portfolio", async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        if (!Number.isFinite(portfolioCapital) || portfolioCapital <= 0) {
          throw new Error("total_capital must be greater than 0");
        }
        const userStrategies = selectedUserStrategies.map((strategy) => ({
          strategy_id: strategy.id,
          allocation_pct: Number(portfolioUserAllocations[strategy.id] ?? 0),
        }));
        const builtinParamCatalog =
          catalog?.portfolio.builtin_strategy_params ?? {};
        const builtinStrategies = selectedBuiltinStrategies.map((name) => {
          const allocationPct = Number(portfolioBuiltinAllocations[name] ?? 0);
          const supportedParams =
            builtinParamCatalog[name] ??
            Object.entries(builtinParamCatalog).find(
              ([key]) =>
                normalizeBuiltinStrategyName(key) ===
                normalizeBuiltinStrategyName(name),
            )?.[1] ??
            [];
          const config = buildKnownBuiltinConfig(name, {
            atr: atrForm,
            knife: knifeForm,
            grid: gridForm,
            intraday: intradayForm,
          });
          const rawParams = portfolioBuiltinParams[name] ?? {};
          for (const paramName of supportedParams) {
            const rawValue = String(rawParams[paramName] ?? "").trim();
            if (!rawValue) {
              continue;
            }
            const parsedValue = parsePortfolioParamValue(rawValue);
            config[paramName] = parsedValue;
          }
          return {
            name,
            allocation_pct: allocationPct,
            config,
          };
        });
        const allAllocations = [...userStrategies, ...builtinStrategies].map(
          (item) => item.allocation_pct,
        );
        const hasPositiveAllocation = allAllocations.some((value) => value > 0);
        if (!hasPositiveAllocation) {
          throw new Error(
            "At least one strategy must have allocation_pct greater than 0",
          );
        }
        if (
          allAllocations.some(
            (value) => !Number.isFinite(value) || value < 0 || value > 100,
          )
        ) {
          throw new Error("allocation_pct must be in range 0..100");
        }

        const result = await runPortfolioBacktest({
          total_capital: portfolioCapital,
          async_job: portfolioAsyncJob,
          user_strategies: userStrategies.filter(
            (item) => item.allocation_pct > 0,
          ),
          builtin_strategies: builtinStrategies.filter(
            (item) => item.allocation_pct > 0,
          ),
        });
        setLatestPortfolio(result);
        setOverlays(mapBacktestToOverlays(result));
        setChartMarkers(mapBacktestToMarkers(result));
        setInfoMessage("Portfolio backtest complete");
        await createAuditEvent({
          event: "PORTFOLIO_RUN",
          reason: builderAuditReason,
          target_type: "portfolio",
          target_id: "portfolio",
          payload: {
            user_strategies: selectedUserStrategies.map((item) => item.id),
            builtin_strategies: selectedBuiltinStrategies,
            total_capital: portfolioCapital,
          },
        });
        setAuditEvents(await listAuditEvents(auditLimit));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Portfolio run failed",
        );
      } finally {
        setLoading(false);
      }
    });
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
      "run_builder",
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
      "run_atr",
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
      "run_knife",
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
      "run_grid",
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
      "run_intraday",
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
      fee_pct: liveExecutionForm.fee_pct,
    };

    await runWithPendingAction("run_live_signal", async () => {
      setLoading(true);
      setErrorMessage("");
      setInfoMessage("");
      try {
        const result =
          activeLiveStrategy === "atr_ob" || activeLiveStrategy === "atr"
            ? await runAtrObLiveSignal({
                signal: {
                  ...liveAtrObForm,
                  symbol,
                  timeframe,
                  bars,
                },
                execution,
              })
            : await runBuilderLiveSignal({
                signal: {
                  ...liveBuilderForm,
                  symbol,
                  timeframe,
                  bars,
                },
                execution,
              });
        setLatestLiveSignal(result);
        const executionStatus =
          typeof result.execution?.status === "string"
            ? result.execution.status
            : "n/a";
        setInfoMessage(
          `Live signal computed. Execution status: ${executionStatus}`,
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Live signal request failed",
        );
      } finally {
        setLoading(false);
      }
    });
  };

  const resolveLivePaperStrategyId = useCallback(() => {
    if (livePaperSource === "builtin") {
      if (!livePaperBuiltInStrategyKey) {
        throw new Error("No built-in strategies returned by backend catalog");
      }

      const builtInPayload = buildLivePaperBuiltinStrategyPayload({
        key: livePaperBuiltInStrategyKey,
        strategyVersion: strategyMeta?.default_version ?? "1.0.0",
        symbol,
        timeframe,
        bars,
        atrForm,
        knifeForm,
        gridForm,
        intradayForm,
      });
      if (livePaperBuiltinStrategyId) {
        void updateStrategy(livePaperBuiltinStrategyId, {
          name: builtInPayload.name,
          strategy_type: builtInPayload.strategy_type,
          version: builtInPayload.version,
          description: builtInPayload.description ?? null,
          is_active: builtInPayload.is_active,
          config: (builtInPayload.config ?? null) as JsonRecord | null,
        }).catch(() => {
          // A race with deletion/manual edits should not block live-paper flow.
        });
        return livePaperBuiltinStrategyId;
      }
      throw new Error("Built-in strategy is not prepared yet");
    }

    if (!selectedStrategyId) {
      throw new Error("Select a saved strategy for live paper");
    }
    const selected = strategyById.get(selectedStrategyId);
    if (!selected) {
      throw new Error("Selected strategy was not found");
    }
    return selected.id;
  }, [
    atrForm,
    bars,
    gridForm,
    intradayForm,
    knifeForm,
    livePaperBuiltInStrategyKey,
    livePaperBuiltinStrategyId,
    livePaperSource,
    selectedStrategyId,
    strategyById,
    strategyMeta?.default_version,
    symbol,
    timeframe,
  ]);

  const saveLivePaperProfile = useCallback(async () => {
    if (
      !Number.isFinite(livePaperTotalBalanceUsdt) ||
      livePaperTotalBalanceUsdt <= 0
    ) {
      throw new Error("total_balance_usdt must be greater than 0");
    }
    if (!Number.isFinite(livePaperPerTradeUsdt) || livePaperPerTradeUsdt <= 0) {
      throw new Error("per_trade_usdt must be greater than 0");
    }
    if (livePaperPerTradeUsdt > livePaperTotalBalanceUsdt) {
      throw new Error(
        "per_trade_usdt cannot be greater than total_balance_usdt",
      );
    }

    const strategyId = resolveLivePaperStrategyId();
    const profile = await upsertLivePaperProfile({
      strategy_id: strategyId,
      total_balance_usdt: livePaperTotalBalanceUsdt,
      per_trade_usdt: livePaperPerTradeUsdt,
    });
    setLivePaperProfile(profile);
    return profile;
  }, [
    livePaperPerTradeUsdt,
    livePaperTotalBalanceUsdt,
    resolveLivePaperStrategyId,
  ]);

  const parseLivePaperMetrics = useCallback((raw: unknown): LivePaperMetrics => {
    const record =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const current_balance =
      typeof record.current_balance === "number" ? record.current_balance : null;
    const total_pnl = typeof record.total_pnl === "number" ? record.total_pnl : null;
    const closed_trades =
      typeof record.closed_trades === "number" ? record.closed_trades : null;
    const equity_curve = Array.isArray(record.equity_curve)
      ? record.equity_curve
      : [];
    return { current_balance, total_pnl, closed_trades, equity_curve };
  }, []);

  const applyLivePaperChartMarkers = useCallback(
    (liveTrades: LivePaperTradeRead[]) => {
      const liveMarkers = mapLivePaperTradesToMarkers(liveTrades);
      setLivePaperChartMarkers([...livePaperBacktestMarkersRef.current, ...liveMarkers]);
    },
    [],
  );

  const runLivePaperHistoryBacktestById = useCallback(
    async (strategyId: number) => {
      const strategy = strategyById.get(strategyId);
      if (!strategy) {
        throw new Error("Selected strategy for backtest history was not found");
      }
      const config = (strategy.config ?? {}) as Record<string, unknown>;
      const configWithDefaults = {
        ...config,
        include_series:
          typeof config.include_series === "boolean" ? config.include_series : true,
        trades_limit: Number.isFinite(Number(config.trades_limit))
          ? Number(config.trades_limit)
          : 1000,
      };

      let result: BacktestResponse;
      switch (strategy.strategy_type) {
        case "builder_vwap":
          result = await runVwapBacktest(
            configWithDefaults as unknown as VwapBacktestRequest,
          );
          break;
        case "atr_order_block":
          result = await runAtrOrderBlockBacktest(
            configWithDefaults as unknown as AtrOrderBlockRequest,
          );
          break;
        case "knife_catcher":
          result = await runKnifeCatcherBacktest(
            configWithDefaults as unknown as KnifeCatcherRequest,
          );
          break;
        case "grid_bot":
          result = await runGridBotBacktest(
            configWithDefaults as unknown as GridBotRequest,
          );
          break;
        case "intraday_momentum":
          result = await runIntradayMomentumBacktest(
            configWithDefaults as unknown as IntradayMomentumRequest,
          );
          break;
        default:
          throw new Error(
            `Unsupported strategy_type for live paper history: ${strategy.strategy_type}`,
          );
      }

      setLatestBacktest(result);
      setOverlays(mapBacktestToOverlays(result));
      livePaperBacktestMarkersRef.current = mapBacktestToMarkers(result);
      applyLivePaperChartMarkers(livePaperTradesRef.current);
    },
    [applyLivePaperChartMarkers, strategyById],
  );

  const resetLivePaperStreamState = useCallback(() => {
    livePaperBacktestMarkersRef.current = [];
    livePaperTradesRef.current = [];
    livePaperEventsRef.current = [];
    livePaperLastTradeIdRef.current = null;
    livePaperLastEventIdRef.current = null;
    setLivePaperTrades([]);
    setLivePaperEvents([]);
    setLivePaperChartMarkers([]);
  }, []);

  const setLivePaperSessionStartSnapshot = useCallback(
    (
      profile: LivePaperProfileRead | null,
      trades: LivePaperTradeRead[],
      events: LivePaperEventRead[],
    ) => {
      setLivePaperSessionStartTradeId(getMaxEntityId(trades) ?? 0);
      setLivePaperSessionStartEventId(getMaxEntityId(events) ?? 0);
      setLivePaperSessionStartRevision(profile?.strategy_revision ?? null);
      setLivePaperSessionStartAt(new Date().toISOString());
    },
    [],
  );

  const fetchLivePaperPoll = useCallback(async (fromStart = false) => {
    const response = await pollLivePaper({
      last_trade_id: fromStart
        ? undefined
        : (livePaperLastTradeIdRef.current ?? undefined),
      last_event_id: fromStart
        ? undefined
        : (livePaperLastEventIdRef.current ?? undefined),
      limit: 500,
    });

    setLivePaperProfile(response.profile ?? null);
    const incomingLiveTrades = response.live_trades_since_start ?? [];
    const incomingEvents = response.events ?? [];
    const nextTrades = mergeUniqueById(livePaperTradesRef.current, incomingLiveTrades);
    const nextEvents = mergeUniqueById(livePaperEventsRef.current, incomingEvents);
    livePaperTradesRef.current = nextTrades;
    livePaperEventsRef.current = nextEvents;
    setLivePaperTrades(nextTrades);
    setLivePaperEvents(nextEvents);
    applyLivePaperChartMarkers(nextTrades);

    const maxTradeId = getMaxEntityId(nextTrades);
    const maxEventId = getMaxEntityId(nextEvents);
    livePaperLastTradeIdRef.current = maxTradeId;
    livePaperLastEventIdRef.current = maxEventId;
    setLivePaperMetrics(parseLivePaperMetrics(response.metrics));

    const switched = incomingEvents.some(
      (event) => event.event_type === "strategy_switched",
    );
    if (switched) {
      setLivePaperSessionStartSnapshot(response.profile ?? null, nextTrades, nextEvents);
      const switchedStrategyId = response.profile?.strategy_id;
      if (activeTab === "live" && typeof switchedStrategyId === "number") {
        void runLivePaperHistoryBacktestById(switchedStrategyId).catch(() => {
          // Keep live polling resilient even if history refresh fails.
        });
      }
    }

    return { response, nextTrades, nextEvents };
  }, [
    activeTab,
    applyLivePaperChartMarkers,
    parseLivePaperMetrics,
    runLivePaperHistoryBacktestById,
    setLivePaperSessionStartSnapshot,
  ]);

  useEffect(() => {
    let cancelled = false;
    const hydrateLivePaperState = async () => {
      try {
        const { response, nextTrades, nextEvents } = await fetchLivePaperPoll(true);
        if (cancelled) {
          return;
        }
        const profile = response.profile ?? null;
        const isRunning = Boolean(profile?.is_running);
        setLivePaperProfile(profile);
        setLivePaperIsRunning(isRunning);
        if (isRunning) {
          setLivePaperSessionStartSnapshot(profile, nextTrades, nextEvents);
          if (activeTab === "live" && typeof profile?.strategy_id === "number") {
            await runLivePaperHistoryBacktestById(profile.strategy_id);
          }
        }
      } catch {
        // Live paper may be uninitialized for user; keep UI in default state.
      }
    };
    void hydrateLivePaperState();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    fetchLivePaperPoll,
    runLivePaperHistoryBacktestById,
    setLivePaperSessionStartSnapshot,
  ]);

  const handleSaveLivePaperProfile = async () => {
    setLivePaperIsSavingProfile(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const previousStrategyId = livePaperProfile?.strategy_id ?? null;
      const profile = await saveLivePaperProfile();
      if (livePaperIsRunning) {
        const { nextTrades, nextEvents } = await fetchLivePaperPoll();
        if (previousStrategyId !== null && previousStrategyId !== profile.strategy_id) {
          setLivePaperSessionStartSnapshot(profile, nextTrades, nextEvents);
          if (activeTab === "live") {
            await runLivePaperHistoryBacktestById(profile.strategy_id);
          }
          setInfoMessage("Live paper profile saved and strategy switched");
        } else {
          setInfoMessage("Live paper profile saved");
        }
      } else {
        setInfoMessage("Live paper profile saved");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save live profile";
      if (message.includes("422") || message.includes("validation")) {
        setErrorMessage(
          "Profile validation failed: per_trade_usdt must be less than or equal to total_balance_usdt",
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLivePaperIsSavingProfile(false);
    }
  };

  const handlePlayLivePaper = async () => {
    setLivePaperIsPlaying(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const profile = await saveLivePaperProfile();
      const response = await playLivePaper();
      const activeProfile = response.profile ?? profile;
      setLivePaperProfile(response.profile ?? null);
      setLivePaperIsRunning(Boolean(response.profile?.is_running));
      resetLivePaperStreamState();
      setLivePaperPollNonce((value) => value + 1);
      const { response: pollResponse, nextTrades, nextEvents } =
        await fetchLivePaperPoll(true);
      setLivePaperSessionStartSnapshot(
        pollResponse.profile ?? activeProfile,
        nextTrades,
        nextEvents,
      );
      if (activeTab === "live") {
        await runLivePaperHistoryBacktestById(activeProfile.strategy_id);
      }
      setInfoMessage("Live paper started");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start live paper";
      if (message.includes("422") || message.includes("validation")) {
        setErrorMessage(
          "Profile validation failed: per_trade_usdt must be less than or equal to total_balance_usdt",
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLivePaperIsPlaying(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "live" || !livePaperIsRunning) {
      return;
    }
    const strategyId = livePaperProfile?.strategy_id;
    if (typeof strategyId !== "number") {
      return;
    }
    void runLivePaperHistoryBacktestById(strategyId).catch(() => {
      // Keep live tab responsive even if backtest history request fails.
    });
  }, [activeTab, livePaperIsRunning, livePaperProfile?.strategy_id, runLivePaperHistoryBacktestById]);

  const handleStopLivePaper = async () => {
    setLivePaperIsStopping(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const response = await stopLivePaper();
      setLivePaperProfile(response.profile ?? null);
      setLivePaperIsRunning(Boolean(response.profile?.is_running));
      setLivePaperPollNonce((value) => value + 1);
      setInfoMessage("Live paper stopped");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to stop live paper",
      );
    } finally {
      setLivePaperIsStopping(false);
    }
  };

  useEffect(() => {
    if (!livePaperIsRunning) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      if (cancelled) {
        return;
      }
      try {
        await fetchLivePaperPoll();
      } catch {
        // Preserve previous data when a single polling request fails.
      }
    };

    void run();
    const id = window.setInterval(() => {
      void run();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fetchLivePaperPoll, livePaperIsRunning, livePaperPollNonce]);

  const refreshPersonalAnalysisData = useCallback(async () => {
    const [defaults, profiles] = await Promise.all([
      getPersonalAnalysisDefaults(),
      listPersonalAnalysisProfiles(),
    ]);
    setPersonalDefaults(defaults);
    setPersonalProfiles(profiles);
    return { defaults, profiles };
  }, []);

  const loadPersonalHistory = useCallback(
    async (params: { profileId?: number; before?: string; append?: boolean }) => {
      const profileId = params.profileId;
      if (!profileId) {
        setPersonalHistory([]);
        setPersonalHistoryBefore(null);
        return [];
      }
      setIsPersonalHistoryLoading(true);
      try {
        const rows = await listPersonalAnalysisHistory({
          profileId,
          limit: 25,
          before: params.before,
        });
        setPersonalHistory((current) =>
          params.append ? [...current, ...rows] : rows,
        );
        const last = rows[rows.length - 1];
        setPersonalHistoryBefore(last?.created_at ?? null);
        return rows;
      } finally {
        setIsPersonalHistoryLoading(false);
      }
    },
    [],
  );

  const loadPersonalLatest = useCallback(async (profileId?: number) => {
    if (!profileId) {
      setPersonalLatest(null);
      return null;
    }
    try {
      const latest = await getPersonalAnalysisLatest({ profileId });
      setPersonalLatest(latest);
      return latest;
    } catch {
      setPersonalLatest(null);
      return null;
    }
  }, []);

  const fetchAndApplyAnalysisRuns = useCallback(async (limit = 50) => {
    const response = await listAnalysisRuns({ limit });
    const runs = response.runs ?? [];
    setAnalysisRuns(runs);
    setLatestAnalysisRun(runs[0] ?? null);
    return runs;
  }, []);

  const refreshAnalysisRuns = async (limit = 50) => {
    await runWithPendingAction("refresh_analysis", async () => {
      setIsAnalysisLoading(true);
      try {
        await fetchAndApplyAnalysisRuns(limit);
      } finally {
        setIsAnalysisLoading(false);
      }
    });
  };

  const refreshPersonalTab = useCallback(async () => {
    setIsPersonalLoading(true);
    try {
      await refreshPersonalAnalysisData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load personal analysis data",
      );
    } finally {
      setIsPersonalLoading(false);
    }
  }, [refreshPersonalAnalysisData]);

  const resetPersonalProfileForm = () => {
    setSelectedPersonalProfileId(null);
    setPersonalProfileForm(toPersonalProfileForm(personalDefaults, null, symbol));
  };

  const savePersonalProfile = async () => {
    const enabledAgentCount = countEnabledAgents(personalProfileForm.agents);
    if (!enabledAgentCount) {
      setErrorMessage("At least one agent must be enabled.");
      return;
    }
    if (
      personalProfileForm.intervalMinutes < 5 ||
      personalProfileForm.intervalMinutes > 1440
    ) {
      setErrorMessage("Interval must be between 5 and 1440 minutes.");
      return;
    }
    for (const [agent, rawWeight] of Object.entries(
      personalProfileForm.agentWeights,
    )) {
      if (!Number.isFinite(rawWeight) || rawWeight < 0 || rawWeight > 1) {
        setErrorMessage(
          `Weight for "${agent}" must be a number between 0.0 and 1.0.`,
        );
        return;
      }
    }

    setErrorMessage("");
    setInfoMessage("");
    setIsPersonalSavePending(true);
    try {
      const payload = {
        symbol: personalProfileForm.symbol.trim(),
        query_prompt: personalProfileForm.queryPrompt.trim() || null,
        agents: personalProfileForm.agents,
        agent_weights: personalProfileForm.agentWeights,
        interval_minutes: Math.round(personalProfileForm.intervalMinutes),
      };
      if (!payload.symbol) {
        setErrorMessage("Symbol is required.");
        return;
      }

      const saved = personalProfileForm.id
        ? await updatePersonalAnalysisProfile(personalProfileForm.id, payload)
        : await createPersonalAnalysisProfile(payload);
      await refreshPersonalAnalysisData();
      setSelectedPersonalProfileId(saved.id);
      setInfoMessage(
        personalProfileForm.id
          ? "Personal profile updated successfully."
          : "Personal profile created successfully.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save personal analysis profile",
      );
    } finally {
      setIsPersonalSavePending(false);
    }
  };

  const deletePersonalProfile = async (profileId: number) => {
    setErrorMessage("");
    setInfoMessage("");
    setIsPersonalSavePending(true);
    try {
      await deletePersonalAnalysisProfile(profileId);
      await refreshPersonalAnalysisData();
      setPersonalLatest(null);
      setPersonalHistory([]);
      setPersonalHistoryBefore(null);
      setInfoMessage("Personal profile deactivated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to deactivate personal profile",
      );
    } finally {
      setIsPersonalSavePending(false);
    }
  };

  const triggerPersonalAnalysis = async () => {
    if (!selectedPersonalProfile) {
      setErrorMessage("Select a profile first.");
      return;
    }
    setErrorMessage("");
    setInfoMessage("");
    setIsPersonalTriggerPending(true);
    try {
      const response = await triggerPersonalAnalysisProfile(
        selectedPersonalProfile.id,
        {
          query_prompt: personalProfileForm.queryPrompt.trim() || null,
          agents: personalProfileForm.agents,
          agent_weights: personalProfileForm.agentWeights,
        },
      );
      setPersonalPollingJobId(response.trade_job_id || response.core_job_id);
      setInfoMessage("Personal analysis job started.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to trigger personal analysis job",
      );
    } finally {
      setIsPersonalTriggerPending(false);
    }
  };

  const triggerAnalysisJob = async () => {
    await runWithPendingAction("trigger_analysis", async () => {
      setIsTriggeringAnalysis(true);
      setErrorMessage("");
      setInfoMessage("");
      try {
        const trigger = await triggerAnalysisNow();
        setInfoMessage(trigger.message);
        const runs = await fetchAndApplyAnalysisRuns(50);
        const triggeredRun = runs.find((item) => item._id === trigger.jobId);
        if (triggeredRun && triggeredRun.status !== "running") {
          setInfoMessage(
            triggeredRun.status === "success"
              ? "AI analysis completed successfully"
              : `AI analysis failed${triggeredRun.error ? `: ${triggeredRun.error}` : ""}`,
          );
          setAnalysisPollingJobId(null);
        } else {
          setAnalysisPollingJobId(trigger.jobId);
          setInfoMessage("Analysis successfully started");
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to trigger AI analysis",
        );
      } finally {
        setIsTriggeringAnalysis(false);
      }
    });
  };

  useEffect(() => {
    if (activeTab !== "analysis" || !analysisPollingJobId) {
      setIsAnalysisAutoRefreshing(false);
      return;
    }

    let isCancelled = false;
    let isPollingRequestInFlight = false;

    const poll = async () => {
      if (isCancelled || isPollingRequestInFlight) {
        return;
      }
      isPollingRequestInFlight = true;
      setIsAnalysisAutoRefreshing(true);
      try {
        const runs = await fetchAndApplyAnalysisRuns(50);
        const triggeredRun = runs.find(
          (item) => item._id === analysisPollingJobId,
        );
        if (triggeredRun && triggeredRun.status !== "running") {
          setAnalysisPollingJobId(null);
          setInfoMessage(
            triggeredRun.status === "success"
              ? "AI analysis completed successfully"
              : `AI analysis failed${triggeredRun.error ? `: ${triggeredRun.error}` : ""}`,
          );
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to auto-refresh analysis status",
          );
        }
      } finally {
        isPollingRequestInFlight = false;
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      setIsAnalysisAutoRefreshing(false);
    };
  }, [activeTab, analysisPollingJobId, fetchAndApplyAnalysisRuns]);

  useEffect(() => {
    if (activeTab !== "analysis" || analysisMode !== "personal") {
      return;
    }
    if (personalDefaults && personalProfiles.length > 0) {
      return;
    }
    void refreshPersonalTab();
  }, [
    activeTab,
    analysisMode,
    personalDefaults,
    personalProfiles.length,
    refreshPersonalTab,
  ]);

  useEffect(() => {
    if (!selectedPersonalProfile?.id) {
      setPersonalLatest(null);
      setPersonalHistory([]);
      setPersonalHistoryBefore(null);
      return;
    }
    void loadPersonalLatest(selectedPersonalProfile.id);
    void loadPersonalHistory({ profileId: selectedPersonalProfile.id });
  }, [selectedPersonalProfile?.id, loadPersonalHistory, loadPersonalLatest]);

  useEffect(() => {
    if (
      activeTab !== "analysis" ||
      analysisMode !== "personal" ||
      !personalPollingJobId
    ) {
      return;
    }
    let cancelled = false;
    let isInFlight = false;

    const poll = async () => {
      if (cancelled || isInFlight) {
        return;
      }
      isInFlight = true;
      try {
        const job = await getPersonalAnalysisJob(personalPollingJobId);
        if (cancelled) {
          return;
        }
        setPersonalJobStatus(job);
        if (job.status === "completed") {
          setPersonalPollingJobId(null);
          setInfoMessage("Personal analysis completed successfully.");
          await Promise.all([
            loadPersonalLatest(job.profile_id),
            loadPersonalHistory({ profileId: job.profile_id }),
            refreshPersonalAnalysisData(),
          ]);
        } else if (job.status === "failed") {
          setPersonalPollingJobId(null);
          setErrorMessage(job.error ?? "Personal analysis job failed.");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to poll personal analysis job",
          );
        }
      } finally {
        isInFlight = false;
      }
    };

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    activeTab,
    analysisMode,
    loadPersonalHistory,
    loadPersonalLatest,
    personalPollingJobId,
    refreshPersonalAnalysisData,
  ]);

  const activeMeta = TAB_META[activeTab];
  const riskCalculation = useMemo(() => {
    try {
      return {
        result: calculatePosition(riskCalculator),
        error: "",
      };
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error ? error.message : "Risk calculation failed",
      };
    }
  }, [riskCalculator]);
  return (
    <main className="relative mx-auto min-h-screen w-full max-w-[1600px] p-3 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3 md:mb-6">
        <div className="flex items-center gap-2">
          <Button
            className="lg:hidden"
            variant="outline"
            size="icon"
            aria-label={
              isSidebarOpen ? "Close parameters menu" : "Open parameters menu"
            }
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            {isSidebarOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
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

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
        <aside
          className={`z-20 space-y-4 rounded-xl border border-border/80 bg-card/90 p-3 shadow-sm transition [scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border lg:sticky lg:top-20 lg:h-[calc(100vh-7.75rem)] lg:overflow-auto ${
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

          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
            <button
              type="button"
              onClick={() => setIsRiskCalculatorCollapsed((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between text-left"
              aria-expanded={!isRiskCalculatorCollapsed}
              aria-label={
                isRiskCalculatorCollapsed
                  ? "Expand risk calculator"
                  : "Collapse risk calculator"
              }
            >
              <p className="text-xs font-medium uppercase tracking-wide">
                Risk calculator
              </p>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  isRiskCalculatorCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>
            {!isRiskCalculatorCollapsed ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <NumericField
                    label="Risk (USDT)"
                    value={riskCalculator.riskUsd}
                    onChange={(value) =>
                      setRiskCalculator((prev) => ({ ...prev, riskUsd: value }))
                    }
                    min={0}
                  />
                  <NumericField
                    label="Fee (%)"
                    value={riskCalculator.feePercent}
                    onChange={(value) =>
                      setRiskCalculator((prev) => ({
                        ...prev,
                        feePercent: value,
                      }))
                    }
                    min={0}
                    step={0.001}
                  />
                  <NumericField
                    label="Entry"
                    value={riskCalculator.entryPrice}
                    onChange={(value) =>
                      setRiskCalculator((prev) => ({
                        ...prev,
                        entryPrice: value,
                      }))
                    }
                    min={0}
                    step={0.0001}
                  />
                  <NumericField
                    label="Stop loss"
                    value={riskCalculator.stopLoss}
                    onChange={(value) =>
                      setRiskCalculator((prev) => ({
                        ...prev,
                        stopLoss: value,
                      }))
                    }
                    min={0}
                    step={0.0001}
                  />
                  <div className="sm:col-span-2">
                    <NumericField
                      label="RR ratio"
                      value={riskCalculator.rrRatio}
                      onChange={(value) =>
                        setRiskCalculator((prev) => ({
                          ...prev,
                          rrRatio: value,
                        }))
                      }
                      min={0.1}
                      step={0.1}
                    />
                  </div>
                </div>
                {riskCalculation.error ? (
                  <p className="rounded-md border border-destructive/35 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    {riskCalculation.error}
                  </p>
                ) : null}
                {riskCalculation.result ? (
                  <div className="space-y-2 rounded-md border border-border/70 bg-background/35 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Direction
                      </span>
                      <Badge
                        variant={
                          riskCalculation.result.meta.direction === "LONG"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {riskCalculation.result.meta.direction}
                      </Badge>
                    </div>
                    <div className="grid gap-1 text-xs">
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">
                          Position size
                        </span>
                        <span className="font-medium">
                          {formatCellValue(
                            riskCalculation.result.position.sizeCoins,
                          )}{" "}
                          / $
                          {formatCellValue(
                            riskCalculation.result.position.sizeUsdt,
                          )}
                        </span>
                      </p>
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">
                          Take profit
                        </span>
                        <span className="font-medium">
                          {formatCellValue(
                            riskCalculation.result.scenarios.takeProfit.price,
                          )}
                        </span>
                      </p>
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">
                          Stop-loss total
                        </span>
                        <span className="font-medium text-red-300">
                          {formatCellValue(
                            riskCalculation.result.scenarios.stopLoss.totalLoss,
                          )}
                        </span>
                      </p>
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">
                          TP net profit
                        </span>
                        <span
                          className={formatSignedToneClass(
                            riskCalculation.result.scenarios.takeProfit
                              .netProfit,
                          )}
                        >
                          {formatCellValue(
                            riskCalculation.result.scenarios.takeProfit
                              .netProfit,
                          )}
                        </span>
                      </p>
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Real RR</span>
                        <span
                          className={formatSignedToneClass(
                            riskCalculation.result.scenarios.takeProfit.realRR,
                          )}
                        >
                          {formatCellValue(
                            riskCalculation.result.scenarios.takeProfit.realRR,
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Market
            </p>
            <Label text="Symbol" />
            <select
              className={INPUT_CLASS}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {(marketMeta?.symbols.length
                ? marketMeta.symbols
                : ["BTC/USDT"]
              ).map((item) => (
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
              {(marketMeta?.timeframes.length
                ? marketMeta.timeframes
                : TIMEFRAMES
              ).map((item) => (
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
            <Button
              onClick={() => void runBuilder()}
              disabled={isActionPending("run_builder")}
            >
              {isActionPending("run_builder") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isActionPending("run_builder") ? "Running..." : "Run Builder"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runSavedStrategy()}
              disabled={isActionPending("run_saved")}
            >
              {isActionPending("run_saved") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isActionPending("run_saved")
                ? "Running..."
                : "Run Saved Strategy"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runPortfolio()}
              disabled={isActionPending("run_portfolio")}
            >
              {isActionPending("run_portfolio") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isActionPending("run_portfolio")
                ? "Running..."
                : "Run Portfolio"}
            </Button>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {activeTab === "analysis" ? (
            <Card className={CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">
                  AI Analysis mode
                </CardTitle>
                <CardDescription>
                  Switch between global Core runs and your personal profiles.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={analysisMode === "global" ? "default" : "outline"}
                  onClick={() => setAnalysisMode("global")}
                >
                  Global
                </Button>
                <Button
                  size="sm"
                  variant={analysisMode === "personal" ? "default" : "outline"}
                  onClick={() => setAnalysisMode("personal")}
                >
                  Personal
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {activeTab !== "audit" ? (
            <Card className={CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">
                  Chart & Analytics
                </CardTitle>
                <CardDescription>
                  Candlestick chart with overlays and trade markers ({symbol},{" "}
                  {timeframe})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-muted/25 p-2 md:p-4">
                  <MarketChart
                    candles={candles}
                    overlays={overlays}
                    markers={activeTab === "live" ? livePaperChartMarkers : chartMarkers}
                  />
                </div>
                <p className="text-xs text-muted-foreground md:text-sm">
                  Tip: switch sections on the left to run scenarios quickly and
                  compare results on the same chart.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className={`${CARD_CLASS} min-w-0`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">
                {activeMeta.title}
              </CardTitle>
              <CardDescription>{activeMeta.description}</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
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
                  metrics={backtestMetrics}
                  equityCurveSeries={equityCurveSeries}
                  latestBacktest={latestBacktest}
                  trendExtraction={latestTrendExtraction}
                  analysisStructured={
                    latestAnalysisRun?.analysisStructured ?? null
                  }
                  isRunning={isActionPending("run_builder")}
                  isSaving={isActionPending("save_strategy")}
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
                  metrics={backtestMetrics}
                  equityCurveSeries={equityCurveSeries}
                  isRunSavedPending={isActionPending("run_saved")}
                  isDeletePending={isActionPending("delete_strategy")}
                  isRunAtrPending={isActionPending("run_atr")}
                  isRunKnifePending={isActionPending("run_knife")}
                  isRunGridPending={isActionPending("run_grid")}
                  isRunIntradayPending={isActionPending("run_intraday")}
                />
              ) : null}
              {activeTab === "live" ? (
                <LiveSignalsTab
                  activeStrategy={activeLiveStrategy}
                  onStrategyChange={setActiveLiveStrategy}
                  execution={liveExecutionForm}
                  onExecutionChange={setLiveExecutionForm}
                  exchangeAccounts={exchangeAccounts}
                  latestSignal={latestLiveSignal}
                  onRun={runLiveSignal}
                  trendExtraction={latestTrendExtraction}
                  analysisStructured={
                    latestAnalysisRun?.analysisStructured ?? null
                  }
                  isRunPending={isActionPending("run_live_signal")}
                  catalog={catalog}
                  isCatalogLoading={isCatalogLoading}
                  selectedStrategyId={selectedStrategyId}
                  strategyList={strategyList}
                  onSelectedStrategyChange={setSelectedStrategyId}
                  livePaperSource={livePaperSource}
                  onLivePaperSourceChange={setLivePaperSource}
                  livePaperBuiltInStrategy={livePaperBuiltInStrategy}
                  onLivePaperBuiltInStrategyChange={setLivePaperBuiltInStrategy}
                  atrForm={atrForm}
                  onAtrFormChange={setAtrForm}
                  knifeForm={knifeForm}
                  onKnifeFormChange={setKnifeForm}
                  gridForm={gridForm}
                  onGridFormChange={setGridForm}
                  intradayForm={intradayForm}
                  onIntradayFormChange={setIntradayForm}
                  knifeSideOptions={knifeSideOptions}
                  knifeEntryModeLongOptions={knifeEntryModeLongOptions}
                  knifeEntryModeShortOptions={knifeEntryModeShortOptions}
                  intradaySideOptions={intradaySideOptions}
                  livePaperTotalBalanceUsdt={livePaperTotalBalanceUsdt}
                  onLivePaperTotalBalanceUsdtChange={setLivePaperTotalBalanceUsdt}
                  livePaperPerTradeUsdt={livePaperPerTradeUsdt}
                  onLivePaperPerTradeUsdtChange={setLivePaperPerTradeUsdt}
                  livePaperProfile={livePaperProfile}
                  livePaperIsRunning={livePaperIsRunning}
                  livePaperMetrics={livePaperMetrics}
                  livePaperSessionStats={livePaperSessionStats}
                  livePaperTrades={livePaperTrades}
                  livePaperEvents={livePaperEvents}
                  onSaveLivePaperProfile={handleSaveLivePaperProfile}
                  onPlayLivePaper={handlePlayLivePaper}
                  onStopLivePaper={handleStopLivePaper}
                  isLivePaperSavingProfile={livePaperIsSavingProfile}
                  isLivePaperPlaying={livePaperIsPlaying}
                  isLivePaperStopping={livePaperIsStopping}
                />
              ) : null}
              {activeTab === "analysis" ? (
                <AnalysisTab
                  mode={analysisMode}
                  runs={analysisRuns}
                  selectedRun={selectedAnalysisRun}
                  selectedRunId={selectedAnalysisId}
                  isLoading={isAnalysisLoading}
                  isTriggering={isTriggeringAnalysis}
                  isAutoRefreshing={isAnalysisAutoRefreshing}
                  isRefreshPending={isActionPending("refresh_analysis")}
                  isTriggerPending={isActionPending("trigger_analysis")}
                  onSelectRun={setSelectedAnalysisId}
                  onRefresh={() => void refreshAnalysisRuns()}
                  onTrigger={() => void triggerAnalysisJob()}
                  personalDefaults={personalDefaults}
                  personalProfiles={personalProfiles}
                  selectedPersonalProfileId={selectedPersonalProfile?.id ?? null}
                  personalProfileForm={personalProfileForm}
                  personalLatest={personalLatest}
                  personalHistory={personalHistory}
                  personalHistoryBefore={personalHistoryBefore}
                  personalJobStatus={personalJobStatus}
                  isPersonalLoading={isPersonalLoading}
                  isPersonalSavePending={isPersonalSavePending}
                  isPersonalTriggerPending={isPersonalTriggerPending}
                  isPersonalHistoryLoading={isPersonalHistoryLoading}
                  isPersonalPolling={Boolean(personalPollingJobId)}
                  availablePersonalAgents={availablePersonalAgents}
                  onModeChange={setAnalysisMode}
                  onRefreshPersonal={() => void refreshPersonalTab()}
                  onSelectPersonalProfile={setSelectedPersonalProfileId}
                  onPersonalProfileFormChange={(value) =>
                    setPersonalProfileForm(value)
                  }
                  onResetPersonalProfile={resetPersonalProfileForm}
                  onSavePersonalProfile={() => void savePersonalProfile()}
                  onDeletePersonalProfile={(id) => void deletePersonalProfile(id)}
                  onTriggerPersonal={() => void triggerPersonalAnalysis()}
                  onLoadMorePersonalHistory={() =>
                    void loadPersonalHistory({
                      profileId: selectedPersonalProfile?.id,
                      before: personalHistoryBefore ?? undefined,
                      append: true,
                    })
                  }
                />
              ) : null}
              {activeTab === "portfolio" ? (
                <PortfolioTab
                  strategyList={strategyList}
                  userSelection={portfolioUserSelection}
                  onUserSelection={setPortfolioUserSelection}
                  userAllocations={portfolioUserAllocations}
                  onUserAllocations={setPortfolioUserAllocations}
                  builtinSelection={portfolioBuiltinSelection}
                  onBuiltinSelection={setPortfolioBuiltinSelection}
                  builtinAllocations={portfolioBuiltinAllocations}
                  onBuiltinAllocations={setPortfolioBuiltinAllocations}
                  builtinParams={portfolioBuiltinParams}
                  onBuiltinParams={setPortfolioBuiltinParams}
                  atrForm={atrForm}
                  onAtrFormChange={setAtrForm}
                  knifeForm={knifeForm}
                  onKnifeFormChange={setKnifeForm}
                  gridForm={gridForm}
                  onGridFormChange={setGridForm}
                  intradayForm={intradayForm}
                  onIntradayFormChange={setIntradayForm}
                  capital={portfolioCapital}
                  onCapital={setPortfolioCapital}
                  asyncJob={portfolioAsyncJob}
                  onAsyncJob={setPortfolioAsyncJob}
                  onRun={runPortfolio}
                  latestPortfolio={latestPortfolio}
                  catalog={catalog}
                  isRunPending={isActionPending("run_portfolio")}
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
            onSelectStrategy(
              event.target.value ? Number(event.target.value) : null,
            )
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
    return (
      <p className="text-xs text-muted-foreground">
        Configure signal and execution in the main panel.
      </p>
    );
  }

  if (activeTab === "analysis") {
    return (
      <p className="text-xs text-muted-foreground">
        Browse runs and trigger analysis in the main panel.
      </p>
    );
  }

  return (
    <TextField
      label="Audit search"
      value={auditFilter}
      onChange={onAuditFilter}
    />
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
  metrics,
  equityCurveSeries,
  latestBacktest,
  trendExtraction,
  analysisStructured,
  isRunning,
  isSaving,
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
  metrics: ReturnType<typeof normalizeBacktestMetrics>;
  equityCurveSeries: Array<{ time: CandlePoint["time"]; value: number }>;
  latestBacktest: BacktestResponse | null;
  trendExtraction: AnalysisTrendExtraction | null;
  analysisStructured: JsonRecord | null;
  isRunning: boolean;
  isSaving: boolean;
}) {
  const maxPositionUsdt = maxPositionPctToUsdt(
    builderForm.account_balance,
    builderForm.max_position_pct,
  );

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
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, rr: value })
          }
        />
        <NumericField
          label="ATR Mult"
          value={builderForm.atr_mult}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, atr_mult: value })
          }
        />
        <NumericField
          label="Cooldown Bars"
          value={builderForm.cooldown_bars}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, cooldown_bars: value })
          }
        />
        <NumericField
          label="Account Balance"
          value={builderForm.account_balance}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, account_balance: value })
          }
        />
        <NumericField
          label="Risk %"
          value={builderForm.risk_per_trade}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, risk_per_trade: value })
          }
        />
        <NumericField
          label="Max Positions"
          value={builderForm.max_positions}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, max_positions: value })
          }
        />
        <NumericField
          label="Max Position USDT"
          value={maxPositionUsdt}
          onChange={(value) =>
            onBuilderFormChange({
              ...builderForm,
              max_position_pct: maxPositionUsdtToPct(
                builderForm.account_balance,
                value,
              ),
            })
          }
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
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, swing_lookback: value })
          }
        />
        <NumericField
          label="Swing Buffer ATR"
          value={builderForm.swing_buffer_atr}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, swing_buffer_atr: value })
          }
        />
        <NumericField
          label="OB Impulse ATR"
          value={builderForm.ob_impulse_atr}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, ob_impulse_atr: value })
          }
        />
        <NumericField
          label="OB Buffer ATR"
          value={builderForm.ob_buffer_atr}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, ob_buffer_atr: value })
          }
        />
        <NumericField
          label="OB Lookback"
          value={builderForm.ob_lookback}
          onChange={(value) =>
            onBuilderFormChange({ ...builderForm, ob_lookback: value })
          }
        />
      </div>

      <AiLevelsHint
        trendExtraction={trendExtraction}
        analysisStructured={analysisStructured}
      />

      <div className="space-y-2">
        <Label text="Enabled indicators" />
        <div className="grid gap-2 md:grid-cols-3">
          {indicatorOptions.map((indicator) => {
            const checked = builderForm.enabled?.includes(indicator) ?? false;
            return (
              <label
                key={indicator}
                className="flex items-center gap-2 text-sm"
              >
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
                    onBuilderFormChange({
                      ...builderForm,
                      enabled: Array.from(prev),
                    });
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
        <TextField
          label="Strategy Name"
          value={builderName}
          onChange={onBuilderNameChange}
        />
        <TextField
          label="Audit Reason"
          value={auditReason}
          onChange={onAuditReasonChange}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void onRun()} disabled={isRunning}>
          {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isRunning ? "Running..." : "Run VWAP Backtest"}
        </Button>
        <Button
          variant="outline"
          onClick={() => void onSave()}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? "Saving..." : "Save Strategy"}
        </Button>
      </div>
      <KpiGrid rows={kpiRows} />
      <BacktestEquitySection
        latestBacktest={latestBacktest}
        metrics={metrics}
        equityCurveSeries={equityCurveSeries}
      />
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
  metrics,
  equityCurveSeries,
  isRunSavedPending,
  isDeletePending,
  isRunAtrPending,
  isRunKnifePending,
  isRunGridPending,
  isRunIntradayPending,
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
  metrics: ReturnType<typeof normalizeBacktestMetrics>;
  equityCurveSeries: Array<{ time: CandlePoint["time"]; value: number }>;
  isRunSavedPending: boolean;
  isDeletePending: boolean;
  isRunAtrPending: boolean;
  isRunKnifePending: boolean;
  isRunGridPending: boolean;
  isRunIntradayPending: boolean;
}) {
  const [activeBuiltInStrategy, setActiveBuiltInStrategy] =
    useState<BuiltInStrategyKey>("atr");
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
      .filter(
        (item): item is { key: BuiltInStrategyKey; label: string } =>
          item !== null,
      );
  }, [catalog?.portfolio.builtin_strategies]);

  const activeBuiltInStrategyKey = builtInStrategyItems.some(
    (item) => item.key === activeBuiltInStrategy,
  )
    ? activeBuiltInStrategy
    : (builtInStrategyItems[0]?.key ?? null);

  const knifeSideOptions = catalog?.knife_catcher.sides?.length
    ? catalog.knife_catcher.sides
    : [knifeForm.side];
  const knifeEntryModeLongOptions = catalog?.knife_catcher.entry_mode_long
    ?.length
    ? catalog.knife_catcher.entry_mode_long
    : [knifeForm.entry_mode_long];
  const knifeEntryModeShortOptions = catalog?.knife_catcher.entry_mode_short
    ?.length
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
            onSelectStrategy(
              event.target.value ? Number(event.target.value) : null,
            )
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
        <Button onClick={() => void onRunSaved()} disabled={isRunSavedPending}>
          {isRunSavedPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isRunSavedPending ? "Running..." : "Run Saved Strategy"}
        </Button>
        <Button
          variant="outline"
          onClick={() => void onDelete()}
          disabled={isDeletePending}
        >
          {isDeletePending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isDeletePending ? "Deleting..." : "Delete Saved Strategy"}
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
                  variant={
                    activeBuiltInStrategyKey === strategy.key
                      ? "default"
                      : "outline"
                  }
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
            <AtrStrategyForm
              value={atrForm}
              onChange={onAtrFormChange}
              onRun={onRunAtr}
              isRunning={isRunAtrPending}
            />
          ) : null}
          {activeBuiltInStrategyKey === "knife" ? (
            <KnifeStrategyForm
              value={knifeForm}
              onChange={onKnifeFormChange}
              onRun={onRunKnife}
              sideOptions={knifeSideOptions}
              entryModeLongOptions={knifeEntryModeLongOptions}
              entryModeShortOptions={knifeEntryModeShortOptions}
              isRunning={isRunKnifePending}
            />
          ) : null}
          {activeBuiltInStrategyKey === "grid" ? (
            <GridStrategyForm
              value={gridForm}
              onChange={onGridFormChange}
              onRun={onRunGrid}
              isRunning={isRunGridPending}
            />
          ) : null}
          {activeBuiltInStrategyKey === "intraday" ? (
            <IntradayStrategyForm
              value={intradayForm}
              onChange={onIntradayFormChange}
              onRun={onRunIntraday}
              sideOptions={intradaySideOptions}
              isRunning={isRunIntradayPending}
            />
          ) : null}
        </>
      )}

      <BacktestEquitySection
        latestBacktest={latestBacktest}
        metrics={metrics}
        equityCurveSeries={equityCurveSeries}
      />
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
  execution,
  onExecutionChange,
  exchangeAccounts,
  latestSignal,
  onRun,
  trendExtraction,
  analysisStructured,
  isRunPending,
  catalog,
  isCatalogLoading,
  selectedStrategyId,
  strategyList,
  onSelectedStrategyChange,
  livePaperSource,
  onLivePaperSourceChange,
  livePaperBuiltInStrategy,
  onLivePaperBuiltInStrategyChange,
  atrForm,
  onAtrFormChange,
  knifeForm,
  onKnifeFormChange,
  gridForm,
  onGridFormChange,
  intradayForm,
  onIntradayFormChange,
  knifeSideOptions,
  knifeEntryModeLongOptions,
  knifeEntryModeShortOptions,
  intradaySideOptions,
  livePaperTotalBalanceUsdt,
  onLivePaperTotalBalanceUsdtChange,
  livePaperPerTradeUsdt,
  onLivePaperPerTradeUsdtChange,
  livePaperProfile,
  livePaperIsRunning,
  livePaperMetrics,
  livePaperSessionStats,
  livePaperTrades,
  livePaperEvents,
  onSaveLivePaperProfile,
  onPlayLivePaper,
  onStopLivePaper,
  isLivePaperSavingProfile,
  isLivePaperPlaying,
  isLivePaperStopping,
}: {
  activeStrategy: LiveStrategyKey;
  onStrategyChange: (value: LiveStrategyKey) => void;
  execution: LiveExecutionFormState;
  onExecutionChange: (value: LiveExecutionFormState) => void;
  exchangeAccounts: ExchangeAccountRead[];
  latestSignal: LiveSignalResult | null;
  onRun: () => Promise<void>;
  trendExtraction: AnalysisTrendExtraction | null;
  analysisStructured: JsonRecord | null;
  isRunPending: boolean;
  catalog: BacktestCatalogResponse | null;
  isCatalogLoading: boolean;
  selectedStrategyId: number | null;
  strategyList: StrategyRead[];
  onSelectedStrategyChange: (id: number | null) => void;
  livePaperSource: LivePaperSource;
  onLivePaperSourceChange: (value: LivePaperSource) => void;
  livePaperBuiltInStrategy: BuiltInStrategyKey;
  onLivePaperBuiltInStrategyChange: (value: BuiltInStrategyKey) => void;
  atrForm: AtrStrategyFormState;
  onAtrFormChange: (value: AtrStrategyFormState) => void;
  knifeForm: KnifeStrategyFormState;
  onKnifeFormChange: (value: KnifeStrategyFormState) => void;
  gridForm: GridStrategyFormState;
  onGridFormChange: (value: GridStrategyFormState) => void;
  intradayForm: IntradayStrategyFormState;
  onIntradayFormChange: (value: IntradayStrategyFormState) => void;
  knifeSideOptions: string[];
  knifeEntryModeLongOptions: string[];
  knifeEntryModeShortOptions: string[];
  intradaySideOptions: string[];
  livePaperTotalBalanceUsdt: number;
  onLivePaperTotalBalanceUsdtChange: (value: number) => void;
  livePaperPerTradeUsdt: number;
  onLivePaperPerTradeUsdtChange: (value: number) => void;
  livePaperProfile: LivePaperProfileRead | null;
  livePaperIsRunning: boolean;
  livePaperMetrics: LivePaperMetrics;
  livePaperSessionStats: LivePaperSessionStats;
  livePaperTrades: LivePaperTradeRead[];
  livePaperEvents: LivePaperEventRead[];
  onSaveLivePaperProfile: () => Promise<void>;
  onPlayLivePaper: () => Promise<void>;
  onStopLivePaper: () => Promise<void>;
  isLivePaperSavingProfile: boolean;
  isLivePaperPlaying: boolean;
  isLivePaperStopping: boolean;
}) {
  const executionStatus =
    typeof latestSignal?.execution?.status === "string"
      ? latestSignal.execution.status
      : "unknown";
  const livePaperBuiltInStrategyItems = useMemo(() => {
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
      .filter(
        (item): item is { key: BuiltInStrategyKey; label: string } =>
          item !== null,
      );
  }, [catalog?.portfolio.builtin_strategies]);

  const activeLivePaperBuiltInStrategy = livePaperBuiltInStrategyItems.some(
    (item) => item.key === livePaperBuiltInStrategy,
  )
    ? livePaperBuiltInStrategy
    : (livePaperBuiltInStrategyItems[0]?.key ?? null);
  const livePaperEquitySeries = useMemo(
    () => parseLivePaperEquitySeries(livePaperMetrics.equity_curve),
    [livePaperMetrics.equity_curve],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label text="Strategy" />
        <div className="flex flex-wrap gap-2">
          {[
            ["builder", "Builder"],
            ["atr_ob", "ATR-OB"],
            ["atr", "ATR"],
            ["knife", "Knife"],
            ["grid", "Grid"],
            ["intraday", "Intraday"],
          ].map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={activeStrategy === key ? "default" : "outline"}
              onClick={() => onStrategyChange(key as LiveStrategyKey)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border/70 bg-muted/10 p-3">
        <p className="text-sm font-medium">Execution settings</p>
        <div className="grid gap-3 md:grid-cols-5">
          <Field
            label="Mode"
            value={execution.mode}
            options={["dry_run", "live"]}
            onChange={(value) =>
              onExecutionChange({
                ...execution,
                mode: value as SignalExecuteRequest["mode"],
              })
            }
          />
          <NumericField
            label="Fee %"
            value={execution.fee_pct}
            onChange={(value) =>
              onExecutionChange({ ...execution, fee_pct: value })
            }
          />
          <div className="space-y-1">
            <Label text="Account" />
            <select
              className={INPUT_CLASS}
              value={execution.account_id ?? ""}
              onChange={(event) =>
                onExecutionChange({
                  ...execution,
                  account_id: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            >
              <option value="">No account</option>
              {exchangeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_label} / {account.exchange_name} /{" "}
                  {account.mode}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input
              type="checkbox"
              checked={execution.execute}
              onChange={(event) =>
                onExecutionChange({
                  ...execution,
                  execute: event.target.checked,
                })
              }
            />
            Execute
          </label>
        </div>
        {execution.mode === "live" ? (
          <p className="rounded-md border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Live mode can send real orders. Account selection and explicit
            confirmation are required.
          </p>
        ) : null}
        <Button onClick={() => void onRun()} disabled={isRunPending}>
          {isRunPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isRunPending ? "Running..." : "Run Live Signal"}
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Signal Result</p>
          <Badge variant="outline">execution: {executionStatus}</Badge>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <p>
            has_signal:{" "}
            <span className="font-medium">
              {String(latestSignal?.has_signal ?? false)}
            </span>
          </p>
          <p>
            side:{" "}
            <span className="font-medium">{latestSignal?.side ?? "-"}</span>
          </p>
          <p>
            entry:{" "}
            <span className="font-medium">
              {formatCellValue(latestSignal?.entry)}
            </span>
          </p>
          <p>
            sl/tp:{" "}
            <span className="font-medium">
              {formatCellValue(latestSignal?.sl)} /{" "}
              {formatCellValue(latestSignal?.tp)}
            </span>
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <JsonBlock
            title="Reasons"
            data={{ reasons: latestSignal?.reasons ?? [] }}
          />
          <JsonBlock
            title="Stop Explain"
            data={(latestSignal?.sl_explain ?? null) as JsonRecord | null}
          />
          <JsonBlock
            title="Execution"
            data={(latestSignal?.execution ?? null) as JsonRecord | null}
          />
        </div>
        <AiLevelsHint
          trendExtraction={trendExtraction}
          analysisStructured={analysisStructured}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-border/70 bg-muted/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Live Paper Session</p>
          <Badge variant="outline">
            status: {livePaperIsRunning ? "running" : "stopped"}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Field
            label="Strategy source"
            value={livePaperSource}
            options={["saved", "builtin"]}
            onChange={(value) =>
              onLivePaperSourceChange(value as LivePaperSource)
            }
          />
          {livePaperSource === "saved" ? (
            <div className="space-y-1 md:col-span-3">
              <Label text="Saved strategy" />
              <select
                className={INPUT_CLASS}
                value={selectedStrategyId ?? ""}
                onChange={(event) =>
                  onSelectedStrategyChange(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Select in Strategies tab</option>
                {strategyList.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2 md:col-span-3">
              {isCatalogLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading built-in strategies...
                </p>
              ) : (
                <>
                  <Label text="Built-in strategies" />
                  <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-muted/15 p-2">
                    {livePaperBuiltInStrategyItems.map((strategy) => (
                      <Button
                        key={strategy.key}
                        size="sm"
                        variant={
                          activeLivePaperBuiltInStrategy === strategy.key
                            ? "default"
                            : "outline"
                        }
                        onClick={() => onLivePaperBuiltInStrategyChange(strategy.key)}
                      >
                        {strategy.label}
                      </Button>
                    ))}
                    {livePaperBuiltInStrategyItems.length === 0 ? (
                      <p className="px-2 py-1 text-sm text-muted-foreground">
                        No built-in strategies returned by backend catalog.
                      </p>
                    ) : null}
                  </div>
                  {activeLivePaperBuiltInStrategy === "atr" ? (
                    <AtrStrategyForm
                      value={atrForm}
                      onChange={onAtrFormChange}
                      onRun={async () => {}}
                      isRunning={false}
                    />
                  ) : null}
                  {activeLivePaperBuiltInStrategy === "knife" ? (
                    <KnifeStrategyForm
                      value={knifeForm}
                      onChange={onKnifeFormChange}
                      onRun={async () => {}}
                      sideOptions={knifeSideOptions}
                      entryModeLongOptions={knifeEntryModeLongOptions}
                      entryModeShortOptions={knifeEntryModeShortOptions}
                      isRunning={false}
                    />
                  ) : null}
                  {activeLivePaperBuiltInStrategy === "grid" ? (
                    <GridStrategyForm
                      value={gridForm}
                      onChange={onGridFormChange}
                      onRun={async () => {}}
                      isRunning={false}
                    />
                  ) : null}
                  {activeLivePaperBuiltInStrategy === "intraday" ? (
                    <IntradayStrategyForm
                      value={intradayForm}
                      onChange={onIntradayFormChange}
                      onRun={async () => {}}
                      sideOptions={intradaySideOptions}
                      isRunning={false}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <NumericField
            label="Total Balance USDT"
            value={livePaperTotalBalanceUsdt}
            onChange={onLivePaperTotalBalanceUsdtChange}
          />
          <NumericField
            label="Per Trade USDT"
            value={livePaperPerTradeUsdt}
            onChange={onLivePaperPerTradeUsdtChange}
          />
          <div className="space-y-1">
            <Label text="Validation" />
            <p
              className={
                livePaperPerTradeUsdt <= livePaperTotalBalanceUsdt
                  ? "rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
                  : "rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-xs text-destructive"
              }
            >
              {livePaperPerTradeUsdt <= livePaperTotalBalanceUsdt
                ? "per_trade_usdt is valid"
                : "per_trade_usdt must be less than or equal to total_balance_usdt"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void onSaveLivePaperProfile()}
            disabled={isLivePaperSavingProfile}
          >
            {isLivePaperSavingProfile ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isLivePaperSavingProfile ? "Saving..." : "Save Profile"}
          </Button>
          <Button onClick={() => void onPlayLivePaper()} disabled={isLivePaperPlaying}>
            {isLivePaperPlaying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isLivePaperPlaying ? "Starting..." : "Play"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onStopLivePaper()}
            disabled={isLivePaperStopping}
          >
            {isLivePaperStopping ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isLivePaperStopping ? "Stopping..." : "Stop"}
          </Button>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-4">
          <p>
            current_balance:{" "}
            <span className="font-medium">
              {formatCellValue(livePaperMetrics.current_balance)}
            </span>
          </p>
          <p>
            session_total_pnl:{" "}
            <span className="font-medium">
              {formatCellValue(livePaperSessionStats.totalPnl)}
            </span>
          </p>
          <p>
            session_closed_trades:{" "}
            <span className="font-medium">
              {formatCellValue(livePaperSessionStats.closedTrades)}
            </span>
          </p>
          <p>
            equity_curve points:{" "}
            <span className="font-medium">{livePaperMetrics.equity_curve.length}</span>
          </p>
          <p>
            session_win_rate:{" "}
            <span className="font-medium">
              {livePaperSessionStats.winRatePct === null
                ? "-"
                : `${livePaperSessionStats.winRatePct}%`}
            </span>
          </p>
          <p>
            session_avg_trade:{" "}
            <span className="font-medium">
              {formatCellValue(livePaperSessionStats.avgTradePnl)}
            </span>
          </p>
          <p>
            session_revision:{" "}
            <span className="font-medium">
              {formatCellValue(livePaperSessionStats.sessionStartRevision)}
            </span>
          </p>
          <p>
            session_started_at:{" "}
            <span className="font-medium">
              {livePaperSessionStats.sessionStartAt
                ? formatTimestamp(livePaperSessionStats.sessionStartAt)
                : "-"}
            </span>
          </p>
          <p>
            session_start_trade_id:{" "}
            <span className="font-medium">
              {formatCellValue(livePaperSessionStats.sessionStartTradeId)}
            </span>
          </p>
          <p>
            session_start_event_id:{" "}
            <span className="font-medium">
              {formatCellValue(livePaperSessionStats.sessionStartEventId)}
            </span>
          </p>
        </div>

        <JsonBlock
          title="Live Paper Profile"
          data={(livePaperProfile ?? null) as unknown as JsonRecord | null}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium">Live Paper Equity Curve</p>
          <EquityCurveChart points={livePaperEquitySeries} height={220} />
          {livePaperEquitySeries.length ? (
            <div className="max-h-52 overflow-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Equity</th>
                    <th className="px-3 py-2 text-left">PnL USDT</th>
                  </tr>
                </thead>
                <tbody>
                  {livePaperEquitySeries.slice(-120).map((point, index) => (
                    <tr
                      key={`${point.time}-${index}`}
                      className="border-t border-border/40"
                    >
                      <td className="px-3 py-2">
                        {formatTimestamp(new Date(Number(point.time) * 1000).toISOString())}
                      </td>
                      <td className="px-3 py-2">{formatCellValue(point.value)}</td>
                      <td className="px-3 py-2">
                        {formatCellValue(point.pnl_usdt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <LivePaperTimeline trades={livePaperTrades} events={livePaperEvents} />
      </div>
    </div>
  );
}

function LivePaperTimeline({
  trades,
  events,
}: {
  trades: LivePaperTradeRead[];
  events: LivePaperEventRead[];
}) {
  const markers = events.filter((item) => item.event_type === "strategy_switched");
  const rows = useMemo(() => {
    const markerRows = markers.map((event) => ({
      kind: "marker" as const,
      time: event.event_time,
      event,
    }));
    const tradeRows = trades.map((trade) => ({
      kind: "trade" as const,
      time: trade.exit_time ?? trade.entry_time,
      trade,
    }));
    return [...markerRows, ...tradeRows].sort((a, b) => {
      const left = new Date(a.time).getTime();
      const right = new Date(b.time).getTime();
      return left - right;
    });
  }, [markers, trades]);

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No live paper trades/events yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Live Paper Timeline</p>
      <div className="max-h-80 overflow-auto rounded-lg border border-border/70">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Trade ID</th>
              <th className="px-3 py-2 text-left">Strategy</th>
              <th className="px-3 py-2 text-left">Side</th>
              <th className="px-3 py-2 text-left">Entry</th>
              <th className="px-3 py-2 text-left">Exit</th>
              <th className="px-3 py-2 text-left">PnL USDT</th>
              <th className="px-3 py-2 text-left">Status / Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              if (row.kind === "marker") {
                return (
                  <tr key={`marker-${row.event.id}-${index}`}>
                    <td className="px-3 py-2">{formatTimestamp(row.event.event_time)}</td>
                    <td className="px-3 py-2">
                      <Badge className="bg-violet-500/15 text-violet-200">
                        {row.event.event_type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">-</td>
                    <td className="px-3 py-2">
                      Strategy revision {row.event.strategy_revision}
                    </td>
                    <td className="px-3 py-2">-</td>
                    <td className="px-3 py-2">-</td>
                    <td className="px-3 py-2">-</td>
                    <td className="px-3 py-2">-</td>
                    <td className="px-3 py-2">
                      {(row.event.payload
                        ? JSON.stringify(row.event.payload)
                        : "No payload"
                      ).slice(0, 120)}
                    </td>
                  </tr>
                );
              }

              const pnlClass =
                row.trade.pnl_usdt > 0
                  ? "text-emerald-300"
                  : row.trade.pnl_usdt < 0
                    ? "text-red-300"
                    : "text-amber-200";

              return (
                <tr key={`trade-${row.trade.id}-${index}`} className="border-t border-border/50">
                  <td className="px-3 py-2">
                    {formatTimestamp(row.trade.exit_time ?? row.trade.entry_time)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">trade</Badge>
                  </td>
                  <td className="px-3 py-2">#{row.trade.id}</td>
                  <td className="px-3 py-2">
                    #{row.trade.strategy_id} / rev {row.trade.strategy_revision}
                  </td>
                  <td className="px-3 py-2">{row.trade.side}</td>
                  <td className="px-3 py-2">{formatCellValue(row.trade.entry_price)}</td>
                  <td className="px-3 py-2">{formatCellValue(row.trade.exit_price)}</td>
                  <td className={`px-3 py-2 font-medium ${pnlClass}`}>
                    {formatCellValue(row.trade.pnl_usdt)}
                  </td>
                  <td className="px-3 py-2">
                    {row.trade.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toUnixTimestamp(value: unknown): UTCTimestamp | null {
  if (typeof value === "number") {
    return Math.floor(value > 10_000_000_000 ? value / 1000 : value) as UTCTimestamp;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      return null;
    }
    return Math.floor(ms / 1000) as UTCTimestamp;
  }
  return null;
}

function parseLivePaperEquitySeries(equityCurve: unknown[]) {
  const parsed = equityCurve
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as Record<string, unknown>;
      const value =
        typeof row.equity === "number"
          ? row.equity
          : typeof row.value === "number"
            ? row.value
            : null;
      if (value === null) {
        return null;
      }
      const timestamp =
        toUnixTimestamp(row.time ?? row.timestamp ?? row.date) ??
        ((1_700_000_000 + index) as UTCTimestamp);
      return {
        time: timestamp,
        value,
        pnl_usdt: typeof row.pnl_usdt === "number" ? row.pnl_usdt : null,
      };
    })
    .filter(
      (
        point,
      ): point is { time: UTCTimestamp; value: number; pnl_usdt: number | null } =>
        point !== null,
    );
  return parsed.sort((a, b) => Number(a.time) - Number(b.time));
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
    return (
      <p className="text-xs text-muted-foreground">
        No AI regime probabilities yet.
      </p>
    );
  }

  return (
    <div
      className={`rounded-md border border-border/70 bg-muted/20 p-2 ${compact ? "" : "space-y-2"}`}
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI trend confidence
        </p>
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
  const currentPrice = Number(
    (analysisStructured?.currentPrice as number | undefined) ?? NaN,
  );
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
          Current price:{" "}
          <span className="font-semibold text-foreground">
            {formatCellValue(currentPrice)}
          </span>
        </p>
      ) : null}
      <div className="grid gap-2 md:grid-cols-3">
        {scenarios.map((item) => (
          <div
            key={item.key}
            className="rounded-md border border-border/70 bg-background/30 p-2 text-sm"
          >
            <p className="mb-1 font-medium capitalize">{item.label}</p>
            <p className="text-muted-foreground">
              TP:{" "}
              <span className="font-semibold text-foreground">
                {formatCellValue(item.takeProfit)}
              </span>
            </p>
            <p className="text-muted-foreground">
              SL:{" "}
              <span className="font-semibold text-foreground">
                {formatCellValue(item.stopLoss)}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

type NormalizedIndicatorRecommendationScenario = {
  probabilityPct: number;
  takeProfit: number | null;
  stopLoss: number | null;
  indicatorSet: string[];
};

type NormalizedIndicatorRecommendations = {
  recommendedFromAvailable: string[];
  additionalSuggested: string[];
  rationale: string;
  bull: NormalizedIndicatorRecommendationScenario;
  bear: NormalizedIndicatorRecommendationScenario;
  flat: NormalizedIndicatorRecommendationScenario;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeIndicatorRecommendationScenario(
  value: unknown,
): NormalizedIndicatorRecommendationScenario {
  const data = isObjectRecord(value) ? value : {};
  return {
    probabilityPct: toFiniteNumber(data.probabilityPct, 0),
    takeProfit: toFiniteNumberOrNull(data.takeProfit),
    stopLoss: toFiniteNumberOrNull(data.stopLoss),
    indicatorSet: toStringArray(data.indicatorSet),
  };
}

function normalizeIndicatorRecommendations(
  run: AnalysisRun | null,
): NormalizedIndicatorRecommendations | null {
  const raw = run?.indicatorRecommendations;
  if (!isObjectRecord(raw)) {
    return null;
  }
  return {
    recommendedFromAvailable: toStringArray(raw.recommendedFromAvailable),
    additionalSuggested: toStringArray(raw.additionalSuggested),
    rationale: typeof raw.rationale === "string" ? raw.rationale : "",
    bull: normalizeIndicatorRecommendationScenario(raw.bull),
    bear: normalizeIndicatorRecommendationScenario(raw.bear),
    flat: normalizeIndicatorRecommendationScenario(raw.flat),
  };
}

function formatIndicatorLevel(value: number | null) {
  return value === null ? "—" : formatCellValue(value);
}

function IndicatorRecommendationsHint({ run }: { run: AnalysisRun | null }) {
  const recommendations = normalizeIndicatorRecommendations(run);

  if (!recommendations) {
    return (
      <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-violet-300" aria-hidden="true" />
          <p className="text-sm font-medium">Indicator Recommendations</p>
          <Badge variant="outline">new</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Recommendations not available for this analysis.
        </p>
      </div>
    );
  }

  const regimeRows: Array<{
    key: "bull" | "bear" | "flat";
    icon: ReactNode;
    data: NormalizedIndicatorRecommendationScenario;
  }> = [
    {
      key: "bull",
      icon: (
        <ArrowUpRight className="h-4 w-4 text-emerald-300" aria-hidden="true" />
      ),
      data: recommendations.bull,
    },
    {
      key: "bear",
      icon: (
        <ArrowDownRight className="h-4 w-4 text-red-300" aria-hidden="true" />
      ),
      data: recommendations.bear,
    },
    {
      key: "flat",
      icon: <Minus className="h-4 w-4 text-amber-300" aria-hidden="true" />,
      data: recommendations.flat,
    },
  ];

  return (
    <div className="min-w-0 space-y-3 rounded-md border border-violet-400/30 bg-violet-500/8 p-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-violet-300" aria-hidden="true" />
        <p className="text-sm font-medium">Indicator Recommendations</p>
        <Badge variant="ai">AI</Badge>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2 rounded-md border border-border/70 bg-background/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recommended from available
          </p>
          {recommendations.recommendedFromAvailable.length ? (
            <div className="min-w-0 flex flex-wrap gap-1.5">
              {recommendations.recommendedFromAvailable.map((indicator) => (
                <Badge
                  key={`available-${indicator}`}
                  variant="outline"
                  className="max-w-full wrap-break-word"
                >
                  {indicator}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No indicators recommended from current set.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-2 rounded-md border border-border/70 bg-background/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Additional suggested
          </p>
          {recommendations.additionalSuggested.length ? (
            <div className="min-w-0 flex flex-wrap gap-1.5">
              {recommendations.additionalSuggested.map((indicator) => (
                <Badge
                  key={`additional-${indicator}`}
                  className="max-w-full wrap-break-word border-amber-400/35 bg-amber-500/10 text-amber-200"
                >
                  {indicator}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No extra suggestions.
            </p>
          )}
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            May include indicators outside your current builder set.
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-1 rounded-md border border-border/70 bg-background/30 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rationale
        </p>
        <p className="whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">
          {recommendations.rationale ||
            "Для этого анализа рекомендации индикаторов недоступны"}
        </p>
      </div>

      <div className="grid min-w-0 gap-2 md:grid-cols-3">
        {regimeRows.map((regime) => (
          <div
            key={regime.key}
            className="min-w-0 space-y-2 rounded-md border border-border/70 bg-background/30 p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5">
                {regime.icon}
                <p className="font-medium capitalize">{regime.key}</p>
              </div>
              <Badge variant="outline">
                {formatCellValue(regime.data.probabilityPct)}%
              </Badge>
            </div>
            <p className="text-muted-foreground">
              TP:{" "}
              <span className="font-semibold text-foreground">
                {formatIndicatorLevel(regime.data.takeProfit)}
              </span>
            </p>
            <p className="text-muted-foreground">
              SL:{" "}
              <span className="font-semibold text-foreground">
                {formatIndicatorLevel(regime.data.stopLoss)}
              </span>
            </p>
            {regime.data.indicatorSet.length ? (
              <div className="min-w-0 flex flex-wrap gap-1.5">
                {regime.data.indicatorSet.map((indicator) => (
                  <Badge
                    key={`${regime.key}-${indicator}`}
                    variant="outline"
                    className="max-w-full wrap-break-word"
                  >
                    {indicator}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No regime-specific indicator set.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisTab({
  mode,
  runs,
  selectedRun,
  selectedRunId,
  isLoading,
  isTriggering,
  isAutoRefreshing,
  isRefreshPending,
  isTriggerPending,
  onSelectRun,
  onRefresh,
  onTrigger,
  personalDefaults,
  personalProfiles,
  selectedPersonalProfileId,
  personalProfileForm,
  personalLatest,
  personalHistory,
  personalHistoryBefore,
  personalJobStatus,
  isPersonalLoading,
  isPersonalSavePending,
  isPersonalTriggerPending,
  isPersonalHistoryLoading,
  isPersonalPolling,
  availablePersonalAgents,
  onModeChange,
  onRefreshPersonal,
  onSelectPersonalProfile,
  onPersonalProfileFormChange,
  onResetPersonalProfile,
  onSavePersonalProfile,
  onDeletePersonalProfile,
  onTriggerPersonal,
  onLoadMorePersonalHistory,
}: {
  mode: AnalysisMode;
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  selectedRunId: string | null;
  isLoading: boolean;
  isTriggering: boolean;
  isAutoRefreshing: boolean;
  isRefreshPending: boolean;
  isTriggerPending: boolean;
  onSelectRun: (id: string) => void;
  onRefresh: () => void;
  onTrigger: () => void;
  personalDefaults: PersonalAnalysisDefaultsRead | null;
  personalProfiles: PersonalAnalysisProfileRead[];
  selectedPersonalProfileId: number | null;
  personalProfileForm: PersonalProfileFormState;
  personalLatest: PersonalAnalysisHistoryRead | null;
  personalHistory: PersonalAnalysisHistoryRead[];
  personalHistoryBefore: string | null;
  personalJobStatus: PersonalAnalysisJobRead | null;
  isPersonalLoading: boolean;
  isPersonalSavePending: boolean;
  isPersonalTriggerPending: boolean;
  isPersonalHistoryLoading: boolean;
  isPersonalPolling: boolean;
  availablePersonalAgents: string[];
  onModeChange: (mode: AnalysisMode) => void;
  onRefreshPersonal: () => void;
  onSelectPersonalProfile: (profileId: number | null) => void;
  onPersonalProfileFormChange: (value: PersonalProfileFormState) => void;
  onResetPersonalProfile: () => void;
  onSavePersonalProfile: () => void;
  onDeletePersonalProfile: (profileId: number) => void;
  onTriggerPersonal: () => void;
  onLoadMorePersonalHistory: () => void;
}) {
  const personalEnabledAgents = countEnabledAgents(personalProfileForm.agents);
  const [selectedPersonalHistoryId, setSelectedPersonalHistoryId] = useState<
    number | null
  >(null);
  const effectivePersonalHistoryId = useMemo(() => {
    if (!personalHistory.length) {
      return null;
    }
    const exists = personalHistory.some(
      (item) => item.id === selectedPersonalHistoryId,
    );
    if (exists) {
      return selectedPersonalHistoryId;
    }
    return personalHistory[0].id;
  }, [personalHistory, selectedPersonalHistoryId]);

  const selectedPersonalHistory = useMemo(() => {
    if (!effectivePersonalHistoryId) {
      return personalHistory[0] ?? personalLatest ?? null;
    }
    return (
      personalHistory.find((item) => item.id === effectivePersonalHistoryId) ??
      personalLatest ??
      null
    );
  }, [effectivePersonalHistoryId, personalHistory, personalLatest]);

  const selectedPersonalPayload = useMemo(
    () =>
      extractPersonalAnalysisPayload(selectedPersonalHistory?.analysis_data ?? null),
    [selectedPersonalHistory?.analysis_data],
  );
  const selectedPersonalRun = useMemo(
    () =>
      toPseudoAnalysisRun({
        symbol: selectedPersonalHistory?.symbol ?? personalProfileForm.symbol,
        timestamp:
          selectedPersonalHistory?.core_completed_at ??
          selectedPersonalHistory?.updated_at ??
          null,
        payload: selectedPersonalPayload,
      }),
    [personalProfileForm.symbol, selectedPersonalHistory, selectedPersonalPayload],
  );

  if (mode === "personal") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-3">
          <div>
            <p className="text-sm font-medium">Personal AI analysis</p>
            <p className="text-xs text-muted-foreground">
              Manage your profiles, trigger jobs, and inspect completed history.
            </p>
            {isPersonalPolling ? (
              <p className="mt-1 inline-flex items-center text-xs text-amber-300">
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Personal job is in progress...
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onModeChange("global")}
            >
              Global
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => onModeChange("personal")}
            >
              Personal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshPersonal}
              disabled={isPersonalLoading || isPersonalSavePending}
            >
              {isPersonalLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="min-w-0 max-h-[680px] space-y-2 overflow-auto rounded-md border border-border/70 bg-muted/10 p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={onResetPersonalProfile}
            >
              + New profile
            </Button>
            {personalProfiles.length ? (
              personalProfiles.map((profile) => {
                const active = selectedPersonalProfileId === profile.id;
                return (
                  <div
                    key={profile.id}
                    className={`rounded-md border px-3 py-2 ${
                      active
                        ? "border-violet-400/50 bg-violet-500/12"
                        : "border-border/70 bg-background/35"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPersonalProfile(profile.id)}
                      className="w-full text-left"
                    >
                      <p className="truncate text-sm font-medium">{profile.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Every {profile.interval_minutes} min
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated: {formatTimestamp(profile.updated_at)}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs text-destructive"
                      onClick={() => onDeletePersonalProfile(profile.id)}
                      disabled={isPersonalSavePending}
                    >
                      Deactivate
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="p-2 text-sm text-muted-foreground">
                No personal profiles yet.
              </p>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                History
              </p>
              <div className="min-w-0 max-h-[320px] space-y-2 overflow-auto rounded-md border border-border/70 bg-background/25 p-2">
                {personalHistory.length ? (
                  personalHistory.map((item) => {
                    const active = item.id === selectedPersonalHistory?.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedPersonalHistoryId(item.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left transition ${
                          active
                            ? "border-violet-400/50 bg-violet-500/12"
                            : "border-border/70 bg-background/35 hover:bg-muted/30"
                        }`}
                      >
                        <p className="text-sm font-medium">{item.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(item.created_at)}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">
                          Job: {item.trade_job_id}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Personal history is empty.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onLoadMorePersonalHistory}
                disabled={!personalHistoryBefore || isPersonalHistoryLoading}
              >
                {isPersonalHistoryLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Load more
              </Button>
            </div>
          </div>

          <div className="min-w-0 space-y-3 overflow-hidden rounded-md border border-border/70 bg-muted/10 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Symbol"
                value={personalProfileForm.symbol}
                onChange={(value) =>
                  onPersonalProfileFormChange({
                    ...personalProfileForm,
                    symbol: value,
                  })
                }
              />
              <NumericField
                label="Interval (minutes)"
                value={personalProfileForm.intervalMinutes}
                onChange={(value) =>
                  onPersonalProfileFormChange({
                    ...personalProfileForm,
                    intervalMinutes: value,
                  })
                }
                min={5}
                max={1440}
              />
            </div>

            <div className="space-y-1">
              <Label text="Query prompt" />
              <textarea
                className={`${INPUT_CLASS} min-h-24 w-full`}
                value={personalProfileForm.queryPrompt}
                onChange={(event) =>
                  onPersonalProfileFormChange({
                    ...personalProfileForm,
                    queryPrompt: event.target.value,
                  })
                }
                placeholder="Optional custom prompt for your personal analysis profile"
              />
            </div>

            <div className="space-y-2 rounded-md border border-border/70 bg-background/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Agents & weights ({personalEnabledAgents} enabled)
              </p>
              <p className="text-xs text-muted-foreground">
                Defaults loaded: {personalDefaults ? "yes" : "no"}
              </p>
              {availablePersonalAgents.length ? (
                <div className="min-w-0 space-y-2">
                  {availablePersonalAgents.map((agent) => (
                    <div
                      key={agent}
                      className="grid min-w-0 gap-2 rounded-md border border-border/50 bg-muted/10 p-2 md:grid-cols-[minmax(0,1fr)_140px]"
                    >
                      <label className="flex min-w-0 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(personalProfileForm.agents[agent])}
                          onChange={(event) =>
                            onPersonalProfileFormChange({
                              ...personalProfileForm,
                              agents: {
                                ...personalProfileForm.agents,
                                [agent]: event.target.checked,
                              },
                            })
                          }
                        />
                        <span className="truncate">{agent}</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        className={INPUT_CLASS}
                        value={Number(personalProfileForm.agentWeights[agent] ?? 0)}
                        onChange={(event) =>
                          onPersonalProfileFormChange({
                            ...personalProfileForm,
                            agentWeights: {
                              ...personalProfileForm.agentWeights,
                              [agent]: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No available agents returned by defaults endpoint.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={onSavePersonalProfile}
                disabled={isPersonalSavePending}
              >
                {isPersonalSavePending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save profile
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onTriggerPersonal}
                disabled={
                  isPersonalTriggerPending ||
                  !selectedPersonalProfileId ||
                  personalEnabledAgents < 1
                }
              >
                {isPersonalTriggerPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Run personal analysis
              </Button>
            </div>

            {personalJobStatus ? (
              <p className="break-all text-xs text-muted-foreground">
                Job: {personalJobStatus.id} | Status: {personalJobStatus.status}
              </p>
            ) : null}

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Personal forecast</p>
              {selectedPersonalHistory ? (
                <div className="min-w-0 space-y-3 overflow-hidden rounded-md border border-border/70 bg-background/35 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {selectedPersonalHistory.symbol}
                    </p>
                    <Badge variant="outline">Personal</Badge>
                    {selectedPersonalPayload.analysisStructured?.bias ? (
                      <Badge variant="outline">
                        Bias: {String(selectedPersonalPayload.analysisStructured.bias)}
                      </Badge>
                    ) : null}
                    {typeof selectedPersonalPayload.analysisStructured?.confidence ===
                    "number" ? (
                      <Badge variant="outline">
                        Confidence:{" "}
                        {Math.round(
                          Number(
                            selectedPersonalPayload.analysisStructured.confidence,
                          ) *
                            100,
                        )}
                        %
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed:{" "}
                    {formatTimestamp(
                      selectedPersonalHistory.core_completed_at ??
                        selectedPersonalHistory.updated_at,
                    )}
                  </p>
                  <AiTrendHint trendExtraction={selectedPersonalPayload.trendExtraction} />
                  <AiLevelsHint
                    trendExtraction={selectedPersonalPayload.trendExtraction}
                    analysisStructured={selectedPersonalPayload.analysisStructured}
                  />
                  <IndicatorRecommendationsHint run={selectedPersonalRun} />
                  <div className="space-y-1">
                    <Label text="Report" />
                    <AnalysisReport markdown={selectedPersonalPayload.analysisReport} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No completed personal runs yet. Run analysis and pick an item from history.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-3">
        <div>
          <p className="text-sm font-medium">AI analysis history</p>
          <p className="text-xs text-muted-foreground">
            Manual and cron runs sorted by latest trigger time.
          </p>
          {isAutoRefreshing ? (
            <p className="mt-1 inline-flex items-center text-xs text-amber-300">
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Analysis in progress...
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => onModeChange("global")}
          >
            Global
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onModeChange("personal")}
          >
            Personal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading || isTriggering || isRefreshPending}
          >
            {isRefreshPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isRefreshPending ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            size="sm"
            onClick={onTrigger}
            disabled={isTriggering || isTriggerPending}
          >
            {isTriggerPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isTriggering || isTriggerPending
              ? "Starting..."
              : "Run AI analysis now"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <div className="max-h-[620px] space-y-2 overflow-auto rounded-md border border-border/70 bg-muted/10 p-2">
          {runs.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              No analysis runs yet.
            </p>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTimestamp(run.triggeredAt)}
                  </p>
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
                Triggered: {formatTimestamp(selectedRun.triggeredAt)} |
                Completed:{" "}
                {selectedRun.completedAt
                  ? formatTimestamp(selectedRun.completedAt)
                  : "-"}
              </p>

              {selectedRun.error ? (
                <p className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {selectedRun.error}
                </p>
              ) : null}

              <AiTrendHint
                trendExtraction={selectedRun.trendExtraction ?? null}
              />
              <AiLevelsHint
                trendExtraction={selectedRun.trendExtraction ?? null}
                analysisStructured={
                  (selectedRun.analysisStructured as JsonRecord | null) ?? null
                }
              />
              <IndicatorRecommendationsHint run={selectedRun} />

              <div className="space-y-1">
                <Label text="Report" />
                <AnalysisReport markdown={selectedRun.analysisReport ?? ""} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a run to inspect details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioTab({
  strategyList,
  userSelection,
  onUserSelection,
  userAllocations,
  onUserAllocations,
  builtinSelection,
  onBuiltinSelection,
  builtinAllocations,
  onBuiltinAllocations,
  builtinParams,
  onBuiltinParams,
  atrForm,
  onAtrFormChange,
  knifeForm,
  onKnifeFormChange,
  gridForm,
  onGridFormChange,
  intradayForm,
  onIntradayFormChange,
  capital,
  onCapital,
  asyncJob,
  onAsyncJob,
  onRun,
  latestPortfolio,
  catalog,
  isRunPending,
}: {
  strategyList: StrategyRead[];
  userSelection: number[];
  onUserSelection: (value: number[]) => void;
  userAllocations: Record<number, number>;
  onUserAllocations: (value: Record<number, number>) => void;
  builtinSelection: string[];
  onBuiltinSelection: (value: string[]) => void;
  builtinAllocations: Record<string, number>;
  onBuiltinAllocations: (value: Record<string, number>) => void;
  builtinParams: Record<string, Record<string, string>>;
  onBuiltinParams: (value: Record<string, Record<string, string>>) => void;
  atrForm: AtrStrategyFormState;
  onAtrFormChange: (value: AtrStrategyFormState) => void;
  knifeForm: KnifeStrategyFormState;
  onKnifeFormChange: (value: KnifeStrategyFormState) => void;
  gridForm: GridStrategyFormState;
  onGridFormChange: (value: GridStrategyFormState) => void;
  intradayForm: IntradayStrategyFormState;
  onIntradayFormChange: (value: IntradayStrategyFormState) => void;
  capital: number;
  onCapital: (value: number) => void;
  asyncJob: boolean;
  onAsyncJob: (value: boolean) => void;
  onRun: () => Promise<void>;
  latestPortfolio: BacktestResponse | null;
  catalog: BacktestCatalogResponse | null;
  isRunPending: boolean;
}) {
  const builtinStrategyNames = (
    catalog?.portfolio.builtin_strategies ?? []
  ).filter(isPortfolioBuiltinStrategy);
  const builtinParamsCatalog = catalog?.portfolio.builtin_strategy_params ?? {};
  const visibleBuiltinSelection = builtinSelection.filter(
    isPortfolioBuiltinStrategy,
  );
  const selectedUserTotalAllocation = userSelection.reduce(
    (sum, strategyId) => {
      return sum + Math.max(0, Number(userAllocations[strategyId] ?? 0));
    },
    0,
  );
  const selectedBuiltinTotalAllocation = visibleBuiltinSelection.reduce(
    (sum, strategyName) => {
      return sum + Math.max(0, Number(builtinAllocations[strategyName] ?? 0));
    },
    0,
  );
  const totalAllocation =
    selectedUserTotalAllocation + selectedBuiltinTotalAllocation;
  const portfolioMetrics = useMemo(
    () => normalizeBacktestMetrics(latestPortfolio),
    [latestPortfolio],
  );
  const portfolioEquityCurveSeries = useMemo(
    () =>
      portfolioMetrics?.equityCurve.map((point) => ({
        time: point.time,
        value: point.value,
      })) ?? [],
    [portfolioMetrics],
  );
  const knifeSideOptions = catalog?.knife_catcher.sides?.length
    ? catalog.knife_catcher.sides
    : [knifeForm.side];
  const knifeEntryModeLongOptions = catalog?.knife_catcher.entry_mode_long
    ?.length
    ? catalog.knife_catcher.entry_mode_long
    : [knifeForm.entry_mode_long];
  const knifeEntryModeShortOptions = catalog?.knife_catcher.entry_mode_short
    ?.length
    ? catalog.knife_catcher.entry_mode_short
    : [knifeForm.entry_mode_short];
  const intradaySideOptions = catalog?.intraday_momentum.sides?.length
    ? catalog.intraday_momentum.sides
    : [intradayForm.side];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Available built-ins: {builtinStrategyNames.join(", ") || "n/a"}
      </p>
      <p className="text-xs text-muted-foreground">
        Total allocation: {totalAllocation.toFixed(2)}%
      </p>
      <Label text="Saved strategies" />
      <div className="grid gap-2 md:grid-cols-3">
        {strategyList.map((strategy) => {
          const checked = userSelection.includes(strategy.id);
          return (
            <label
              key={strategy.id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const next = new Set(userSelection);
                  if (event.target.checked) {
                    next.add(strategy.id);
                  } else {
                    next.delete(strategy.id);
                  }
                  onUserSelection(Array.from(next));
                }}
              />
              {strategy.name}
            </label>
          );
        })}
      </div>
      {userSelection.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {strategyList
            .filter((strategy) => userSelection.includes(strategy.id))
            .map((strategy) => (
              <NumericField
                key={strategy.id}
                label={`Allocation %: ${strategy.name}`}
                value={Number(userAllocations[strategy.id] ?? 0)}
                onChange={(value) =>
                  onUserAllocations({
                    ...userAllocations,
                    [strategy.id]: value,
                  })
                }
                min={0}
                max={100}
                step={0.1}
              />
            ))}
        </div>
      ) : null}
      <Separator />
      <Label text="Built-in strategies" />
      <div className="grid gap-2 md:grid-cols-3">
        {builtinStrategyNames.map((strategyName) => {
          const checked = builtinSelection.includes(strategyName);
          return (
            <label
              key={strategyName}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const next = new Set(builtinSelection);
                  if (event.target.checked) {
                    next.add(strategyName);
                  } else {
                    next.delete(strategyName);
                  }
                  onBuiltinSelection(Array.from(next));
                }}
              />
              {strategyName}
            </label>
          );
        })}
      </div>
      {visibleBuiltinSelection.map((strategyName) => {
        const mappedKey = mapBuiltinStrategyLabelToKey(strategyName);
        const params =
          builtinParamsCatalog[strategyName] ??
          Object.entries(builtinParamsCatalog).find(
            ([key]) =>
              normalizeBuiltinStrategyName(key) ===
              normalizeBuiltinStrategyName(strategyName),
          )?.[1] ??
          [];
        const strategyParams = builtinParams[strategyName] ?? {};
        return (
          <div
            key={strategyName}
            className="space-y-3 rounded-md border border-border/70 p-3"
          >
            <NumericField
              label={`Allocation %: ${strategyName}`}
              value={Number(builtinAllocations[strategyName] ?? 0)}
              onChange={(value) =>
                onBuiltinAllocations({
                  ...builtinAllocations,
                  [strategyName]: value,
                })
              }
              min={0}
              max={100}
              step={0.1}
            />
            {mappedKey === "atr" ? (
              <AtrStrategyForm
                value={atrForm}
                onChange={onAtrFormChange}
                onRun={async () => {}}
                showRunButton={false}
              />
            ) : null}
            {mappedKey === "knife" ? (
              <KnifeStrategyForm
                value={knifeForm}
                onChange={onKnifeFormChange}
                onRun={async () => {}}
                sideOptions={knifeSideOptions}
                entryModeLongOptions={knifeEntryModeLongOptions}
                entryModeShortOptions={knifeEntryModeShortOptions}
                showRunButton={false}
              />
            ) : null}
            {mappedKey === "grid" ? (
              <GridStrategyForm
                value={gridForm}
                onChange={onGridFormChange}
                onRun={async () => {}}
                showRunButton={false}
              />
            ) : null}
            {mappedKey === "intraday" ? (
              <IntradayStrategyForm
                value={intradayForm}
                onChange={onIntradayFormChange}
                onRun={async () => {}}
                sideOptions={intradaySideOptions}
                showRunButton={false}
              />
            ) : null}
            {mappedKey === null ? (
              params.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {params.map((paramName) => (
                    <TextField
                      key={`${strategyName}-${paramName}`}
                      label={humanizeParamName(paramName)}
                      value={strategyParams[paramName] ?? ""}
                      onChange={(value) =>
                        onBuiltinParams({
                          ...builtinParams,
                          [strategyName]: {
                            ...strategyParams,
                            [paramName]: value,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No optional params returned by catalog.
                </p>
              )
            ) : null}
          </div>
        );
      })}
      <div className="grid gap-4 md:grid-cols-3">
        <NumericField
          label="Total Capital"
          value={capital}
          onChange={onCapital}
        />
        <label className="flex items-center gap-2 pt-7 text-sm">
          <input
            type="checkbox"
            checked={asyncJob}
            onChange={(event) => onAsyncJob(event.target.checked)}
          />
          Async Job
        </label>
      </div>
      <Button onClick={() => void onRun()} disabled={isRunPending}>
        {isRunPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="mr-2 h-4 w-4" />
        )}
        {isRunPending ? "Running..." : "Run Portfolio Backtest"}
      </Button>
      <BacktestEquitySection
        latestBacktest={latestPortfolio}
        metrics={portfolioMetrics}
        equityCurveSeries={portfolioEquityCurveSeries}
      />
      <TradesTable trades={latestPortfolio?.trades ?? []} />
      <JsonBlock
        title="Portfolio Explanations"
        data={{ explanations: latestPortfolio?.explanations ?? [] }}
      />
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
  const toPayloadRecord = (value: unknown): JsonRecord | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as JsonRecord;
  };

  const eventLabelMap: Record<string, string> = {
    BACKTEST_RUN: "Backtest Run",
    PORTFOLIO_RUN: "Portfolio Run",
    UPDATE_STRATEGY: "Update Strategy",
    INDICATORS_CHANGE: "Indicators Change",
  };

  const renderIndicatorsChange = (payload: JsonRecord | null) => {
    if (!payload) {
      return <span className="text-muted-foreground">No payload</span>;
    }
    const added = Array.isArray(payload.added) ? payload.added : [];
    const removed = Array.isArray(payload.removed) ? payload.removed : [];
    if (added.length === 0 && removed.length === 0) {
      return <span className="text-muted-foreground">No indicator delta</span>;
    }
    return (
      <div className="space-y-1">
        <p className="text-xs">
          <span className="font-medium text-emerald-300">Added:</span>{" "}
          {added.length ? added.map((item) => String(item)).join(", ") : "-"}
        </p>
        <p className="text-xs">
          <span className="font-medium text-red-300">Removed:</span>{" "}
          {removed.length
            ? removed.map((item) => String(item)).join(", ")
            : "-"}
        </p>
      </div>
    );
  };

  const renderAuditDetails = (
    eventName: string,
    payload: JsonRecord | null,
  ) => {
    if (eventName === "INDICATORS_CHANGE") {
      return renderIndicatorsChange(payload);
    }
    if (!payload) {
      return <span className="text-muted-foreground">-</span>;
    }
    const compact = JSON.stringify(payload);
    if (!compact || compact === "{}") {
      return <span className="text-muted-foreground">-</span>;
    }
    return <span className="text-muted-foreground">{compact}</span>;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Suggested events: {auditMeta?.suggested_events.join(", ") ?? "n/a"}
      </p>
      <TextField
        label="Audit search"
        value={auditFilter}
        onChange={onAuditFilter}
      />
      <div className="max-h-80 overflow-x-auto overflow-y-auto overscroll-contain rounded-md border border-border/70 bg-background/35">
        <table className="min-w-full w-max text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((event) => {
              const payload = toPayloadRecord(event.payload);
              const actor = event.actor?.trim() ? event.actor : "system";
              const isSystemActor = actor.toLowerCase() === "system";
              const eventLabel = eventLabelMap[event.event] ?? event.event;
              const target = `${event.target_type}:${event.target_id}`;

              return (
                <tr key={event.id} className="border-b align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {isSystemActor ? (
                      <Badge variant="outline">system</Badge>
                    ) : (
                      actor
                    )}
                  </td>
                  <td className="px-3 py-2">{eventLabel}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {target}
                  </td>
                  <td className="px-3 py-2">{event.reason ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">
                    {renderAuditDetails(event.event, payload)}
                  </td>
                </tr>
              );
            })}
            {auditEvents.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
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
            <CardTitle
              className={`text-base ${formatKpiToneClass(row.label, row.value)}`}
            >
              {row.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function BacktestEquitySection({
  latestBacktest,
  metrics,
  equityCurveSeries,
}: {
  latestBacktest: BacktestResponse | null;
  metrics: ReturnType<typeof normalizeBacktestMetrics>;
  equityCurveSeries: Array<{ time: CandlePoint["time"]; value: number }>;
}) {
  if (!latestBacktest || !metrics) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Equity curve</p>
        <Badge variant="outline">Backtest result</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1 pb-2">
            <CardDescription>Initial balance</CardDescription>
            <CardTitle className="text-base">
              ${formatCellValue(metrics.initialBalance)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 pb-2">
            <CardDescription>Final balance</CardDescription>
            <CardTitle className="text-base">
              ${formatCellValue(metrics.finalBalance)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 pb-2">
            <CardDescription>Total PnL</CardDescription>
            <CardTitle
              className={`text-base ${formatSignedToneClass(metrics.totalPnl)}`}
            >
              ${formatCellValue(metrics.totalPnl)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 pb-2">
            <CardDescription>Avg risk / trade</CardDescription>
            <CardTitle className="text-base">
              ${formatCellValue(metrics.avgRiskPerTrade)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-muted/25 p-2 md:p-4">
        <EquityCurveChart points={equityCurveSeries} />
      </div>
    </div>
  );
}

function TradesTable({ trades }: { trades: JsonRecord[] }) {
  if (trades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No trades to display.</p>
    );
  }
  const displayTrades = trades.map((trade) => normalizeTradeForDisplay(trade));
  const headers = Object.keys(displayTrades[0]).slice(0, 8);
  return (
    <div className="max-h-96 overflow-auto overscroll-contain rounded-md border border-border/70 bg-background/35">
      <table className="w-full min-w-[640px] text-xs md:text-sm">
        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
          <tr className="border-b text-left">
            <th className="w-14 px-2 py-2 text-center font-medium"></th>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayTrades.slice(0, 200).map((trade, rowIndex) => {
            const outcome = resolveTradeOutcome(trade);

            return (
              <tr key={String(trade.id ?? rowIndex)} className="border-b">
                <td
                  className="px-2 py-2 text-center"
                  aria-label={`Outcome: ${outcome.label}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${outcome.iconClassName}`}
                  >
                    {outcome.icon}
                  </span>
                </td>
                {headers.map((header) => (
                  <td key={`${rowIndex}-${header}`} className="px-3 py-2">
                    {renderTradeCellValue(header, trade[header])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JsonBlock({
  title,
  data,
}: {
  title: string;
  data: JsonRecord | null;
}) {
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
    return (
      <Badge className="bg-emerald-500/15 text-emerald-200">success</Badge>
    );
  }
  if (status === "failed") {
    return <Badge className="bg-red-500/15 text-red-200">failed</Badge>;
  }
  return <Badge className="bg-amber-500/15 text-amber-200">running</Badge>;
}

function pickRecordValue(
  record: JsonRecord | null | undefined,
  keys: string[],
): unknown {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function asJsonRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asTrendExtraction(value: unknown): AnalysisTrendExtraction | null {
  const record = asJsonRecord(value);
  if (!record) {
    return null;
  }
  return record as unknown as AnalysisTrendExtraction;
}

function extractPersonalAnalysisPayload(data: JsonRecord | null | undefined) {
  const analysisReport = pickRecordValue(data, [
    "analysis_report",
    "analysisReport",
    "report",
    "markdown",
    "summary",
  ]);
  const analysisStructured = asJsonRecord(
    pickRecordValue(data, ["analysis_structured", "analysisStructured"]),
  );
  const trendExtraction = asTrendExtraction(
    pickRecordValue(data, ["trend_extraction", "trendExtraction"]),
  );
  const indicatorRecommendations = asJsonRecord(
    pickRecordValue(data, [
      "indicator_recommendations",
      "indicatorRecommendations",
    ]),
  ) as AnalysisRun["indicatorRecommendations"] | null;

  return {
    analysisReport:
      typeof analysisReport === "string" && analysisReport.trim().length > 0
        ? analysisReport
        : data
          ? JSON.stringify(data, null, 2)
          : "",
    analysisStructured,
    trendExtraction,
    indicatorRecommendations,
  };
}

function toPseudoAnalysisRun(input: {
  symbol: string;
  timestamp: string | null;
  payload: ReturnType<typeof extractPersonalAnalysisPayload>;
}): AnalysisRun | null {
  const hasData =
    Boolean(input.payload.analysisReport) ||
    Boolean(input.payload.analysisStructured) ||
    Boolean(input.payload.trendExtraction) ||
    Boolean(input.payload.indicatorRecommendations);
  if (!hasData) {
    return null;
  }
  const timestamp = input.timestamp ?? new Date().toISOString();
  return {
    _id: `personal-${input.symbol}-${timestamp}`,
    symbol: input.symbol,
    source: "manual",
    sessionType: "manual_now",
    queryPrompt: "",
    status: "success",
    triggeredAt: timestamp,
    completedAt: timestamp,
    analysisReport: input.payload.analysisReport,
    analysisStructured: input.payload.analysisStructured,
    trendExtraction: input.payload.trendExtraction,
    indicatorRecommendations: input.payload.indicatorRecommendations,
    error: null,
  };
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
      probabilityPct: Number(
        trendExtraction.bull?.probabilityPct ?? Number.NEGATIVE_INFINITY,
      ),
    },
    {
      key: "flat",
      regime: "Flat",
      probabilityPct: Number(
        trendExtraction.flat?.probabilityPct ?? Number.NEGATIVE_INFINITY,
      ),
    },
    {
      key: "bear",
      regime: "Bear",
      probabilityPct: Number(
        trendExtraction.bear?.probabilityPct ?? Number.NEGATIVE_INFINITY,
      ),
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

function getTradeValue(trade: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in trade) {
      return trade[key];
    }
    const normalizedKey = key.trim().toLowerCase();
    for (const [header, value] of Object.entries(trade)) {
      if (header.trim().toLowerCase() === normalizedKey) {
        return value;
      }
    }
  }
  return undefined;
}

function normalizeTradeForDisplay(trade: JsonRecord): JsonRecord {
  const nextTrade: JsonRecord = {};
  const canonicalFieldAliases: Array<
    [canonicalKey: string, aliases: string[]]
  > = [
    ["outcome", ["outcome", "confirmation_status"]],
    ["entryIndex", ["entryIndex", "entry_i"]],
    ["exitIndex", ["exitIndex", "exit_i"]],
    ["entryTime", ["entryTime", "entry_time"]],
    ["exitTime", ["exitTime", "exit_time"]],
    ["entryPrice", ["entryPrice", "entry"]],
  ];

  for (const [canonicalKey, aliases] of canonicalFieldAliases) {
    const value = getTradeValue(trade, aliases);
    if (value !== undefined) {
      nextTrade[canonicalKey] = value;
    }
  }

  const excludedKeys = new Set(
    canonicalFieldAliases.flatMap(([, aliases]) =>
      aliases.map((alias) => alias.toLowerCase()),
    ),
  );
  for (const [key, value] of Object.entries(trade)) {
    if (!excludedKeys.has(key.toLowerCase())) {
      nextTrade[key] = value;
    }
  }

  return nextTrade;
}

type TradeOutcomeStatus =
  | "take_profit"
  | "stop_loss"
  | "profit"
  | "loss"
  | "breakeven"
  | "open";
type TradeOutcomeView = {
  icon: ReactNode;
  iconClassName: string;
  label: string;
};

function mapTradeOutcomeStatusToView(
  status: TradeOutcomeStatus,
): TradeOutcomeView {
  if (status === "take_profit") {
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
      iconClassName: "border-emerald-400/35 bg-emerald-500/10 text-emerald-300",
      label: "Take profit",
    };
  }
  if (status === "stop_loss") {
    return {
      icon: <XCircle className="h-3.5 w-3.5" aria-hidden="true" />,
      iconClassName: "border-red-400/35 bg-red-500/10 text-red-300",
      label: "Stop loss",
    };
  }
  if (status === "profit") {
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
      iconClassName: "border-emerald-400/35 bg-emerald-500/10 text-emerald-300",
      label: "Profit",
    };
  }
  if (status === "loss") {
    return {
      icon: <XCircle className="h-3.5 w-3.5" aria-hidden="true" />,
      iconClassName: "border-red-400/35 bg-red-500/10 text-red-300",
      label: "Loss",
    };
  }
  if (status === "breakeven") {
    return {
      icon: <Minus className="h-3.5 w-3.5" aria-hidden="true" />,
      iconClassName: "border-amber-400/35 bg-amber-500/10 text-amber-300",
      label: "Breakeven",
    };
  }
  return {
    icon: <Circle className="h-3.5 w-3.5" aria-hidden="true" />,
    iconClassName: "border-sky-400/35 bg-sky-500/10 text-sky-300",
    label: "Open",
  };
}

function parseTradeOutcomeStatus(value: unknown): TradeOutcomeStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }
  if (normalizedValue === "take_profit" || normalizedValue === "take profit") {
    return "take_profit";
  }
  if (normalizedValue === "stop_loss" || normalizedValue === "stop loss") {
    return "stop_loss";
  }
  if (normalizedValue === "profit") {
    return "profit";
  }
  if (normalizedValue === "loss") {
    return "loss";
  }
  if (
    normalizedValue === "breakeven" ||
    normalizedValue === "break_even" ||
    normalizedValue === "break-even"
  ) {
    return "breakeven";
  }
  if (normalizedValue === "open") {
    return "open";
  }
  return null;
}

function getTradeStringValue(
  trade: JsonRecord,
  keys: string | string[],
): string | null {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const value = getTradeValue(trade, keyList);
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function resolveTradeOutcome(trade: JsonRecord): TradeOutcomeView {
  const confirmationStatus = getTradeStringValue(trade, [
    "outcome",
    "confirmation_status",
  ]);
  const parsedStatus = parseTradeOutcomeStatus(confirmationStatus);

  if (parsedStatus) {
    return mapTradeOutcomeStatusToView(parsedStatus);
  }
  return {
    icon: <Circle className="h-3.5 w-3.5" aria-hidden="true" />,
    iconClassName:
      "border-muted-foreground/25 bg-muted/15 text-muted-foreground",
    label: "Unknown",
  };
}

function renderTradeCellValue(header: string, value: unknown): ReactNode {
  const normalizedHeader = header.trim().toLowerCase();
  if (normalizedHeader === "side" && typeof value === "string") {
    return (
      <span
        className={`inline-flex items-center gap-1 ${formatSideToneClass(value)}`}
      >
        {isPositiveSide(value) ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : null}
        {isNegativeSide(value) ? (
          <ArrowDownRight className="h-3.5 w-3.5" />
        ) : null}
        {value}
      </span>
    );
  }
  if (
    (normalizedHeader.includes("pnl") || normalizedHeader.includes("profit")) &&
    typeof value === "number"
  ) {
    return (
      <span className={formatSignedToneClass(value)}>
        {formatCellValue(value)}
      </span>
    );
  }
  return formatCellValue(value);
}

function formatKpiToneClass(label: string, value: string) {
  const normalizedLabel = label.trim().toLowerCase();
  const numericValue = parseDisplayNumber(value);
  if (numericValue === null) {
    return "";
  }

  if (
    normalizedLabel.includes("win_rate") ||
    normalizedLabel.includes("win rate")
  ) {
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

  if (
    normalizedLabel.includes("pnl") ||
    normalizedLabel.includes("profit") ||
    normalizedLabel.includes("return")
  ) {
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
  return value > 0
    ? "font-medium text-emerald-300"
    : "font-medium text-red-300";
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
