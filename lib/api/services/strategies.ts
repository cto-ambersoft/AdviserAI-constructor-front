import { apiRequest } from "@/lib/api/client";
import type {
  StrategyCreate,
  StrategyMetaResponse,
  StrategyRead,
  StrategyUpdateRequest,
} from "@/lib/api/types";

export async function getStrategiesMeta() {
  return apiRequest<StrategyMetaResponse>("/api/v1/strategies/meta");
}

export async function listStrategies() {
  return apiRequest<StrategyRead[]>("/api/v1/strategies/");
}

export async function createStrategy(payload: StrategyCreate) {
  return apiRequest<StrategyRead>("/api/v1/strategies/", {
    method: "POST",
    body: payload,
  });
}

export async function updateStrategy(strategyId: number, payload: StrategyUpdateRequest) {
  return apiRequest<StrategyRead>(`/api/v1/strategies/${strategyId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteStrategy(strategyId: number) {
  return apiRequest<void>(`/api/v1/strategies/${strategyId}`, {
    method: "DELETE",
  });
}
