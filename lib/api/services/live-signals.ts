import { apiRequest } from "@/lib/api/client";
import type {
  AtrObSignalRunRequest,
  BuilderSignalRunRequest,
  LiveSignalResult,
} from "@/lib/api/types";

export async function runBuilderLiveSignal(payload: BuilderSignalRunRequest) {
  return apiRequest<LiveSignalResult>("/api/v1/live/signals/builder", {
    method: "POST",
    body: payload,
  });
}

export async function runAtrObLiveSignal(payload: AtrObSignalRunRequest) {
  return apiRequest<LiveSignalResult>("/api/v1/live/signals/atr-order-block", {
    method: "POST",
    body: payload,
  });
}
