"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  StrategyHealthRead,
  StrategyPortfolioEntry,
} from "@/lib/api/types";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";

type Props = {
  /** Portfolio entry for the selected strategy — carries the snapshot KPIs. */
  entry: StrategyPortfolioEntry | null;
  isLoading: boolean;
  /** On-read composite from the strategy health endpoint (W9 drill-down). */
  health?: StrategyHealthRead | null;
  isHealthLoading?: boolean;
};

function formatComputedAt(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatPct(value: number | null | undefined, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatNum(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

// health_class is 4-valued (healthy / warning / critical / insufficient_data);
// `insufficient_data` and a missing value are NEUTRAL, never error-styled.
function HealthClassBadge({ value }: { value: string | null | undefined }) {
  const cls = value ?? "";
  const tone =
    cls === "healthy"
      ? "bg-emerald-500/20 text-emerald-200"
      : cls === "warning"
        ? "bg-amber-500/20 text-amber-200"
        : cls === "critical"
          ? "bg-red-500/20 text-red-200"
          : "bg-muted text-muted-foreground";
  const label = cls ? cls.replace(/_/g, " ") : "no data";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-base text-foreground">{value}</span>
    </div>
  );
}

export function AutoTradeHealthCard({
  entry,
  isLoading,
  health = null,
  isHealthLoading = false,
}: Props) {
  if (isLoading && entry === null) {
    return (
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (entry === null) {
    return (
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Live KPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No strategy selected.</p>
        </CardContent>
      </Card>
    );
  }

  const label = entry.strategy_name ?? entry.profile_symbol ?? "Strategy";

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Live KPIs — {label}
        </CardTitle>
        <HealthClassBadge value={health?.health_class ?? entry.health_class} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Win rate" value={formatPct(entry.win_rate_pct)} />
          <Metric label="ROI" value={formatPct(entry.roi_pct)} />
          <Metric label="Max DD" value={formatPct(entry.max_dd_pct)} />
          <Metric label="Sharpe (proxy)" value={formatNum(entry.sharpe_proxy)} />
        </div>
        <p className="text-xs text-muted-foreground">
          {typeof entry.sample_size === "number"
            ? `${entry.sample_size} closed trade${entry.sample_size === 1 ? "" : "s"} in window. `
            : ""}
          ROI / Max DD are a W9 proxy — % of the per-trade notional
          (position_size_usdt), <strong>not account equity</strong>; they can
          read high.
        </p>

        {/* On-read composite health (W9 strategy-health endpoint). */}
        <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
          {isHealthLoading && health === null ? (
            <Skeleton className="h-4 w-40" />
          ) : health === null ? (
            <p className="text-xs text-muted-foreground">
              Composite health unavailable — needs a saved strategy with closed
              trades.
            </p>
          ) : (
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Composite health · {health.window_days}d window
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric
                  label="Health score"
                  value={`${formatNum(health.health_score, 0)}/100`}
                />
                <Metric
                  label="Stability"
                  value={formatNum(health.stability_score)}
                />
                <Metric
                  label="Closed trades"
                  value={formatNum(health.sample_size, 0)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                as of {formatComputedAt(health.computed_at)}
                {health.health_class === "insufficient_data"
                  ? " · insufficient data (< 10 closed trades) — not scored yet"
                  : ""}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
