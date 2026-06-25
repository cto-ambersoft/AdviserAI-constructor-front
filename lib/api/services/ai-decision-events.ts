/**
 * W2 traceability — read-only client for ai_decision_events.
 *
 * Proxies through constructor's `/api/v1/ai-backtests/ai-decision-events`
 * which in turn fetches from core. Used by the AI Decisions tab in the
 * live auto-trade dashboard to display the canonical AI decision history
 * with per-agent reasoning path.
 */

import { apiRequest } from "@/lib/api/client";
import type { JsonRecord } from "@/lib/api/types";

export type AiTrendDirection = "up" | "down" | "flat";

export interface AiReasoningEntry {
  agentKey?: string | null;
  agent_key?: string | null;
  signal?: string | null;
  confidence?: number | null;
  weight?: number | null;
  summary?: string | null;
  publicCode?: string | null;
}

export interface AiTrendShape {
  direction: AiTrendDirection;
  strength: number;
  probabilitiesPct?: {
    up: number;
    down: number;
    flat: number;
  };
}

export interface AiDecisionEvent {
  eventId: string;
  jobId?: string | null;
  symbol: string;
  aiConfigId?: string | null;
  agentWeightsId?: string | null;
  occurredAt: string;
  aiTrend: AiTrendShape;
  perAgent?: AiReasoningEntry[];
  outcomeJoinKey?: string;
  resultSnapshot?: JsonRecord | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListDecisionEventsQuery {
  symbol?: string;
  ai_config_id?: string;
  job_id?: string;
  agent_key?: string;
  from?: string;
  to?: string;
  limit?: number;
}

interface ListDecisionEventsResponse {
  events: AiDecisionEvent[];
}

/**
 * Fetch the most recent AI decision events from core via the constructor
 * proxy. The endpoint already supports symbol/timeframe/limit filtering;
 * we surface a typed wrapper so the UI does not need to construct URLs.
 */
export async function listDecisionEvents(
  query: ListDecisionEventsQuery = {},
): Promise<AiDecisionEvent[]> {
  const response = await apiRequest<ListDecisionEventsResponse>(
    "/api/v1/ai-backtests/ai-decision-events",
    {
      method: "GET",
      query: query as Record<string, string | number | undefined>,
    },
  );
  return response.events ?? [];
}

/**
 * Normalise a per-agent entry so the UI can read consistent camelCase
 * field names regardless of whether the upstream uses ``agentKey`` or
 * ``agent_key``.
 */
export function normaliseReasoningEntry(
  entry: AiReasoningEntry,
): Required<Pick<AiReasoningEntry, "agentKey">> & AiReasoningEntry {
  return {
    ...entry,
    agentKey: entry.agentKey ?? entry.agent_key ?? "unknown",
  };
}
