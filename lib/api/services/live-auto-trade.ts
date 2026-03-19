import { apiRequest } from "@/lib/api/client";
import type {
  AutoTradeConfigRead,
  AutoTradeConfigsResponse,
  AutoTradeConfigUpsertRequest,
  AutoTradeEventsResponse,
  AutoTradePositionsResponse,
  AutoTradePlayStopResponse,
  AutoTradeStateResponse,
} from "@/lib/api/types";

type AutoTradeScopeQuery = {
  account_id?: number;
};

type AutoTradeEventsQuery = {
  limit?: number;
  account_id?: number;
};

type AutoTradePositionsQuery = {
  limit?: number;
  status?: "open" | "closed" | "error";
  account_id?: number;
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
