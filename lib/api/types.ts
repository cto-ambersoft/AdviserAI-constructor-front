import type { components } from "@/lib/api/openapi-types";
import type { AuthTokenBundle } from "@/lib/auth/token-contract";

export type JsonRecord = Record<string, unknown>;

export type ApiValidationError = components["schemas"]["HTTPValidationError"];
export type ValidationItem = components["schemas"]["ValidationError"];
export type SignUpRequest = components["schemas"]["SignUpRequest"];
export type SignInRequest = components["schemas"]["SignInRequest"];

export type StrategyCreate = components["schemas"]["StrategyCreate"];
export type StrategyRead = components["schemas"]["StrategyRead"];
export type StrategyMetaResponse =
  components["schemas"]["StrategyMetaResponse"];
export type StrategyUpdateRequest = {
  name?: string | null;
  strategy_type?: string | null;
  version?: string | null;
  description?: string | null;
  is_active?: boolean | null;
  config?: JsonRecord | null;
};

type RawVwapBacktestRequest = components["schemas"]["VwapBacktestRequest"];
export type VwapBacktestRequest = RawVwapBacktestRequest & {
  run_with_ai?: boolean;
  ai_forecast_file?: string | null;
  ai_bull_confidence_threshold?: number | null;
  ai_bear_confidence_threshold?: number | null;
};
export type AtrOrderBlockRequest =
  components["schemas"]["AtrOrderBlockRequest"];
export type KnifeCatcherRequest =
  components["schemas"]["KnifeCatcherRequest"] & {
    account_balance?: number;
  };
export type GridBotRequest = components["schemas"]["GridBotRequest"];
export type IntradayMomentumRequest =
  components["schemas"]["IntradayMomentumRequest"];
export type PortfolioStrategyInput =
  components["schemas"]["PortfolioStrategyInput"];
export type PortfolioUserStrategyInput = {
  strategy_id: number;
  allocation_pct: number;
};
export type PortfolioBuiltinStrategyInput = {
  name: string;
  allocation_pct: number;
  config?: JsonRecord;
};
export type PortfolioBacktestRequest = {
  total_capital: number;
  user_strategies?: PortfolioUserStrategyInput[];
  builtin_strategies?: PortfolioBuiltinStrategyInput[];
  strategies?: PortfolioStrategyInput[];
  async_job?: boolean;
};
export type EquityPoint = {
  step: number;
  time: string | null;
  equity: number;
  pnl_usdt: number;
};

export type BacktestSummary = {
  total_trades?: number;
  win_rate?: number;
  total_pnl_usdt?: number;
  initial_balance?: number;
  final_balance?: number;
  total_pnl?: number;
  avg_risk_per_trade?: number;
  r_squared?: number;
  r_cumulative?: number;
  avg_r?: number;
  total_r?: number;
  max_drawdown_pct?: number;
  annualized_return_pct?: number;
  calmar_ratio?: number;
  [k: string]: unknown;
};

export type BacktestTrade = JsonRecord & {
  r_multiple?: number | null;
};

export type BacktestChartPoints = {
  ohlcv?: JsonRecord[];
  equity_curve?: EquityPoint[];
  r_cumulative_curve?: number[];
  r_equity_curve?: number[];
  [k: string]: unknown;
};

export type BacktestResponse = Omit<
  components["schemas"]["BacktestResponse"],
  "summary" | "trades" | "chart_points"
> & {
  summary: BacktestSummary;
  trades: BacktestTrade[];
  chart_points: BacktestChartPoints;
};
export type VwapAiComparisonDelta = {
  total_pnl_delta: number;
  win_rate_delta: number;
  trades_delta: number;
  profit_factor_delta?: number;
  sharpe_proxy_delta?: number;
  max_drawdown_delta?: number;
  calmar_ratio_delta?: number;
};
export type AiForecastBacktestFile = {
  file_name: string;
  modified_at_utc: string;
};
export type AiForecastBacktestFilesResponse = {
  files: AiForecastBacktestFile[];
};
export type VwapAiComparisonResponse = {
  result: BacktestResponse;
  baseline: BacktestResponse;
  comparison: VwapAiComparisonDelta;
};
export type VwapBacktestResponse = BacktestResponse | VwapAiComparisonResponse;
type RawBacktestCatalogResponse =
  components["schemas"]["BacktestCatalogResponse"];
export type BacktestCatalogResponse = Omit<
  RawBacktestCatalogResponse,
  "portfolio"
> & {
  portfolio: RawBacktestCatalogResponse["portfolio"] & {
    builtin_strategy_params?: Record<string, string[]>;
  };
};
export type BuilderSignalRequest =
  components["schemas"]["BuilderSignalRequest"];
export type BuilderSignalRunRequest =
  components["schemas"]["BuilderSignalRunRequest"];
export type AtrObSignalRequest = components["schemas"]["AtrObSignalRequest"];
export type AtrObSignalRunRequest =
  components["schemas"]["AtrObSignalRunRequest"];
export type SignalExecuteRequest =
  components["schemas"]["SignalExecuteRequest"];
export type LiveSignalResult = components["schemas"]["LiveSignalResult"];
export type LivePaperProfileUpsertRequest =
  components["schemas"]["LivePaperProfileUpsertRequest"];
export type LivePaperProfileRead =
  components["schemas"]["LivePaperProfileRead"];
export type LivePaperTradeRead = components["schemas"]["LivePaperTradeRead"];
export type LivePaperEventRead = components["schemas"]["LivePaperEventRead"];
type RawLivePaperPollResponse = components["schemas"]["LivePaperPollResponse"];
export type LivePaperPollResponse = Omit<
  RawLivePaperPollResponse,
  "trades" | "historical_trades" | "live_trades_since_start"
> & {
  live_trades_since_start?: LivePaperTradeRead[];
};
export type LivePaperPlayStopResponse =
  components["schemas"]["LivePaperPlayStopResponse"];

// W7: ``strategy_name`` is added by hand until openapi.json is regenerated.
// Once the pipeline picks up the new schema this intersection becomes a
// no-op (the generated type will already contain the field).
export type AutoTradeConfigUpsertRequest =
  components["schemas"]["AutoTradeConfigUpsertRequest"] & {
    strategy_name?: string | null;
  };
export type AutoTradeConfigRead = components["schemas"]["AutoTradeConfigRead"] & {
  strategy_name?: string | null;
};
export type StrategyProfileConfig = components["schemas"]["StrategyProfileConfig"];
export type StrategyProfileTPLevel =
  components["schemas"]["StrategyProfileTPLevel"];
export type StrategyProfileWatcher =
  components["schemas"]["StrategyProfileWatcher"];
// W8/W9 — nested risk-governance object on the config upsert/read (pre-trade
// limits + KPI-Guard auto-pause + Volatility Kill-Switch). Every limit is
// nullable: `null` = "rule off".
export type AutoTradeRiskConfig = components["schemas"]["AutoTradeRiskConfig"];
export type AutoTradeConfigsResponse =
  components["schemas"]["AutoTradeConfigsResponse"];
export type AutoTradePlayStopResponse =
  components["schemas"]["AutoTradePlayStopResponse"];
export type AutoTradeStateResponse =
  components["schemas"]["AutoTradeStateResponse"];
export type AutoTradeEventRead = components["schemas"]["AutoTradeEventRead"];
export type AutoTradeEventsResponse =
  components["schemas"]["AutoTradeEventsResponse"];
export type AccountTradeRead = components["schemas"]["AccountTradeRead"];
// W9 — precise PnL decomposition (frontend spec §3.2). The four fields are
// additive and nullable (`null` on the fallback path where the symbol has no
// synced ledger fills). `realized` stays GROSS (Σ exchange realizedPnl);
// `net_pnl_usdt = gross − commission + funding` is the authoritative account
// P&L. Hand-written as an intersection until openapi.json is regenerated by
// the backend — at which point this collapses to a no-op.
export type AccountTradesPnlRead =
  components["schemas"]["AccountTradesPnlRead"] & {
    gross_realized_usdt?: number | null;
    commission_usdt?: number | null;
    funding_usdt?: number | null;
    net_pnl_usdt?: number | null;
  };
export type AccountTradesSyncStateRead =
  components["schemas"]["AccountTradesSyncStateRead"];
export type AccountAutoTradeEventRead =
  components["schemas"]["AccountAutoTradeEventRead"];
export type AccountTradesRead = components["schemas"]["AccountTradesRead"];
export type AutoTradePositionRead =
  components["schemas"]["AutoTradePositionRead"];
// W9 — precise PnL decomposition (frontend spec §3.1). On an OPEN position
// `realized_pnl_usdt` is now NET (gross of partial closes − commission +
// funding), not just −commission; `net_pnl_usdt` equals it, and
// `total_pnl_usdt = net + (unrealized ?? 0)`. The four fields are `null` on the
// fallback path (no synced ledger fills) — gate the breakdown on `!= null`.
// Hand-written until openapi.json is regenerated (then this is a no-op).
export type AutoTradePositionPnlRead =
  components["schemas"]["AutoTradePositionPnlRead"] & {
    gross_realized_usdt?: number | null;
    commission_usdt?: number | null;
    funding_usdt?: number | null;
    net_pnl_usdt?: number | null;
  };
export type AutoTradePositionWithPnlRead =
  components["schemas"]["AutoTradePositionWithPnlRead"];
export type AutoTradePositionsSummaryRead =
  components["schemas"]["AutoTradePositionsSummaryRead"];
export type AutoTradePositionsResponse =
  components["schemas"]["AutoTradePositionsResponse"];

// ── Manual close-positions flow ───────────────────────────────────────────
// Backend emits the new schemas in `app/schemas/auto_trade.py`. Kept as
// hand-written types until `openapi.json` is regenerated; field names are
// identical and the type identifiers below match the backend class names so
// a future regeneration is a drop-in replacement.

export type AutoTradeCloseOpenPositionsRequest = {
  account_id?: number | null;
  confirm?: boolean;
  reason?: string | null;
};

export type AutoTradeClosePositionSide = "LONG" | "SHORT";

export type AutoTradeClosePreviewItem = {
  position_id: number;
  symbol: string;
  side: AutoTradeClosePositionSide;
  current_quantity: number;
  entry_price: number;
  current_sl_price: number | null;
  open_conditional_orders_count: number;
};

export type AutoTradeClosePreview = {
  detail: string;
  positions: AutoTradeClosePreviewItem[];
  total_count: number;
  requires_confirm: boolean;
};

export type AutoTradeClosedPositionInfo = {
  position_id: number;
  symbol: string;
  side: AutoTradeClosePositionSide;
  executed_qty: number;
  avg_price: number | null;
  cancelled_conditional_orders: string[];
};

export type AutoTradeFailedClosePositionInfo = {
  position_id: number;
  symbol: string;
  error: string;
};

export type AutoTradeCloseOpenPositionsResponse = {
  closed: AutoTradeClosedPositionInfo[];
  failed: AutoTradeFailedClosePositionInfo[];
  skipped_already_closed: number[];
};

// ── W7 Multi-Strategy Partitioning · W9 live KPIs ─────────────────────────
// OpenAPI-derived (contract regenerated 2026-06-12). The W9 wave added the
// per-strategy live-KPI fields (win_rate_pct / max_dd_pct / sharpe_proxy /
// roi_pct / health_class / sample_size) and the portfolio-level
// portfolio_max_dd_pct — the prior hand-written shapes omitted them all.
// NOTE (W9 proxy, review I3): roi_pct / max_dd_pct are normalized by the
// per-trade notional (position_size_usdt), NOT account equity, and can read
// high — any UI that shows them MUST label the denominator.
export type StrategyPortfolioEntry =
  components["schemas"]["StrategyPortfolioEntryRead"];
export type PortfolioSummaryResponse =
  components["schemas"]["PortfolioSummaryResponse"];

// W9 — on-read composite Strategy Health Score and Post-Trade execution trace.
export type StrategyHealthRead = components["schemas"]["StrategyHealthRead"];
export type PositionTraceRead = components["schemas"]["PositionTraceRead"];

// B5 (W10) — Strategy Promotion Pipeline: lifecycle stage + KPI-gate readiness.
export type PromotionStatusRead =
  components["schemas"]["PromotionStatusRead"];
export type PromotionGateCriterion =
  components["schemas"]["PromotionGateCriterionRead"];
export type LifecycleStage = StrategyPortfolioEntry["lifecycle_stage"];

export type BulkLifecycleResultItem = {
  config_id: number;
  account_id: number;
  strategy_name?: string | null;
  status: "ok" | "skipped" | "failed";
  reason?: string | null;
  error?: string | null;
};

export type BulkLifecycleResponse = {
  requested: number;
  succeeded: number;
  skipped: number;
  failed: number;
  results: BulkLifecycleResultItem[];
};

export type AccountBalanceResponse = {
  account_id: number;
  exchange_name: string;
  mode: string;
  free_usdt: number | null;
  total_usdt: number | null;
  error: string | null;
};

export type MarketMetaResponse = components["schemas"]["MarketMetaResponse"];
export type MarketOhlcvResponse = components["schemas"]["MarketOhlcvResponse"];
export type CandleInput = components["schemas"]["CandleInput"];

export type TokenResponse = components["schemas"]["TokenResponse"];
type RawUserRead = components["schemas"]["UserRead"];
export type UserRead = RawUserRead & {
  is_admin?: boolean;
};
export type AuthTokens = AuthTokenBundle;

export type AuthUserResponse = {
  user: UserRead;
  token: AuthTokens;
};

// 2FA (TOTP) + step-up — M4. Contract already synced in openapi-types.ts.
export type TotpEnrollResponse =
  components["schemas"]["TotpEnrollResponse"];
export type TotpVerifyRequest = components["schemas"]["TotpVerifyRequest"];
export type TotpStatusResponse =
  components["schemas"]["TotpStatusResponse"];
export type StepUpResponse = components["schemas"]["StepUpResponse"];
export type StepUpRequest = components["schemas"]["StepUpRequest"];

// Email-2FA (email as a full second factor). Enroll → confirm → status → disable;
// also drives the step-up and login email paths.
export type Email2FAStatusResponse =
  components["schemas"]["Email2FAStatusResponse"];
export type Email2FAConfirmRequest =
  components["schemas"]["Email2FAConfirmRequest"];
export type Email2FACodeSentResponse =
  components["schemas"]["Email2FACodeSentResponse"];
export type TwoFactorLoginEmailRequest =
  components["schemas"]["TwoFactorLoginEmailRequest"];

// Canonical second-factor identifiers advertised by the signin challenge.
export type TwoFactorMethod = "totp" | "email";

// Login-2FA — M4 §1b. signin returns the token bundle OR a 2FA challenge.
export type TwoFactorRequiredResponse =
  components["schemas"]["TwoFactorRequiredResponse"];
export type TwoFactorLoginRequest =
  components["schemas"]["TwoFactorLoginRequest"];
export type SignInResponse = AuthTokenBundle | TwoFactorRequiredResponse;

export type AuditLogCreateRequest = {
  event: string;
  reason?: string;
  target_type?: string;
  target_id?: string;
  payload?: Record<string, unknown>;
};

export type AuditLogRead = components["schemas"]["AuditLogRead"];
export type AuditMetaResponse = components["schemas"]["AuditMetaResponse"];

export type ExchangeAccountCreate =
  components["schemas"]["ExchangeAccountCreate"];
export type ExchangeAccountRead = components["schemas"]["ExchangeAccountRead"];
export type ExchangeAccountUpdate =
  components["schemas"]["ExchangeAccountUpdate"];
export type ExchangeAccountValidateResponse =
  components["schemas"]["ExchangeAccountValidateResponse"];
export type ExchangeAccountsMetaResponse =
  components["schemas"]["ExchangeAccountsMetaResponse"];

export type SpotOrderCreate = {
  account_id: number;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  amount: number;
  price?: number | null;
  client_order_id?: string | null;
};
export type SpotOrderRead = {
  order_id: string;
  status: string;
  symbol: string;
  side: string;
  type: string;
  price?: number | null;
  amount?: number;
  filled?: number;
  created_at?: string | null;
  [k: string]: unknown;
};
export type NormalizedOrder = Record<string, unknown>;
export type NormalizedTrade = Record<string, unknown>;
export type NormalizedBalance = Record<string, unknown>;
export type SpotPositionView = Record<string, unknown>;
export type SpotPnlAsset = {
  asset: string;
  free: number;
  locked: number;
  avg_buy_price: number;
  qty: number;
  market_price: number;
  quote_value: number;
  unrealized_pnl_quote: number;
  realized_pnl_quote: number;
  total_fees_quote: number;
  [k: string]: unknown;
};
export type SpotOrdersRead = {
  orders: NormalizedOrder[];
  [k: string]: unknown;
};
export type SpotTradesRead = {
  trades: NormalizedTrade[];
  [k: string]: unknown;
};
export type SpotBalancesRead = {
  balances: NormalizedBalance[];
  [k: string]: unknown;
};
export type SpotPositionsRead = {
  positions: SpotPositionView[];
  [k: string]: unknown;
};
export type SpotPnlRead = {
  realized_pnl_quote: number;
  unrealized_pnl_quote: number;
  total_fees_quote: number;
  assets?: SpotPnlAsset[];
  [k: string]: unknown;
};

export type AttachedTriggerOrder = {
  trigger_price: number;
  order_type?: "market" | "limit";
  price?: number | null;
};

export type SpotOrderCreateRequest = SpotOrderCreate & {
  attached_take_profit?: AttachedTriggerOrder | null;
  attached_stop_loss?: AttachedTriggerOrder | null;
};

export type AIAgentPrompt = components["schemas"]["AIAgentPrompt"];
export type AIAgentResponse = components["schemas"]["AIAgentResponse"];

export type AnalysisRunStatus = "running" | "success" | "failed";
export type AnalysisRunSource = "manual" | "cron";
export type AnalysisSessionType =
  | "manual_now"
  | "asia_morning"
  | "asia_day"
  | "us_1330"
  | "us_1430";

export type TrendScenario = {
  probabilityPct: number;
  takeProfit: number | null;
  stopLoss: number | null;
};

export type AnalysisTrendExtraction = {
  bull?: TrendScenario;
  bear?: TrendScenario;
  flat?: TrendScenario;
};

export type IndicatorRecommendationScenario = {
  probabilityPct: number;
  takeProfit: number | null;
  stopLoss: number | null;
  indicatorSet: string[];
};

export type IndicatorRecommendations = {
  recommendedFromAvailable: string[];
  additionalSuggested: string[];
  rationale: string;
  bull?: IndicatorRecommendationScenario;
  bear?: IndicatorRecommendationScenario;
  flat?: IndicatorRecommendationScenario;
};

export type AnalysisStructured = {
  symbol?: string;
  timestamp?: string;
  currentPrice?: number;
  bias?: string;
  confidence?: number;
} & JsonRecord;

export type AnalysisRun = {
  _id: string;
  symbol: string;
  source: AnalysisRunSource;
  sessionType: AnalysisSessionType | string;
  queryPrompt: string;
  status: AnalysisRunStatus;
  triggeredAt: string;
  completedAt?: string | null;
  analysisReport?: string | null;
  analysisStructured?: AnalysisStructured | null;
  trendExtraction?: AnalysisTrendExtraction | null;
  indicatorRecommendations?: IndicatorRecommendations | null;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AnalysisRunsResponse = {
  total: number;
  filter?: {
    date?: string | null;
    limit?: number | string | null;
  };
  runs: AnalysisRun[];
};

export type TriggerAnalysisNowResponse = {
  status: "accepted";
  message: string;
  jobId: string;
  triggeredAt: string;
  source: AnalysisRunSource;
  sessionType: AnalysisSessionType | string;
};

export type PersonalAgentFlags = Record<string, boolean>;
export type PersonalAgentWeights = Record<string, number>;

export type PersonalAnalysisDefaultsRead = {
  available_agents: string[];
  agents: PersonalAgentFlags;
  agent_weights: PersonalAgentWeights;
};

export type PersonalAnalysisProfileCreate = {
  symbol: string;
  query_prompt?: string | null;
  agents?: PersonalAgentFlags | null;
  agent_weights?: PersonalAgentWeights | null;
  interval_minutes?: number;
  debate_enabled?: boolean | null;
};

export type PersonalAnalysisProfileUpdate = {
  symbol?: string | null;
  query_prompt?: string | null;
  agents?: PersonalAgentFlags | null;
  agent_weights?: PersonalAgentWeights | null;
  interval_minutes?: number | null;
  is_active?: boolean | null;
  debate_enabled?: boolean | null;
};

export type PersonalAnalysisProfileRead = {
  id: number;
  user_id: number;
  symbol: string;
  query_prompt: string | null;
  agents: PersonalAgentFlags;
  agent_weights: PersonalAgentWeights;
  interval_minutes: number;
  is_active: boolean;
  debate_enabled: boolean | null;
  next_run_at: string;
  last_triggered_at: string | null;
  last_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalAnalysisManualTriggerRequest = {
  query_prompt?: string | null;
  agents?: PersonalAgentFlags | null;
  agent_weights?: PersonalAgentWeights | null;
  debate_enabled?: boolean | null;
};

export type PersonalAnalysisManualTriggerResponse = {
  trade_job_id: string;
  core_job_id: string;
  status: string;
  created_at: string;
};

export type PersonalAnalysisJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | string;

export type PersonalAnalysisJobRead = {
  id: string;
  user_id: number;
  profile_id: number;
  core_job_id: string;
  status: PersonalAnalysisJobStatus;
  attempt: number;
  max_attempts: number;
  error: string | null;
  next_poll_at: string;
  completed_at: string | null;
  core_deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalAnalysisHistoryRead = {
  id: number;
  user_id: number;
  profile_id: number;
  trade_job_id: string;
  symbol: string;
  analysis_data: JsonRecord;
  core_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminRuntimePositionsStatus = "all" | "open";

export type AdminRuntimeQuery = {
  include_inactive_users?: boolean;
  positions_status?: AdminRuntimePositionsStatus;
  after_user_id?: number;
  users_limit?: number;
  include_details?: boolean;
  strategies_limit_per_user?: number;
  configs_limit_per_user?: number;
  positions_limit_per_user?: number;
};

export type AdminRuntimeSummaryRead = {
  total_users: number;
  active_users: number;
  admin_users: number;
  total_strategies: number;
  active_strategies: number;
  total_auto_trade_configs: number;
  running_auto_trade_configs: number;
  total_auto_trade_positions: number;
  open_auto_trade_positions: number;
  running_live_paper_profiles: number;
};

export type AdminRuntimePageRead = {
  users_limit: number;
  after_user_id?: number | null;
  next_after_user_id?: number | null;
  has_more?: boolean;
};

export type AdminUserRead = {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminUserRuntimeStatsRead = {
  total_strategies: number;
  active_strategies: number;
  auto_trade_configs: number;
  running_auto_trade_configs: number;
  auto_trade_positions: number;
  open_auto_trade_positions: number;
  live_paper_running?: boolean;
};

export type AdminStrategyRead = {
  id: number;
  user_id: number;
  name: string;
  strategy_type: string;
  version: string;
  description: string | null;
  is_active: boolean;
  config: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type AdminAutoTradeConfigRead = {
  id: number;
  user_id: number;
  profile_id: number;
  account_id: number;
  enabled: boolean;
  is_running: boolean;
  position_size_usdt: number;
  leverage: number;
  min_confidence_pct: number;
  fast_close_confidence_pct: number;
  confirm_reports_required: number;
  risk_mode: string;
  sl_pct: number;
  tp_pct: number;
  last_started_at: string | null;
  last_stopped_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAutoTradePositionRead = {
  id: number;
  user_id: number;
  config_id: number;
  profile_id: number;
  account_id: number;
  symbol: string;
  side: string;
  status: string;
  entry_price: number;
  quantity: number;
  position_size_usdt: number;
  leverage: number;
  tp_price: number;
  sl_price: number;
  entry_confidence_pct: number;
  opened_at: string;
  closed_at: string | null;
  close_reason: string | null;
  close_price: number | null;
  open_order_id: string | null;
  close_order_id: string | null;
  open_history_id: number | null;
  close_history_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AdminLivePaperProfileRead = {
  id: number;
  user_id: number;
  strategy_id: number;
  strategy_revision: number;
  is_running: boolean;
  total_balance_usdt: number;
  per_trade_usdt: number;
  last_processed_at: string | null;
  last_poll_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserRuntimeRead = {
  user: AdminUserRead;
  stats: AdminUserRuntimeStatsRead;
  strategies_truncated?: boolean;
  auto_trade_configs_truncated?: boolean;
  auto_trade_positions_truncated?: boolean;
  strategies?: AdminStrategyRead[];
  auto_trade_configs?: AdminAutoTradeConfigRead[];
  auto_trade_positions?: AdminAutoTradePositionRead[];
  live_paper_profile?: AdminLivePaperProfileRead | null;
};

export type AdminRuntimeSnapshotResponse = {
  generated_at: string;
  summary: AdminRuntimeSummaryRead;
  page: AdminRuntimePageRead;
  users?: AdminUserRuntimeRead[];
};

// Telegram trade notifications.
export type TelegramSettingsOut = components["schemas"]["TelegramSettingsOut"];
export type TelegramSettingsUpdate =
  components["schemas"]["TelegramSettingsUpdate"];
export type TelegramLinkOut = components["schemas"]["TelegramLinkOut"];
export type TelegramTestResult = components["schemas"]["TelegramTestResult"];
