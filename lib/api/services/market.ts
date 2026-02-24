import { apiRequest } from "@/lib/api/client";
import type { MarketMetaResponse, MarketOhlcvResponse } from "@/lib/api/types";

export async function getMarketMeta() {
  return apiRequest<MarketMetaResponse>("/api/v1/market/meta");
}

export async function getMarketOhlcv(params: {
  exchange_name?: string;
  symbol: string;
  timeframe: string;
  bars: number;
}) {
  return apiRequest<MarketOhlcvResponse>("/api/v1/market/ohlcv", {
    query: {
      exchange_name: params.exchange_name ?? "bybit",
      symbol: params.symbol,
      timeframe: params.timeframe,
      bars: params.bars,
    },
  });
}
