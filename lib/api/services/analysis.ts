import { ApiError, apiRequest } from "@/lib/api/client";
import type {
  AnalysisRunsResponse,
  PersonalAnalysisDefaultsRead,
  PersonalAnalysisHistoryRead,
  PersonalAnalysisJobRead,
  PersonalAnalysisManualTriggerRequest,
  PersonalAnalysisManualTriggerResponse,
  PersonalAnalysisProfileCreate,
  PersonalAnalysisProfileRead,
  PersonalAnalysisProfileUpdate,
  TriggerAnalysisNowResponse,
} from "@/lib/api/types";

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

export async function getPersonalAnalysisDefaults() {
  return apiRequest<PersonalAnalysisDefaultsRead>("/api/v1/analysis/personal/defaults");
}

export async function listPersonalAnalysisProfiles() {
  try {
    return await apiRequest<PersonalAnalysisProfileRead[]>(
      "/api/v1/analysis/personal/profiles",
    );
  } catch (error) {
    // Some backend versions can respond with 404 when user has no profiles yet.
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function createPersonalAnalysisProfile(
  payload: PersonalAnalysisProfileCreate,
) {
  return apiRequest<PersonalAnalysisProfileRead>("/api/v1/analysis/personal/profiles", {
    method: "POST",
    body: payload,
  });
}

export async function updatePersonalAnalysisProfile(
  profileId: number,
  payload: PersonalAnalysisProfileUpdate,
) {
  return apiRequest<PersonalAnalysisProfileRead>(
    `/api/v1/analysis/personal/profiles/${profileId}`,
    {
      method: "PUT",
      body: payload,
    },
  );
}

export async function deletePersonalAnalysisProfile(profileId: number) {
  return apiRequest<void>(`/api/v1/analysis/personal/profiles/${profileId}`, {
    method: "DELETE",
  });
}

export async function triggerPersonalAnalysisProfile(
  profileId: number,
  payload: PersonalAnalysisManualTriggerRequest = {},
) {
  return apiRequest<PersonalAnalysisManualTriggerResponse>(
    `/api/v1/analysis/personal/profiles/${profileId}/trigger`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function getPersonalAnalysisJob(tradeJobId: string) {
  return apiRequest<PersonalAnalysisJobRead>(
    `/api/v1/analysis/personal/jobs/${encodeURIComponent(tradeJobId)}`,
  );
}

export async function listPersonalAnalysisHistory(params: {
  profileId?: number;
  limit?: number;
  before?: string;
}) {
  return apiRequest<PersonalAnalysisHistoryRead[]>("/api/v1/analysis/personal/history", {
    query: {
      profile_id: params.profileId,
      limit: params.limit,
      before: params.before,
    },
  });
}

export async function getPersonalAnalysisLatest(params: {
  profileId?: number;
  symbol?: string;
}) {
  return apiRequest<PersonalAnalysisHistoryRead>("/api/v1/analysis/personal/latest", {
    query: {
      profile_id: params.profileId,
      symbol: params.symbol,
    },
  });
}
