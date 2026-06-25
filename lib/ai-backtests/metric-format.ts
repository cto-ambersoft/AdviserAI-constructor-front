import type { MetricDefinition } from "@/lib/api/services/ai-backtests";

// Schema-driven metric formatting for the AI forecast catalogue. Shared by the
// admin catalogue and the trader-facing catalogue so the two never diverge.

export function formatMetricValue(
  value: number,
  metric: MetricDefinition,
): string {
  const precision = metric.precision ?? 2;
  switch (metric.format) {
    case "percent": {
      // win_rate / annualizedReturnPct etc. arrive already as percent values.
      return `${value.toFixed(precision)}%`;
    }
    case "money":
      return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(precision)}`;
    case "integer":
      return Math.round(value).toString();
    case "ratio":
    case "decimal":
    default:
      return value.toFixed(precision);
  }
}

/** Resolve a metric's value from an entry's metrics bag, honoring aliases. */
export function pickMetricValue(
  metrics: Record<string, unknown> | null | undefined,
  metric: MetricDefinition,
): number | null {
  if (!metrics) {
    return null;
  }
  const candidates: Array<unknown> = [
    metrics[metric.key],
    ...(metric.aliases ?? []).map((alias) => metrics[alias]),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}
