"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyAgentWeightsSuggestion,
  buildArtifactDownloadPath,
  getAiConfigSchema,
  getAiForecastBacktestFiles,
  getBacktestExperiment,
  getCatalogueMetricsSchema,
  listAgentAccuracy,
  listAgentWeights,
  listAiBacktestConfigs,
  listAiForecastCatalogue,
  listBacktestExperiments,
  listExportArtifacts,
  listPublicAgents,
  rebuildAiForecastCatalogue,
  type AgentAccuracyMetric,
  type AgentWeightsProfileRecord,
  type AgentWeightsSuggestion,
  type AiBacktestConfigRecord,
  type AiConfigField,
  type AiConfigSchemaResponse,
  type AiForecastBacktestFile,
  type AiForecastCatalogueEntry,
  type ArtifactInfo,
  type BacktestExperimentRecord,
  type BacktestExperimentSourceJob,
  type MetricsSchemaResponse,
  type PublicAiAgent,
} from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notifications";
import {
  formatMetricValue,
  pickMetricValue,
} from "@/lib/ai-backtests/metric-format";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  TONE_CLASSES,
  findEnumOption,
} from "@/components/admin-ai-backtest-config/data";

const compactNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const percentNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

function compareConfigs(
  left: AiBacktestConfigRecord,
  right: AiBacktestConfigRecord,
): number {
  return String(left.aiConfigId ?? "").localeCompare(
    String(right.aiConfigId ?? ""),
  );
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${percentNumber.format(value * 100)}%`;
}

function suggestionRows(suggestion: AgentWeightsSuggestion | null) {
  if (!suggestion) {
    return [];
  }
  if (Array.isArray(suggestion.diff)) {
    return suggestion.diff;
  }
  return Object.entries(suggestion.diffByAgent ?? {}).map(([agentKey, diff]) => ({
    agentKey,
    current: diff.current,
    suggested: diff.suggested,
    sampleSize: diff.sampleSize,
    hitRate: diff.hitRate,
    meanEdge: diff.meanEdge,
  }));
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card className="border-border/90 bg-card/90">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        <div className="text-xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function tonedBadgeClass(tone: keyof typeof TONE_CLASSES = "neutral") {
  const t = TONE_CLASSES[tone];
  return cn(t.border, t.background, t.text);
}

function renderBoolean(value: unknown) {
  const on = value === true;
  return (
    <Badge
      variant="outline"
      className={tonedBadgeClass(on ? "success" : "neutral")}
    >
      {on ? "on" : "off"}
    </Badge>
  );
}

function renderEnum(field: AiConfigField, value: unknown) {
  const option = findEnumOption(field, value);
  if (!option) {
    return (
      <Badge variant="outline" className={tonedBadgeClass("neutral")}>
        {value === null || value === undefined ? "-" : String(value)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={tonedBadgeClass(option.tone)}>
      {option.label}
    </Badge>
  );
}

function renderEnumList(field: AiConfigField, value: unknown) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => {
        const option = findEnumOption(field, item);
        return (
          <Badge
            key={String(item)}
            variant="outline"
            className={cn(
              "text-[10px]",
              tonedBadgeClass(option?.tone ?? "neutral"),
            )}
          >
            {option?.label ?? String(item)}
          </Badge>
        );
      })}
    </div>
  );
}

function renderStringList(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={String(item)} variant="outline" className="text-[10px]">
          {String(item)}
        </Badge>
      ))}
    </div>
  );
}

function renderNumberList(value: unknown, suffix = "") {
  let items: number[] = [];
  if (Array.isArray(value)) {
    items = value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  } else if (typeof value === "number" && Number.isFinite(value)) {
    items = [value];
  }
  if (items.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <Badge
          key={`${item}-${index}`}
          variant="outline"
          className="text-[10px]"
        >
          {item}
          {suffix}
        </Badge>
      ))}
    </div>
  );
}

function renderModelString(value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed.toLowerCase() === "off") {
    return (
      <Badge variant="outline" className={tonedBadgeClass("neutral")}>
        off
      </Badge>
    );
  }
  return <span className="font-medium text-foreground">{trimmed}</span>;
}

function renderNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="font-medium text-foreground">
      {compactNumber.format(value)}
    </span>
  );
}

function renderFieldValue(field: AiConfigField, value: unknown) {
  switch (field.type) {
    case "boolean":
      return renderBoolean(value);
    case "enum":
      return renderEnum(field, value);
    case "enumList":
      return renderEnumList(field, value);
    case "stringList":
      return renderStringList(value);
    case "numberList":
      // Days suffix is the only current numberList field; if more appear,
      // promote this hint into the schema (e.g., field.unit).
      return renderNumberList(value, field.key === "rqStartDateOffsetDays" ? "d" : "");
    case "number":
      return renderNumber(value);
    case "string":
    default: {
      // Heuristic: model fields encode "off" via the value "off"; treat them
      // identically to renderModelString. Other string fields fall through.
      if (field.key.toLowerCase().endsWith("model")) {
        return renderModelString(value);
      }
      const text = typeof value === "string" ? value : value == null ? "" : String(value);
      return (
        <p className="whitespace-normal leading-5 text-foreground">
          {text || <span className="text-muted-foreground">-</span>}
        </p>
      );
    }
  }
}

function buildStickyOffsetMap(
  fields: AiConfigField[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const field of fields) {
    if (typeof field.stickyLeftPx === "number") {
      map[field.key] = field.stickyLeftPx;
    }
  }
  return map;
}

function buildAgentLookup(agents: PublicAiAgent[]) {
  const map = new Map<string, PublicAiAgent>();
  for (const agent of agents) {
    map.set(agent.code, agent);
  }
  return map;
}

function describeAgent(
  code: string,
  lookup: Map<string, PublicAiAgent>,
): string {
  return lookup.get(code)?.label ?? code;
}

type BacktestRunStatus =
  | "completed"
  | "running"
  | "failed"
  | "pending"
  | "archived";

interface BacktestStatusInfo {
  status: BacktestRunStatus;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  lastRunAt: string | null;
}

function experimentTimestamp(experiment: BacktestExperimentRecord): number {
  const raw = experiment.completedAt ?? experiment.startedAt ?? null;
  if (typeof raw !== "string") {
    return 0;
  }
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Build a quick-lookup set of numeric suffixes that have a forecast CSV on
 * disk (e.g. ai_cfg_01.csv, ai_cfg_07.csv). Suffixes are stored
 * zero-padded *and* unpadded so AI-CFG-01 ↔ ai_cfg_1.csv and ai_cfg_01.csv
 * both match.
 */
function buildForecastFileSuffixSet(
  files: AiForecastBacktestFile[],
): Set<string> {
  const set = new Set<string>();
  for (const file of files) {
    const name = (file.file_name ?? "").toLowerCase();
    const match = name.match(/ai[_-]?cfg[_-]?(\d+)\b/);
    if (!match) continue;
    const digits = match[1];
    set.add(digits);
    set.add(String(Number(digits))); // strip leading zeros
    set.add(digits.padStart(2, "0"));
  }
  return set;
}

function aiConfigNumericSuffix(configId: string): string | null {
  const match = configId.match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

function buildBacktestStatusMap(
  configs: AiBacktestConfigRecord[],
  experiments: BacktestExperimentRecord[],
  catalogueEntries: AiForecastCatalogueEntry[],
  forecastFileSuffixes: Set<string>,
): Map<string, BacktestStatusInfo> {
  const byConfig = new Map<string, BacktestExperimentRecord[]>();
  for (const experiment of experiments) {
    const id = String(experiment.aiConfigId ?? "");
    if (!id) continue;
    const bucket = byConfig.get(id) ?? [];
    bucket.push(experiment);
    byConfig.set(id, bucket);
  }

  const catalogueIds = new Set(
    catalogueEntries
      .map((entry) => (entry.aiConfigId ? String(entry.aiConfigId) : null))
      .filter((value): value is string => value !== null),
  );

  const result = new Map<string, BacktestStatusInfo>();
  for (const config of configs) {
    const id = String(config.aiConfigId ?? "");
    if (!id) continue;
    const own = byConfig.get(id) ?? [];
    const completedCount = own.filter((e) => e.status === "completed").length;
    const failedCount = own.filter((e) => e.status === "failed").length;
    const runningCount = own.filter(
      (e) => e.status === "running" || e.status === "pending",
    ).length;
    const lastRunAt =
      own.length > 0
        ? new Date(
            Math.max(...own.map(experimentTimestamp)),
          ).toISOString()
        : null;

    const suffix = aiConfigNumericSuffix(id);
    const hasForecastFile =
      suffix !== null &&
      (forecastFileSuffixes.has(suffix) ||
        forecastFileSuffixes.has(String(Number(suffix))) ||
        forecastFileSuffixes.has(suffix.padStart(2, "0")));

    let status: BacktestRunStatus;
    if (config.status === "arch") {
      status = "archived";
    } else if (runningCount > 0) {
      status = "running";
    } else if (
      completedCount > 0 ||
      catalogueIds.has(id) ||
      hasForecastFile
    ) {
      status = "completed";
    } else if (failedCount > 0) {
      status = "failed";
    } else {
      status = "pending";
    }

    result.set(id, {
      status,
      completedCount,
      failedCount,
      runningCount,
      lastRunAt,
    });
  }
  return result;
}

const BACKTEST_STATUS_TONE: Record<BacktestRunStatus, keyof typeof TONE_CLASSES> = {
  completed: "success",
  running: "warning",
  failed: "danger",
  pending: "neutral",
  archived: "danger",
};

const BACKTEST_STATUS_LABEL: Record<BacktestRunStatus, string> = {
  completed: "Completed",
  running: "Running",
  failed: "Failed",
  pending: "Pending",
  archived: "Archived",
};

function renderBacktestStatus(info: BacktestStatusInfo | undefined) {
  const status = info?.status ?? "pending";
  const tone = BACKTEST_STATUS_TONE[status];
  const label = BACKTEST_STATUS_LABEL[status];
  const tooltipParts: string[] = [];
  if (info) {
    if (info.completedCount > 0) {
      tooltipParts.push(`${info.completedCount} completed`);
    }
    if (info.runningCount > 0) {
      tooltipParts.push(`${info.runningCount} running`);
    }
    if (info.failedCount > 0) {
      tooltipParts.push(`${info.failedCount} failed`);
    }
    if (info.lastRunAt) {
      tooltipParts.push(`last run ${formatTimestamp(info.lastRunAt)}`);
    }
  }
  const tooltip = tooltipParts.length > 0 ? tooltipParts.join(" · ") : undefined;
  return (
    <Badge
      variant="outline"
      className={cn(
        tonedBadgeClass(tone),
        status === "running" && "animate-pulse",
      )}
      title={tooltip}
    >
      {label}
    </Badge>
  );
}

export function AdminAiBacktestConfigDashboard() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasAdminAccess = useAuthStore((state) => state.hasAdminAccess);
  const isAdminAccessLoading = useAuthStore(
    (state) => state.isAdminAccessLoading,
  );
  const resolveAdminAccess = useAuthStore((state) => state.resolveAdminAccess);

  const [configs, setConfigs] = useState<AiBacktestConfigRecord[]>([]);
  const [schema, setSchema] = useState<AiConfigSchemaResponse | null>(null);
  const [metricsSchema, setMetricsSchema] =
    useState<MetricsSchemaResponse | null>(null);
  const [agents, setAgents] = useState<PublicAiAgent[]>([]);
  const [weightProfiles, setWeightProfiles] = useState<
    AgentWeightsProfileRecord[]
  >([]);
  const [catalogueEntries, setCatalogueEntries] = useState<
    AiForecastCatalogueEntry[]
  >([]);
  const [accuracyMetrics, setAccuracyMetrics] = useState<AgentAccuracyMetric[]>(
    [],
  );
  const [experiments, setExperiments] = useState<BacktestExperimentRecord[]>(
    [],
  );
  const [forecastFiles, setForecastFiles] = useState<AiForecastBacktestFile[]>(
    [],
  );
  const [latestSuggestion, setLatestSuggestion] =
    useState<AgentWeightsSuggestion | null>(null);
  const [selectedCatalogueEntry, setSelectedCatalogueEntry] =
    useState<AiForecastCatalogueEntry | null>(null);
  const [selectedExperiment, setSelectedExperiment] =
    useState<BacktestExperimentRecord | null>(null);
  const [selectedArtifacts, setSelectedArtifacts] = useState<ArtifactInfo[]>(
    [],
  );
  const [isRemoteDataLoading, setIsRemoteDataLoading] = useState(false);
  const [isRebuildingCatalogue, setIsRebuildingCatalogue] = useState(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [isExperimentDetailsLoading, setIsExperimentDetailsLoading] =
    useState(false);

  const sortedConfigs = useMemo(
    () => [...configs].sort(compareConfigs),
    [configs],
  );

  const totalConfigs = sortedConfigs.length;
  const activeConfigs = useMemo(
    () => sortedConfigs.filter((config) => config.status === "active").length,
    [sortedConfigs],
  );
  const configsWithSocialSignals = useMemo(
    () =>
      sortedConfigs.filter(
        (config) =>
          (typeof config.twModel === "string" &&
            config.twModel.toLowerCase() !== "off") ||
          config.newsEnabled === true,
      ).length,
    [sortedConfigs],
  );
  const uniqueWeights = useMemo(
    () =>
      weightProfiles.length > 0
        ? weightProfiles.length
        : new Set(
            sortedConfigs.map((config) => config.agentWeightsId ?? ""),
          ).size,
    [sortedConfigs, weightProfiles],
  );
  const accuracySampleSize = useMemo(
    () =>
      accuracyMetrics.reduce(
        (total, metric) => total + (metric.sampleSize ?? 0),
        0,
      ),
    [accuracyMetrics],
  );

  const stickyLeftOffsets = useMemo(
    () => (schema ? buildStickyOffsetMap(schema.fields) : {}),
    [schema],
  );
  const agentLookup = useMemo(() => buildAgentLookup(agents), [agents]);

  const forecastFileSuffixes = useMemo(
    () => buildForecastFileSuffixSet(forecastFiles),
    [forecastFiles],
  );

  const backtestStatusByConfig = useMemo(
    () =>
      buildBacktestStatusMap(
        sortedConfigs,
        experiments,
        catalogueEntries,
        forecastFileSuffixes,
      ),
    [sortedConfigs, experiments, catalogueEntries, forecastFileSuffixes],
  );

  const canAccessAdmin = user?.is_admin === true || hasAdminAccess === true;
  const shouldResolveAdminAccess =
    hasHydrated &&
    user !== null &&
    user.is_admin !== true &&
    hasAdminAccess === null &&
    !isAdminAccessLoading;
  const isCheckingAccess =
    !hasHydrated ||
    (user !== null && user.is_admin !== true && hasAdminAccess === null);

  const loadRemoteAiBacktestData = useCallback(async () => {
    setIsRemoteDataLoading(true);
    try {
      const [
        configsData,
        weightsData,
        catalogueData,
        accuracyData,
        schemaData,
        metricsSchemaData,
        agentsData,
        experimentsData,
        filesData,
      ] = await Promise.all([
        listAiBacktestConfigs({ limit: 200 }).catch(() => ({ configs: [] })),
        listAgentWeights({ limit: 200 }).catch(() => ({ profiles: [] })),
        listAiForecastCatalogue({ limit: 50 }).catch(() => ({ entries: [] })),
        listAgentAccuracy().catch(() => ({ metrics: [] })),
        getAiConfigSchema().catch(() => null),
        getCatalogueMetricsSchema().catch(() => null),
        listPublicAgents().catch(() => ({ agents: [] as PublicAiAgent[] })),
        listBacktestExperiments({ limit: 200 }).catch(() => ({
          experiments: [] as BacktestExperimentRecord[],
        })),
        getAiForecastBacktestFiles().catch(() => ({
          files: [] as AiForecastBacktestFile[],
        })),
      ]);
      setConfigs(configsData.configs ?? []);
      setWeightProfiles(weightsData.profiles ?? []);
      setCatalogueEntries(catalogueData.entries ?? []);
      setAccuracyMetrics(accuracyData.metrics ?? []);
      setSchema(schemaData);
      setMetricsSchema(metricsSchemaData);
      setAgents(agentsData.agents ?? []);
      setExperiments(experimentsData.experiments ?? []);
      setForecastFiles(filesData.files ?? []);
    } catch (error) {
      notifyError(
        error instanceof Error
          ? error.message
          : "Failed to load AI backtest data.",
        { dedupeKey: "admin-ai-backtest-config-load" },
      );
    } finally {
      setIsRemoteDataLoading(false);
    }
  }, []);

  const handleRebuildCatalogue = useCallback(async () => {
    setIsRebuildingCatalogue(true);
    try {
      const result = await rebuildAiForecastCatalogue({});
      notifySuccess(`AI forecast catalogue rebuilt: ${result.rebuilt} entries.`);
      await loadRemoteAiBacktestData();
    } catch (error) {
      notifyError(
        error instanceof Error
          ? error.message
          : "Failed to rebuild AI forecast catalogue.",
        { dedupeKey: "admin-ai-forecast-catalogue-rebuild" },
      );
    } finally {
      setIsRebuildingCatalogue(false);
    }
  }, [loadRemoteAiBacktestData]);

  const handleDryRunSuggestion = useCallback(async () => {
    const targetConfig =
      sortedConfigs.find((config) => config.status === "active") ??
      sortedConfigs[0];
    const targetId = targetConfig?.aiConfigId;
    if (!targetId) {
      notifyInfo("No AI config available for weight suggestion.");
      return;
    }

    setIsSuggestionLoading(true);
    try {
      const suggestion = await applyAgentWeightsSuggestion(targetId, {
        dry_run: true,
      });
      setLatestSuggestion(suggestion);
      notifySuccess(`Weight suggestion ready for ${targetId}.`);
    } catch (error) {
      notifyError(
        error instanceof Error
          ? error.message
          : "Failed to calculate weight suggestion.",
        { dedupeKey: "admin-agent-weight-suggestion" },
      );
    } finally {
      setIsSuggestionLoading(false);
    }
  }, [sortedConfigs]);

  const handleOpenCatalogueDetails = useCallback(
    async (entry: AiForecastCatalogueEntry) => {
      setSelectedCatalogueEntry(entry);
      setSelectedExperiment(null);
      setSelectedArtifacts([]);

      const sourcePrefix = artifactPrefixFor(entry);
      if (sourcePrefix) {
        listExportArtifacts({ prefix: sourcePrefix })
          .then((response) => setSelectedArtifacts(response.artifacts ?? []))
          .catch(() => undefined);
      }

      const experimentId = entry.latestExperimentId;
      if (!experimentId) {
        return;
      }
      setIsExperimentDetailsLoading(true);
      try {
        setSelectedExperiment(await getBacktestExperiment(experimentId));
      } catch (error) {
        notifyError(
          error instanceof Error
            ? error.message
            : "Failed to load experiment details.",
          { dedupeKey: "admin-ai-backtest-experiment-details" },
        );
      } finally {
        setIsExperimentDetailsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!shouldResolveAdminAccess) {
      return;
    }

    void resolveAdminAccess();
  }, [resolveAdminAccess, shouldResolveAdminAccess]);

  useEffect(() => {
    if (redirectedRef.current || !hasHydrated || user !== null) {
      return;
    }

    redirectedRef.current = true;
    router.replace("/login");
  }, [hasHydrated, router, user]);

  useEffect(() => {
    if (
      redirectedRef.current ||
      !hasHydrated ||
      isAdminAccessLoading ||
      user === null ||
      canAccessAdmin
    ) {
      return;
    }

    if (hasAdminAccess === null && user.is_admin !== true) {
      return;
    }

    redirectedRef.current = true;
    notifyError("Access denied. Admin role is required.", {
      dedupeKey: "admin-ai-backtest-config-access-denied",
    });
    router.replace("/strategy");
  }, [
    canAccessAdmin,
    hasAdminAccess,
    hasHydrated,
    isAdminAccessLoading,
    router,
    user,
  ]);

  useEffect(() => {
    if (!canAccessAdmin) {
      return;
    }
    void loadRemoteAiBacktestData();
  }, [canAccessAdmin, loadRemoteAiBacktestData]);

  if (isCheckingAccess) {
    return (
      <main className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        <Card className="border-border/90 bg-card/90">
          <CardContent className="flex min-h-[220px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking admin access...
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user || !canAccessAdmin) {
    return null;
  }

  // stackVersion is hidden from the matrix on the client side — it does not
  // add operational signal when scanning the table.
  const fields = (schema?.fields ?? []).filter(
    (field) => field.key !== "stackVersion",
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
      <section className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" />
              is_admin only
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">AI Backtest Config</h1>
            {isRemoteDataLoading ? (
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-label="Loading core data"
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRebuildCatalogue}
              disabled={isRebuildingCatalogue}
            >
              {isRebuildingCatalogue ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Rebuild catalogue
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDryRunSuggestion}
              disabled={isSuggestionLoading}
            >
              {isSuggestionLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Dry-run weights
            </Button>
            <Button size="sm" variant="outline" disabled>
              <Plus className="size-4" />
              Add config
            </Button>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() =>
              notifyInfo(
                "Config creation will be added in a future iteration.",
                {
                  dedupeKey: "admin-ai-backtest-config-coming-soon",
                },
              )
            }
          >
            Create flow is still handled outside this screen.
          </button>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <SummaryCard
          label="Total configs"
          value={totalConfigs}
          description={
            totalConfigs > 0 ? "Loaded from core" : "Awaiting core data"
          }
        />
        <SummaryCard
          label="Active"
          value={activeConfigs}
          description="Configs ready for runtime usage"
        />
        <SummaryCard
          label="Social enabled"
          value={configsWithSocialSignals}
          description="Twitter or news signals enabled"
        />
        <SummaryCard
          label="Weight profiles"
          value={uniqueWeights}
          description="Unique agent weight mappings"
        />
        <SummaryCard
          label="Forecasts"
          value={catalogueEntries.length}
          description="Catalogue entries available"
        />
        <SummaryCard
          label="Accuracy samples"
          value={accuracySampleSize}
          description="7d/30d joined outcomes"
        />
      </section>

      <Card className="border-border/90 bg-card/90">
        <CardContent className="space-y-3 pt-4">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Schema not loaded yet — admin metadata endpoint did not respond.
            </p>
          ) : sortedConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AI backtest configs available yet.
            </p>
          ) : (
            <ConfigMatrix
              fields={fields}
              configs={sortedConfigs}
              stickyLeftOffsets={stickyLeftOffsets}
              agentLookup={agentLookup}
              backtestStatusByConfig={backtestStatusByConfig}
            />
          )}
        </CardContent>
      </Card>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/90 bg-card/90">
          <CardHeader className="gap-2 border-b border-border/70">
            <CardTitle className="text-sm font-medium">
              AI Forecast Catalogue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {catalogueEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No catalogue entries returned from core yet.
              </p>
            ) : metricsSchema ? (
              <CatalogueTable
                entries={catalogueEntries}
                metricsSchema={metricsSchema}
                onOpen={(entry) => void handleOpenCatalogueDetails(entry)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Metrics schema not loaded — cannot render catalogue.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/90 bg-card/90">
          <CardHeader className="gap-2 border-b border-border/70">
            <CardTitle className="text-sm font-medium">
              Agent Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {accuracyMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agent accuracy metrics returned from core yet.
              </p>
            ) : (
              <div className="overflow-auto rounded-md border border-border/70">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-muted/80 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Agent</th>
                      <th className="px-3 py-2 font-medium">Window</th>
                      <th className="px-3 py-2 font-medium">Hit</th>
                      <th className="px-3 py-2 font-medium">Edge</th>
                      <th className="px-3 py-2 font-medium">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracyMetrics.slice(0, 12).map((metric) => (
                      <tr
                        key={`${metric.aiConfigId ?? "default"}-${metric.agentKey}-${metric.windowDays}`}
                        className="border-t border-border/60"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {describeAgent(metric.agentKey, agentLookup)}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({metric.agentKey})
                          </span>
                        </td>
                        <td className="px-3 py-2">{metric.windowDays}d</td>
                        <td className="px-3 py-2">
                          {formatPercent(metric.hitRate)}
                        </td>
                        <td className="px-3 py-2">
                          {compactNumber.format(metric.meanEdge ?? 0)}
                        </td>
                        <td className="px-3 py-2">{metric.sampleSize ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {latestSuggestion ? (
              <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {latestSuggestion.suggestedProfileId ??
                      latestSuggestion.agentWeightsId ??
                      "Weight suggestion"}
                  </p>
                  <Badge variant="outline">
                    {latestSuggestion.applied ? "applied" : "dry-run"}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {suggestionRows(latestSuggestion).map((diff) => (
                    <div
                      key={diff.agentKey}
                      className="rounded border border-border/60 px-2 py-1 text-xs"
                    >
                      <span className="font-medium">
                        {describeAgent(diff.agentKey, agentLookup)}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {diff.current ?? "-"} {"->"} {diff.suggested}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
      <CatalogueDetailsDrawer
        entry={selectedCatalogueEntry}
        experiment={selectedExperiment}
        artifacts={selectedArtifacts}
        agentLookup={agentLookup}
        isLoading={isExperimentDetailsLoading}
        onClose={() => {
          setSelectedCatalogueEntry(null);
          setSelectedExperiment(null);
          setSelectedArtifacts([]);
        }}
      />
    </main>
  );
}

function ConfigMatrix({
  fields,
  configs,
  stickyLeftOffsets,
  agentLookup,
  backtestStatusByConfig,
}: {
  fields: AiConfigField[];
  configs: AiBacktestConfigRecord[];
  stickyLeftOffsets: Record<string, number>;
  agentLookup: Map<string, PublicAiAgent>;
  backtestStatusByConfig: Map<string, BacktestStatusInfo>;
}) {
  return (
    <div className="overflow-auto rounded-md border border-border/70">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            {fields.map((field) => {
              const stickyLeft = stickyLeftOffsets[field.key];
              return (
                <th
                  key={field.key}
                  className={cn(
                    "border-b border-r border-border/70 bg-muted/95 px-3 py-2 text-left align-bottom",
                    stickyLeft !== undefined && "sticky z-30",
                  )}
                  style={{
                    minWidth: field.minWidthPx,
                    left: stickyLeft,
                  }}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      {field.label}
                    </p>
                    {field.description ? (
                      <p className="text-[11px] font-normal text-muted-foreground">
                        {field.description}
                      </p>
                    ) : null}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {configs.map((config, rowIndex) => {
            const rowTone =
              rowIndex % 2 === 0 ? "bg-background/70" : "bg-muted/20";
            const configId = String(config.aiConfigId ?? "");
            return (
              <tr key={configId || rowIndex}>
                {fields.map((field) => {
                  const stickyLeft = stickyLeftOffsets[field.key];
                  const value = (config as Record<string, unknown>)[field.key];
                  return (
                    <td
                      key={field.key}
                      className={cn(
                        "border-b border-r border-border/60 px-3 py-3 align-top text-xs",
                        rowTone,
                        stickyLeft !== undefined &&
                          "sticky z-10 backdrop-blur-sm",
                      )}
                      style={{
                        minWidth: field.minWidthPx,
                        left: stickyLeft,
                      }}
                    >
                      {field.key === "status"
                        ? renderBacktestStatus(
                            backtestStatusByConfig.get(configId),
                          )
                        : field.key === "enabledAgents"
                        ? renderEnabledAgents(value, agentLookup)
                        : renderFieldValue(field, value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderEnabledAgents(
  value: unknown,
  agentLookup: Map<string, PublicAiAgent>,
) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => {
        const code = String(item);
        const agent = agentLookup.get(code);
        return (
          <Badge
            key={code}
            variant="outline"
            className="text-[10px]"
            title={agent?.description ?? undefined}
          >
            {agent?.label ?? code}
          </Badge>
        );
      })}
    </div>
  );
}

function CatalogueTable({
  entries,
  metricsSchema,
  onOpen,
}: {
  entries: AiForecastCatalogueEntry[];
  metricsSchema: MetricsSchemaResponse;
  onOpen: (entry: AiForecastCatalogueEntry) => void;
}) {
  const headlineMetrics = useMemo(() => {
    // Show the first 8 metrics that appear in the schema so the table stays
    // narrow but still expandable when new metrics are added on the backend.
    return metricsSchema.metrics.slice(0, 8);
  }, [metricsSchema]);

  return (
    <div className="overflow-auto rounded-md border border-border/70">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-muted/80 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Forecast</th>
            <th className="px-3 py-2 font-medium">Market</th>
            <th className="px-3 py-2 font-medium">Config</th>
            {headlineMetrics.map((metric) => (
              <th
                key={metric.key}
                className="px-3 py-2 font-medium"
                title={metric.description}
              >
                {metric.label}
              </th>
            ))}
            <th className="px-3 py-2 font-medium">Generated</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 12).map((entry) => (
            <tr
              key={entry.forecastId}
              className="border-t border-border/60"
            >
              <td className="max-w-[220px] px-3 py-2 font-medium text-foreground">
                <div className="truncate">{entry.forecastId}</div>
                {entry.sourceFile ? (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {entry.sourceFile}
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2">
                {entry.symbol} / {entry.timeframe}
              </td>
              <td className="px-3 py-2">{entry.aiConfigId ?? "-"}</td>
              {headlineMetrics.map((metric) => {
                const value = pickMetricValue(entry.metrics, metric);
                return (
                  <td key={metric.key} className="px-3 py-2">
                    {value === null ? "-" : formatMetricValue(value, metric)}
                  </td>
                );
              })}
              <td className="px-3 py-2">{formatTimestamp(entry.generatedAt)}</td>
              <td className="px-3 py-2 text-right">
                <Button size="sm" variant="outline" onClick={() => onOpen(entry)}>
                  Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function artifactPrefixFor(entry: AiForecastCatalogueEntry): string | null {
  if (typeof entry.sourceFile === "string" && entry.sourceFile.length > 0) {
    return entry.sourceFile.replace(/\.[^./\\]+$/u, "");
  }
  if (typeof entry.aiConfigId === "string" && entry.aiConfigId.length > 0) {
    // Fallback: AI-CFG-01 → ai_cfg_01
    return entry.aiConfigId.replace(/^AI-CFG-/i, "ai_cfg_").toLowerCase();
  }
  return null;
}

function CatalogueDetailsDrawer({
  entry,
  experiment,
  artifacts,
  agentLookup,
  isLoading,
  onClose,
}: {
  entry: AiForecastCatalogueEntry | null;
  experiment: BacktestExperimentRecord | null;
  artifacts: ArtifactInfo[];
  agentLookup: Map<string, PublicAiAgent>;
  isLoading: boolean;
  onClose: () => void;
}) {
  const isOpen = entry !== null;
  const sourceJobs = experiment?.sourceJobs ?? [];

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <button
        type="button"
        aria-label="Close details"
        className={cn(
          "absolute inset-0 bg-background/55 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl transition-transform",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 p-4">
          <div className="min-w-0">
            <p className="text-xs uppercase text-muted-foreground">
              Forecast details
            </p>
            <h2 className="truncate text-base font-semibold">
              {entry?.forecastId ?? "Forecast"}
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {entry ? (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <DetailValue
                label="Market"
                value={`${entry.symbol} / ${entry.timeframe}`}
              />
              <DetailValue
                label="AI config"
                value={entry.aiConfigId ?? "-"}
              />
              <DetailValue
                label="Experiment"
                value={entry.latestExperimentId ?? "-"}
              />
              <DetailValue
                label="Generated"
                value={formatTimestamp(entry.generatedAt)}
              />
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading experiment details...
            </div>
          ) : null}

          {artifacts.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Artifacts</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.filename} artifact={artifact} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Source runs</h3>
            {sourceJobs.length === 0 ? (
              <p className="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
                No source runs linked to this experiment yet.
              </p>
            ) : (
              <div className="space-y-3">
                {sourceJobs.slice(0, 8).map((job) => (
                  <SourceJobCard
                    key={job.jobId}
                    job={job}
                    agentLookup={agentLookup}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: ArtifactInfo }) {
  const isImage = artifact.kind === "png" || artifact.kind === "image";
  const href = buildArtifactDownloadPath(artifact.filename);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md border border-border/70 bg-muted/20 p-2 hover:border-border"
    >
      {isImage ? (
        // Native img is fine here — admin-only screen, no SEO concerns.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt={artifact.filename}
          loading="lazy"
          className="mb-2 h-24 w-full rounded object-contain"
        />
      ) : null}
      <p className="truncate text-xs font-medium text-foreground">
        {artifact.filename}
      </p>
      <p className="text-[10px] uppercase text-muted-foreground">
        {artifact.kind} · {formatBytes(artifact.sizeBytes)}
      </p>
    </a>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function SourceJobCard({
  job,
  agentLookup,
}: {
  job: BacktestExperimentSourceJob;
  agentLookup: Map<string, PublicAiAgent>;
}) {
  const reasoningPath = Array.isArray(job.reasoningPath) ? job.reasoningPath : [];
  const aiTrend = job.aiTrend as Record<string, unknown> | null | undefined;

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-foreground">{job.jobId}</p>
          <p className="text-xs text-muted-foreground">
            {job.endDate ?? "-"} · {job.decisionEventId ?? "no decision event"}
          </p>
        </div>
        <Badge variant="outline">
          {typeof aiTrend?.direction === "string" ? aiTrend.direction : "trend n/a"}
        </Badge>
      </div>
      {reasoningPath.length > 0 ? (
        <div className="space-y-2">
          {reasoningPath.slice(0, 6).map((agent, index) => {
            const code = String(agent.agentKey ?? "agent");
            const label = agentLookup.get(code)?.label ?? code;
            return (
              <div
                key={`${code}-${index}`}
                className="rounded border border-border/60 px-2 py-1 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">
                    {String(agent.signal ?? "unknown")} · w{" "}
                    {String(agent.weight ?? "-")}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 text-muted-foreground">
                  {String(agent.summary ?? "No summary captured")}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No reasoning path captured.</p>
      )}
    </div>
  );
}
