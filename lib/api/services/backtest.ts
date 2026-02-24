import { apiRequest } from "@/lib/api/client";
import type {
  AtrOrderBlockRequest,
  BacktestCatalogResponse,
  BacktestResponse,
  GridBotRequest,
  IntradayMomentumRequest,
  JsonRecord,
  KnifeCatcherRequest,
  PortfolioBacktestRequest,
  VwapBacktestRequest,
} from "@/lib/api/types";

export async function getBacktestCatalog() {
  return apiRequest<BacktestCatalogResponse>("/api/v1/backtest/catalog");
}

export async function getVwapIndicators() {
  return apiRequest<Record<string, string[]>>("/api/v1/backtest/vwap/indicators");
}

export async function getVwapPresets() {
  return apiRequest<Record<string, string[]>>("/api/v1/backtest/vwap/presets");
}

export async function getVwapRegimes() {
  return apiRequest<Record<string, string[]>>("/api/v1/backtest/vwap/regimes");
}

export async function runVwapBacktest(payload: VwapBacktestRequest) {
  return apiRequest<BacktestResponse>("/api/v1/backtest/vwap", {
    method: "POST",
    body: payload,
  });
}

export async function runAtrOrderBlockBacktest(payload: AtrOrderBlockRequest) {
  return apiRequest<BacktestResponse>("/api/v1/backtest/atr-order-block", {
    method: "POST",
    body: payload,
  });
}

export async function runKnifeCatcherBacktest(payload: KnifeCatcherRequest) {
  return apiRequest<BacktestResponse>("/api/v1/backtest/knife-catcher", {
    method: "POST",
    body: payload,
  });
}

export async function runGridBotBacktest(payload: GridBotRequest) {
  return apiRequest<BacktestResponse>("/api/v1/backtest/grid-bot", {
    method: "POST",
    body: payload,
  });
}

export async function runIntradayMomentumBacktest(payload: IntradayMomentumRequest) {
  return apiRequest<BacktestResponse>("/api/v1/backtest/intraday-momentum", {
    method: "POST",
    body: payload,
  });
}

export async function runPortfolioBacktest(payload: PortfolioBacktestRequest) {
  return apiRequest<JsonRecord>("/api/v1/backtest/portfolio", {
    method: "POST",
    body: payload,
  });
}
