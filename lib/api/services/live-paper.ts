import { apiRequest } from "@/lib/api/client";
import type {
  LivePaperPlayStopResponse,
  LivePaperPollResponse,
  LivePaperProfileRead,
  LivePaperProfileUpsertRequest,
} from "@/lib/api/types";

type LivePaperPollQuery = {
  last_trade_id?: number;
  last_event_id?: number;
  limit?: number;
};

export async function upsertLivePaperProfile(
  payload: LivePaperProfileUpsertRequest,
) {
  return apiRequest<LivePaperProfileRead>("/api/v1/live/paper/profile", {
    method: "PUT",
    body: payload,
  });
}

export async function playLivePaper() {
  return apiRequest<LivePaperPlayStopResponse>("/api/v1/live/paper/play", {
    method: "POST",
  });
}

export async function stopLivePaper() {
  return apiRequest<LivePaperPlayStopResponse>("/api/v1/live/paper/stop", {
    method: "POST",
  });
}

export async function pollLivePaper(query: LivePaperPollQuery = {}) {
  return apiRequest<LivePaperPollResponse>("/api/v1/live/paper/poll", {
    method: "GET",
    query,
  });
}
