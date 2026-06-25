import { apiRequest } from "@/lib/api/client";
import type {
  AccountBalanceResponse,
  AutoTradeCloseOpenPositionsRequest,
  AutoTradeCloseOpenPositionsResponse,
  AutoTradeConfigRead,
  AutoTradeConfigsResponse,
  AutoTradeConfigUpsertRequest,
  AutoTradeEventsResponse,
  AutoTradePositionsResponse,
  AutoTradePlayStopResponse,
  AutoTradeStateResponse,
  BulkLifecycleResponse,
  PortfolioSummaryResponse,
  PositionTraceRead,
  PromotionStatusRead,
  StrategyHealthRead,
} from "@/lib/api/types";

type AutoTradeScopeQuery = {
  account_id?: number;
  // W7 asset-expansion: when two configs share an account (e.g. BTC + ETH on
  // the same sub-account), the UI scopes by ``config_id`` instead of (or in
  // addition to) account_id to keep their data streams separate.
  config_id?: number;
};

type AutoTradeEventsQuery = {
  limit?: number;
  account_id?: number;
  config_id?: number;
};

type AutoTradePositionsQuery = {
  limit?: number;
  status?: "open" | "closed" | "error";
  account_id?: number;
  config_id?: number;
};

export async function listAutoTradeConfigs() {
  return apiRequest<AutoTradeConfigsResponse>(
    "/api/v1/live/auto-trade/configs",
    {
      method: "GET",
    },
  );
}

export async function getAutoTradeConfig(query: AutoTradeScopeQuery = {}) {
  return apiRequest<AutoTradeConfigRead>("/api/v1/live/auto-trade/config", {
    method: "GET",
    query,
  });
}

export async function upsertAutoTradeConfig(
  payload: AutoTradeConfigUpsertRequest,
) {
  return apiRequest<AutoTradeConfigRead>("/api/v1/live/auto-trade/config", {
    method: "PUT",
    body: payload,
  });
}

// ---------------------------------------------------------------------------
// W4 / AI Trend Overlay — opt-in runtime adaptation of auto-trade params.
// ---------------------------------------------------------------------------

export type AiOverlayConfig = {
  enabled: boolean;
  entry_side_lock_enabled: boolean;
  atr_scaling_enabled: boolean;
  rsi_scaling_enabled: boolean;
  stale_max_minutes: number;
  min_strength: number;
  atr_scale_range: [number, number];
  rsi_max_shift: number;
};

export type AiOverlayConfigResponse = {
  config: AiOverlayConfig;
};

export type AiOverlayConfigUpdateRequest = Partial<AiOverlayConfig>;

export async function getAiOverlayConfig(query: AutoTradeScopeQuery = {}) {
  return apiRequest<AiOverlayConfigResponse>(
    "/api/v1/live/auto-trade/ai-overlay/config",
    {
      method: "GET",
      query,
    },
  );
}

export async function updateAiOverlayConfig(
  payload: AiOverlayConfigUpdateRequest,
  query: AutoTradeScopeQuery = {},
) {
  return apiRequest<AiOverlayConfigResponse>(
    "/api/v1/live/auto-trade/ai-overlay/config",
    {
      method: "PUT",
      body: payload,
      query,
    },
  );
}

export async function playAutoTrade(query: AutoTradeScopeQuery = {}) {
  return apiRequest<AutoTradePlayStopResponse>("/api/v1/live/auto-trade/play", {
    method: "POST",
    query,
  });
}

export async function stopAutoTrade(query: AutoTradeScopeQuery = {}) {
  return apiRequest<AutoTradePlayStopResponse>("/api/v1/live/auto-trade/stop", {
    method: "POST",
    query,
  });
}

export async function getAutoTradeState(query: AutoTradeScopeQuery = {}) {
  return apiRequest<AutoTradeStateResponse>("/api/v1/live/auto-trade/state", {
    method: "GET",
    query,
  });
}

export async function getAutoTradeEvents(query: AutoTradeEventsQuery = {}) {
  return apiRequest<AutoTradeEventsResponse>("/api/v1/live/auto-trade/events", {
    method: "GET",
    query,
  });
}

export async function getAutoTradePositions(query: AutoTradePositionsQuery = {}) {
  return apiRequest<AutoTradePositionsResponse>(
    "/api/v1/live/auto-trade/positions",
    {
      method: "GET",
      query,
    },
  );
}

export async function closeAutoTradePositions(
  payload: AutoTradeCloseOpenPositionsRequest,
) {
  return apiRequest<AutoTradeCloseOpenPositionsResponse>(
    "/api/v1/live/auto-trade/close-positions",
    {
      method: "POST",
      body: payload,
    },
  );
}

// ---------------------------------------------------------------------------
// W7 / Multi-Strategy Partitioning — aggregated portfolio, bulk lifecycle,
// and per-strategy sub-account balance.
// ---------------------------------------------------------------------------

export async function getAutoTradePortfolio() {
  return apiRequest<PortfolioSummaryResponse>(
    "/api/v1/live/auto-trade/portfolio",
    {
      method: "GET",
    },
  );
}

export async function playAllAutoTrade() {
  return apiRequest<BulkLifecycleResponse>(
    "/api/v1/live/auto-trade/play-all",
    {
      method: "POST",
    },
  );
}

export async function stopAllAutoTrade() {
  return apiRequest<BulkLifecycleResponse>(
    "/api/v1/live/auto-trade/stop-all",
    {
      method: "POST",
    },
  );
}

export async function getAutoTradeBalance(accountId: number) {
  return apiRequest<AccountBalanceResponse>(
    "/api/v1/live/auto-trade/balance",
    {
      method: "GET",
      query: { account_id: accountId },
    },
  );
}

// ---------------------------------------------------------------------------
// W9 / Strategy Health Score — on-read composite (win rate, drawdown, PnL,
// Sharpe-proxy, stability) for one strategy over a rolling window.
// ---------------------------------------------------------------------------

export async function getStrategyHealth(
  configId: number,
  query: { window_days?: number } = {},
) {
  return apiRequest<StrategyHealthRead>(
    `/api/v1/live/auto-trade/strategies/${configId}/health`,
    {
      method: "GET",
      query,
    },
  );
}

// ---------------------------------------------------------------------------
// W9 / Post-Trade execution trace — signal→close timeline for one position
// (position metadata + linkage pointers + chronological AutoTradeEvent list).
// ---------------------------------------------------------------------------

export async function getPositionTrace(positionId: number) {
  return apiRequest<PositionTraceRead>(
    `/api/v1/live/auto-trade/positions/${positionId}/trace`,
    {
      method: "GET",
    },
  );
}

// ---------------------------------------------------------------------------
// B5 (W10) — Strategy Promotion Pipeline. promote/demote are step-up gated
// (see lib/api/step-up.ts); the client injects X-Step-Up-Token transparently.
// ---------------------------------------------------------------------------

export async function getPromotionStatus(configId: number) {
  return apiRequest<PromotionStatusRead>(
    `/api/v1/live/auto-trade/strategies/${configId}/promotion-status`,
    { method: "GET" },
  );
}

export async function promoteStrategy(configId: number) {
  return apiRequest<AutoTradeConfigRead>(
    `/api/v1/live/auto-trade/strategies/${configId}/promote`,
    { method: "POST" },
  );
}

export async function demoteStrategy(configId: number) {
  return apiRequest<AutoTradeConfigRead>(
    `/api/v1/live/auto-trade/strategies/${configId}/demote`,
    { method: "POST" },
  );
}
