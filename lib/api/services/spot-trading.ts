import { apiRequest } from "@/lib/api/client";
import type {
  SpotBalancesRead,
  SpotOrderCreateRequest,
  SpotOrderRead,
  SpotOrdersRead,
  SpotPnlRead,
  SpotPositionsRead,
  SpotTradesRead,
} from "@/lib/api/types";

type SpotListQuery = {
  account_id: number;
  symbol?: string;
  limit?: number;
};

export async function placeSpotOrder(payload: SpotOrderCreateRequest) {
  return apiRequest<SpotOrderRead>("/api/v1/trading/spot/orders", {
    method: "POST",
    body: payload,
  });
}

export async function cancelSpotOrder(params: { order_id: string; account_id: number; symbol?: string }) {
  return apiRequest<SpotOrderRead>(`/api/v1/trading/spot/orders/${params.order_id}`, {
    method: "DELETE",
    query: {
      account_id: params.account_id,
      symbol: params.symbol,
    },
  });
}

export async function getOpenSpotOrders(params: SpotListQuery) {
  return apiRequest<SpotOrdersRead>("/api/v1/trading/spot/orders/open", {
    query: params,
  });
}

export async function getSpotOrderHistory(params: SpotListQuery) {
  return apiRequest<SpotOrdersRead>("/api/v1/trading/spot/orders/history", {
    query: params,
  });
}

export async function getSpotTrades(params: SpotListQuery) {
  return apiRequest<SpotTradesRead>("/api/v1/trading/spot/trades", {
    query: params,
  });
}

export async function getSpotBalances(accountId: number) {
  return apiRequest<SpotBalancesRead>("/api/v1/trading/spot/balances", {
    query: { account_id: accountId },
  });
}

export async function getSpotPositions(params: { account_id: number; quote_asset?: string }) {
  return apiRequest<SpotPositionsRead>("/api/v1/trading/spot/positions", {
    query: params,
  });
}

export async function getSpotPnl(params: { account_id: number; quote_asset?: string; limit?: number }) {
  return apiRequest<SpotPnlRead>("/api/v1/trading/spot/pnl", {
    query: params,
  });
}
