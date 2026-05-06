import { apiRequest } from "@/lib/api/client";
import type { JsonRecord } from "@/lib/api/types";

export type AiConfigFieldType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "stringList"
  | "enumList"
  | "numberList";

export type AiConfigFieldTone = "neutral" | "success" | "warning" | "danger";

export interface AiConfigEnumOption {
  value: string;
  label: string;
  tone?: AiConfigFieldTone;
}

export interface AiConfigField {
  key: string;
  label: string;
  description: string;
  type: AiConfigFieldType;
  group: string;
  required?: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  stickyLeftPx?: number;
  minWidthPx?: number;
  options?: AiConfigEnumOption[];
}

export interface AiConfigGroup {
  key: string;
  label: string;
}

export interface AiConfigSchemaResponse {
  fields: AiConfigField[];
  groups: AiConfigGroup[];
}

export type AgentCategory =
  | "sentiment"
  | "research"
  | "news"
  | "technical"
  | "analyst"
  | "writer";

export interface PublicAiAgent {
  code: string;
  label: string;
  description: string;
  category: AgentCategory;
  enabledByDefault: boolean;
}

export type MetricFormat =
  | "percent"
  | "ratio"
  | "money"
  | "integer"
  | "decimal";

export type MetricDirection = "higher_better" | "lower_better" | "neutral";

export interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  format: MetricFormat;
  group: string;
  direction: MetricDirection;
  aliases?: string[];
  precision?: number;
}

export interface MetricsSchemaResponse {
  groups: AiConfigGroup[];
  metrics: MetricDefinition[];
}

export interface ArtifactInfo {
  filename: string;
  sizeBytes: number;
  modifiedAt: number;
  kind: "csv" | "png" | "image" | "json" | "html" | "text" | "other";
  relativePath: string;
}

export type AiBacktestConfigRecord = JsonRecord & {
  aiConfigId?: string;
  status?: "active" | "arch";
  stackVersion?: string | null;
  twModel?: string | null;
  twLimit?: number | null;
  rqModel?: string | null;
  rqOnchainTemplates?: string[];
  rqPriceTemplates?: string[];
  rqDerivativesTemplates?: string[];
  rqStartDateOffsetDays?: number[] | number | null;
  rfModel?: string | null;
  rfCollections?: string[];
  rfSearchMode?: string | null;
  newsModel?: string | null;
  newsEnabled?: boolean | null;
  newsSource?: string | null;
  tmEnabled?: boolean | null;
  tmModel?: string | null;
  anModel?: string | null;
  anWTech?: number | null;
  anWDeriv?: number | null;
  anWSent?: number | null;
  anBiasThreshold?: number | null;
  wrModel?: string | null;
  agentWeightsId?: string | null;
  enabledAgents?: string[];
  notes?: string | null;
};

export type AgentWeightsProfileRecord = JsonRecord & {
  profileId?: string;
  name?: string | null;
  weights?: Record<string, number>;
  isDefault?: boolean;
};

export type AiForecastCatalogueEntry = JsonRecord & {
  forecastId: string;
  symbol: string;
  timeframe: string;
  aiConfigId?: string | null;
  period?: JsonRecord | null;
  metrics?: JsonRecord | null;
  sourceFile?: string | null;
  latestExperimentId?: string | null;
  stackVersion?: string | null;
  generatedAt?: string;
};

export type AgentAccuracyMetric = JsonRecord & {
  aiConfigId?: string | null;
  agentKey: string;
  windowDays: 7 | 30;
  horizonHours: number;
  hitRate: number;
  meanEdge: number;
  sampleSize: number;
  updatedAt?: string;
};

export type AgentWeightsSuggestion = JsonRecord & {
  aiConfigId: string;
  suggestedProfileId?: string | null;
  agentWeightsId?: string;
  baseAgentWeightsId?: string | null;
  weights?: Record<string, number>;
  suggested?: Record<string, number>;
  diffByAgent?: Record<
    string,
    {
      current: number | null;
      suggested: number;
      sampleSize?: number;
      hitRate?: number;
      meanEdge?: number;
    }
  >;
  diff: Array<{
    agentKey: string;
    current: number | null;
    suggested: number;
    sampleSize?: number;
    hitRate?: number;
    meanEdge?: number;
  }>;
  applied?: boolean;
  dry_run?: boolean;
};

export type BacktestExperimentSourceJob = JsonRecord & {
  jobId: string;
  symbol?: string;
  endDate?: string | null;
  decisionEventId?: string | null;
  aiTrend?: JsonRecord | null;
  reasoningPath?: JsonRecord[];
};

export type BacktestExperimentRecord = JsonRecord & {
  experimentId: string;
  symbol: string;
  timeframe: string;
  status: "pending" | "running" | "completed" | "failed";
  baselineMetrics?: JsonRecord | null;
  aiMetrics?: JsonRecord | null;
  deltaMetrics?: JsonRecord | null;
  walkForwardStability?: JsonRecord | null;
  artifacts?: JsonRecord[];
  sourceJobs?: BacktestExperimentSourceJob[];
  startedAt?: string;
  completedAt?: string | null;
  error?: string | null;
};

export function listAiBacktestConfigs(query?: {
  status?: string;
  limit?: number;
}) {
  return apiRequest<{ configs: AiBacktestConfigRecord[] }>(
    "/api/v1/ai-backtests/ai-configs",
    { query },
  );
}

export function listAgentWeights(query?: { limit?: number }) {
  return apiRequest<{ profiles: AgentWeightsProfileRecord[] }>(
    "/api/v1/ai-backtests/agent-weights",
    { query },
  );
}

export function listAiForecastCatalogue(query?: {
  symbol?: string;
  timeframe?: string;
  ai_config_id?: string;
  limit?: number;
}) {
  return apiRequest<{ entries: AiForecastCatalogueEntry[] }>(
    "/api/v1/ai-backtests/ai-forecast-catalogue",
    { query },
  );
}

export function getAiForecastCatalogueEntry(forecastId: string) {
  return apiRequest<AiForecastCatalogueEntry>(
    `/api/v1/ai-backtests/ai-forecast-catalogue/${encodeURIComponent(
      forecastId,
    )}`,
  );
}

export function rebuildAiForecastCatalogue(payload: JsonRecord = {}) {
  return apiRequest<{
    requested?: number;
    rebuilt: number;
    completed?: number;
    failed?: number;
    fileOnly?: { files: number } | null;
  }>("/api/v1/ai-backtests/ai-forecast-catalogue/rebuild", {
    method: "POST",
    body: payload,
  });
}

export function listBacktestExperiments(query?: {
  symbol?: string;
  timeframe?: string;
  ai_config_id?: string;
  status?: string;
  limit?: number;
}) {
  return apiRequest<{ experiments: BacktestExperimentRecord[] }>(
    "/api/v1/ai-backtests/backtest-experiments",
    { query },
  );
}

export function runBacktestExperiment(payload: JsonRecord) {
  return apiRequest<BacktestExperimentRecord>(
    "/api/v1/ai-backtests/backtest-experiments/run",
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getBacktestExperiment(experimentId: string) {
  return apiRequest<BacktestExperimentRecord>(
    `/api/v1/ai-backtests/backtest-experiments/${encodeURIComponent(
      experimentId,
    )}`,
  );
}

export function listAgentAccuracy(query?: {
  ai_config_id?: string;
  agent_key?: string;
  window?: "7d" | "30d" | "7" | "30";
}) {
  return apiRequest<{ metrics: AgentAccuracyMetric[] }>(
    "/api/v1/ai-backtests/agent-accuracy",
    { query },
  );
}

export function getAgentWeightsSuggestion(aiConfigId: string) {
  return apiRequest<AgentWeightsSuggestion>(
    `/api/v1/ai-backtests/agent-weights/suggestions/${encodeURIComponent(
      aiConfigId,
    )}`,
  );
}

export function applyAgentWeightsSuggestion(
  aiConfigId: string,
  payload: { dry_run?: boolean } = {},
) {
  return apiRequest<AgentWeightsSuggestion>(
    `/api/v1/ai-backtests/agent-weights/suggestions/${encodeURIComponent(
      aiConfigId,
    )}/apply`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getAiConfigSchema() {
  return apiRequest<AiConfigSchemaResponse>(
    "/api/v1/ai-backtests/ai-configs/schema",
  );
}

export function listPublicAgents() {
  return apiRequest<{ agents: PublicAiAgent[] }>(
    "/api/v1/ai-backtests/agents",
  );
}

export function getCatalogueMetricsSchema() {
  return apiRequest<MetricsSchemaResponse>(
    "/api/v1/ai-backtests/ai-forecast-catalogue/metrics-schema",
  );
}

export function listExportArtifacts(query?: { prefix?: string }) {
  return apiRequest<{ artifacts: ArtifactInfo[] }>(
    "/api/v1/ai-backtests/artifacts",
    { query },
  );
}

export function buildArtifactDownloadPath(filename: string) {
  return `/api/v1/ai-backtests/artifacts/${encodeURIComponent(filename)}`;
}
