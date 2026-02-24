import type { components } from "@/lib/api/openapi-types";
import type { AuthTokenBundle } from "@/lib/auth/token-contract";

export type JsonRecord = Record<string, unknown>;

export type ApiValidationError = components["schemas"]["HTTPValidationError"];
export type ValidationItem = components["schemas"]["ValidationError"];
export type SignUpRequest = components["schemas"]["SignUpRequest"];
export type SignInRequest = components["schemas"]["SignInRequest"];

export type StrategyCreate = components["schemas"]["StrategyCreate"];
export type StrategyRead = components["schemas"]["StrategyRead"];
export type StrategyMetaResponse = components["schemas"]["StrategyMetaResponse"];

export type VwapBacktestRequest = components["schemas"]["VwapBacktestRequest"];
export type AtrOrderBlockRequest = components["schemas"]["AtrOrderBlockRequest"];
export type KnifeCatcherRequest = components["schemas"]["KnifeCatcherRequest"];
export type GridBotRequest = components["schemas"]["GridBotRequest"];
export type IntradayMomentumRequest = components["schemas"]["IntradayMomentumRequest"];
export type PortfolioBacktestRequest = components["schemas"]["PortfolioBacktestRequest"];
export type PortfolioStrategyInput = components["schemas"]["PortfolioStrategyInput"];
export type BacktestResponse = components["schemas"]["BacktestResponse"];
export type BacktestCatalogResponse = components["schemas"]["BacktestCatalogResponse"];
export type BuilderSignalRequest = components["schemas"]["BuilderSignalRequest"];
export type BuilderSignalRunRequest = components["schemas"]["BuilderSignalRunRequest"];
export type AtrObSignalRequest = components["schemas"]["AtrObSignalRequest"];
export type AtrObSignalRunRequest = components["schemas"]["AtrObSignalRunRequest"];
export type SignalExecuteRequest = components["schemas"]["SignalExecuteRequest"];
export type LiveSignalResult = components["schemas"]["LiveSignalResult"];

export type MarketMetaResponse = components["schemas"]["MarketMetaResponse"];
export type MarketOhlcvResponse = components["schemas"]["MarketOhlcvResponse"];
export type CandleInput = components["schemas"]["CandleInput"];

export type TokenResponse = components["schemas"]["TokenResponse"];
export type UserRead = components["schemas"]["UserRead"];
export type AuthTokens = AuthTokenBundle;

export type AuthUserResponse = {
  user: UserRead;
  token: AuthTokens;
};

export type AuditLogCreateRequest = {
  event: string;
  reason?: string;
  target_type?: string;
  target_id?: string;
  payload?: Record<string, unknown>;
};

export type AuditLogRead = components["schemas"]["AuditLogRead"];
export type AuditMetaResponse = components["schemas"]["AuditMetaResponse"];

export type ExchangeSecretIn = components["schemas"]["ExchangeSecretIn"];
export type ExchangeSecretOut = components["schemas"]["ExchangeSecretOut"];
export type ExchangeAccountCreate = components["schemas"]["ExchangeAccountCreate"];
export type ExchangeAccountRead = components["schemas"]["ExchangeAccountRead"];
export type ExchangeAccountUpdate = components["schemas"]["ExchangeAccountUpdate"];
export type ExchangeAccountValidateResponse = components["schemas"]["ExchangeAccountValidateResponse"];
export type ExchangeAccountsMetaResponse = components["schemas"]["ExchangeAccountsMetaResponse"];

export type SpotOrderCreate = components["schemas"]["SpotOrderCreate"];
export type SpotOrderRead = components["schemas"]["SpotOrderRead"];
export type SpotOrdersRead = components["schemas"]["SpotOrdersRead"];
export type SpotTradesRead = components["schemas"]["SpotTradesRead"];
export type SpotBalancesRead = components["schemas"]["SpotBalancesRead"];
export type SpotPositionsRead = components["schemas"]["SpotPositionsRead"];
export type SpotPnlRead = components["schemas"]["SpotPnlRead"];
export type NormalizedOrder = components["schemas"]["NormalizedOrder"];
export type NormalizedTrade = components["schemas"]["NormalizedTrade"];
export type NormalizedBalance = components["schemas"]["NormalizedBalance"];
export type SpotPositionView = components["schemas"]["SpotPositionView"];
export type SpotPnlAsset = components["schemas"]["SpotPnlAsset"];

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
