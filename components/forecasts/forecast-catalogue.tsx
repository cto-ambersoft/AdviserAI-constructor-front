"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import {
  ApiError,
  getCatalogueMetricsSchema,
  listAiForecastCatalogue,
  type AiForecastCatalogueEntry,
  type MetricsSchemaResponse,
} from "@/lib/api";
import {
  formatMetricValue,
  pickMetricValue,
} from "@/lib/ai-backtests/metric-format";
import { cn, formatTimestamp } from "@/lib/utils";

const CARD_CLASS = "border-border/80 bg-card/80 shadow-sm backdrop-blur";
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const FETCH_DEBOUNCE_MS = 300;

export function ForecastCatalogue() {
  const router = useRouter();
  const [entries, setEntries] = useState<AiForecastCatalogueEntry[]>([]);
  const [metricsSchema, setMetricsSchema] =
    useState<MetricsSchemaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("");

  // Metrics schema (column definitions incl. Delta-vs-Baseline) — once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const schema = await getCatalogueMetricsSchema();
        if (!cancelled) {
          setMetricsSchema(schema);
        }
      } catch {
        // Non-fatal: the table still renders identity/timestamp columns.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await listAiForecastCatalogue({
        symbol: symbol.trim() || undefined,
        timeframe: timeframe || undefined,
        limit: 100,
      });
      setEntries(response.entries ?? []);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not load the forecast catalogue.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe]);

  // Debounced re-fetch as filters change (symbol typing / timeframe select).
  useEffect(() => {
    const timer = setTimeout(() => void loadEntries(), FETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loadEntries]);

  // Render every schema metric (horizontally scrollable) so Win / Sharpe /
  // Max-DD and Delta-vs-Baseline columns are always present. — TZ §6.
  const metrics = useMemo(
    () => metricsSchema?.metrics ?? [],
    [metricsSchema],
  );

  const handleUseInStrategy = useCallback(
    (entry: AiForecastCatalogueEntry) => {
      if (!entry.sourceFile) {
        return;
      }
      router.push(
        `/strategy?forecast=${encodeURIComponent(entry.sourceFile)}`,
      );
    },
    [router],
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">AI Forecast Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Backtested AI forecasts with metrics vs. baseline. Attach one to a
            strategy in the builder.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label text="Symbol" />
            <input
              className={cn(INPUT_CLASS, "w-32")}
              placeholder="BTCUSDT"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label text="Timeframe" />
            <select
              className={cn(INPUT_CLASS, "w-28")}
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
            >
              <option value="">All</option>
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadEntries()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className={CARD_CLASS}>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className={CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Forecasts ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && entries.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No forecasts match these filters.
            </p>
          ) : (
            <div className="overflow-auto rounded-md border border-border/70">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-muted/80 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Forecast</th>
                    <th className="px-3 py-2 font-medium">Market</th>
                    <th className="px-3 py-2 font-medium">Config</th>
                    {metrics.map((metric) => (
                      <th
                        key={metric.key}
                        className="whitespace-nowrap px-3 py-2 font-medium"
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
                  {entries.map((entry) => (
                    <tr
                      key={entry.forecastId}
                      className="border-t border-border/60"
                    >
                      <td className="max-w-[220px] px-3 py-2 font-medium text-foreground">
                        <div
                          className="truncate"
                          title={entry.sourceFile ?? undefined}
                        >
                          {entry.forecastId}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {entry.symbol} / {entry.timeframe}
                      </td>
                      <td className="px-3 py-2">{entry.aiConfigId ?? "—"}</td>
                      {metrics.map((metric) => {
                        const value = pickMetricValue(entry.metrics, metric);
                        return (
                          <td
                            key={metric.key}
                            className="whitespace-nowrap px-3 py-2"
                          >
                            {value === null
                              ? "—"
                              : formatMetricValue(value, metric)}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTimestamp(entry.generatedAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUseInStrategy(entry)}
                          disabled={!entry.sourceFile}
                          title={
                            entry.sourceFile
                              ? "Preselect this forecast in the strategy builder"
                              : "No source file to attach"
                          }
                        >
                          Use in strategy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
