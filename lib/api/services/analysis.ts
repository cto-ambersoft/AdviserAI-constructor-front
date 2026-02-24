import { apiRequest } from "@/lib/api/client";
import type { AnalysisRunsResponse, TriggerAnalysisNowResponse } from "@/lib/api/types";

export async function triggerAnalysisNow() {
  return apiRequest<TriggerAnalysisNowResponse>("/api/v1/analysis/trigger-now", {
    method: "POST",
  });
}

export async function listAnalysisRuns(params?: { date?: string; limit?: number }) {
  return apiRequest<AnalysisRunsResponse>("/api/v1/analysis/runs", {
    query: {
      date: params?.date,
      limit: params?.limit,
    },
  });
}
