import type { SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";
import type { BacktestResponse, JsonRecord, MarketOhlcvResponse } from "@/lib/api/types";
import type { CandlePoint, OverlayLine } from "@/lib/trading/chart-types";

export type EquityCurveChartPoint = {
  time: UTCTimestamp;
  value: number;
  pnlUsdt: number;
};

export type BacktestMetrics = {
  initialBalance: number;
  finalBalance: number;
  totalPnl: number;
  avgRiskPerTrade: number;
  equityCurve: EquityCurveChartPoint[];
};

function toUnixTimestamp(value: unknown): UTCTimestamp | null {
  if (typeof value === "number") {
    return Math.floor(value > 10_000_000_000 ? value / 1000 : value) as UTCTimestamp;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      return null;
    }
    return Math.floor(ms / 1000) as UTCTimestamp;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function pickRecordValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

export function mapMarketRowsToCandles(response: MarketOhlcvResponse): CandlePoint[] {
  const candles: CandlePoint[] = [];
  for (const row of response.rows) {
    const time = toUnixTimestamp(
      pickRecordValue(row as JsonRecord, ["time", "timestamp", "date", "datetime"]),
    );
    const open = toNumber(pickRecordValue(row as JsonRecord, ["open", "o"]));
    const high = toNumber(pickRecordValue(row as JsonRecord, ["high", "h"]));
    const low = toNumber(pickRecordValue(row as JsonRecord, ["low", "l"]));
    const close = toNumber(pickRecordValue(row as JsonRecord, ["close", "c"]));

    if (time === null || open === null || high === null || low === null || close === null) {
      continue;
    }

    candles.push({ time, open, high, low, close });
  }

  return candles.sort((a, b) => Number(a.time) - Number(b.time));
}

export function mapBacktestToOverlays(result: BacktestResponse | null): OverlayLine[] {
  if (!result?.chart_points || typeof result.chart_points !== "object") {
    return [];
  }

  const chartPoints = result.chart_points as JsonRecord;
  const overlays: OverlayLine[] = [];
  const palette = [
    "hsl(199 89% 62%)",
    "hsl(42 94% 60%)",
    "hsl(276 82% 70%)",
    "hsl(168 76% 44%)",
    "hsl(345 83% 63%)",
  ];
  let idx = 0;

  for (const [seriesId, rawPoints] of Object.entries(chartPoints)) {
    if (seriesId === "ohlcv" || seriesId === "equity_curve") {
      continue;
    }
    if (!Array.isArray(rawPoints)) {
      continue;
    }

    const lineData = rawPoints
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as JsonRecord;
        const time = toUnixTimestamp(pickRecordValue(record, ["time", "timestamp", "date"]));
        const value = toNumber(pickRecordValue(record, ["value", "v", "price", "y", "equity"]));
        if (time === null || value === null) {
          return null;
        }
        return { time, value };
      })
      .filter((item): item is { time: UTCTimestamp; value: number } => item !== null);

    if (lineData.length === 0) {
      continue;
    }

    const normalizedId = seriesId.toLowerCase();
    const style = normalizedId.includes("upper") || normalizedId.includes("lower") ? "dashed" : "solid";
    const width = normalizedId.includes("signal") || normalizedId.includes("entry") ? 1 : 2;

    overlays.push({
      id: seriesId,
      color: palette[idx % palette.length],
      style,
      width,
      data: lineData,
    });
    idx += 1;
  }

  return overlays;
}

export function mapBacktestToMarkers(result: BacktestResponse | null): SeriesMarker<Time>[] {
  if (!result?.trades) {
    return [];
  }

  const markers: SeriesMarker<Time>[] = [];
  for (const trade of result.trades) {
    if (!trade || typeof trade !== "object") {
      continue;
    }
    const row = trade as JsonRecord;
    const entryTime = toUnixTimestamp(
      pickRecordValue(row, ["entryTime", "entry_time", "entry_ts", "open_time", "time"]),
    );
    const exitTime = toUnixTimestamp(
      pickRecordValue(row, ["exitTime", "exit_time", "close_time", "exit_ts"]),
    );
    const side = String(pickRecordValue(row, ["side", "direction"]) ?? "LONG").toUpperCase();
    const pnl = toNumber(pickRecordValue(row, ["pnl", "pnl_usdt", "profit"]));

    if (entryTime !== null) {
      markers.push({
        time: entryTime,
        position: side.includes("SHORT") ? "aboveBar" : "belowBar",
        color: side.includes("SHORT") ? "hsl(27 96% 61%)" : "hsl(190 95% 55%)",
        shape: side.includes("SHORT") ? "arrowDown" : "arrowUp",
        text: side.includes("SHORT") ? "SHORT IN" : "LONG IN",
        size: 1.35,
      });
    }

    if (exitTime !== null) {
      const isPositive = pnl !== null && pnl >= 0;
      markers.push({
        time: exitTime,
        position: "inBar",
        color: isPositive ? "hsl(84 81% 52%)" : "hsl(335 86% 62%)",
        shape: isPositive ? "square" : "circle",
        text: pnl === null ? "OUT" : `OUT ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`,
        size: 1.15,
      });
    }
  }
  return markers.sort((a, b) => Number(a.time) - Number(b.time));
}

function safeStepTimestamp(step: number, index: number): UTCTimestamp {
  const normalizedStep = Number.isFinite(step) ? Math.max(0, Math.floor(step)) : index;
  return (1_700_000_000 + normalizedStep) as UTCTimestamp;
}

function mapEquityCurveFromChartPoints(result: BacktestResponse): EquityCurveChartPoint[] {
  const points = result.chart_points?.equity_curve;
  if (!Array.isArray(points)) {
    return [];
  }

  const normalized: EquityCurveChartPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point || typeof point !== "object") {
      continue;
    }
    const row = point as JsonRecord;
    const equity = toNumber(row.equity);
    if (equity === null) {
      continue;
    }
    const pnlUsdt = toNumber(row.pnl_usdt) ?? 0;
    const step = toNumber(row.step) ?? index;
    const time = toUnixTimestamp(row.time) ?? safeStepTimestamp(step, index);
    normalized.push({
      time,
      value: equity,
      pnlUsdt,
    });
  }

  return normalized.sort((a, b) => Number(a.time) - Number(b.time));
}

function mapEquityCurveFromTrades(
  trades: JsonRecord[],
  initialBalance: number,
): EquityCurveChartPoint[] {
  const points: EquityCurveChartPoint[] = [];
  let cumulativePnl = 0;

  for (let index = 0; index < trades.length; index += 1) {
    const trade = trades[index];
    const pnl = toNumber(pickRecordValue(trade, ["pnl_usdt", "pnl", "profit"])) ?? 0;
    cumulativePnl += pnl;
    const time =
      toUnixTimestamp(
        pickRecordValue(trade, ["exitTime", "exit_time", "close_time", "entryTime", "entry_time", "time"]),
      ) ??
      safeStepTimestamp(index, index);
    points.push({
      time,
      value: initialBalance + cumulativePnl,
      pnlUsdt: cumulativePnl,
    });
  }

  return points.sort((a, b) => Number(a.time) - Number(b.time));
}

export function normalizeBacktestMetrics(result: BacktestResponse | null): BacktestMetrics | null {
  if (!result) {
    return null;
  }

  const summary = (result.summary ?? {}) as JsonRecord;
  const clientValues = toRecord(summary.client_values) ?? toRecord(summary.clientValues) ?? {};
  const initialFromSummary = toNumber(clientValues.initialBalance) ?? toNumber(summary.initial_balance);
  const finalFromSummary = toNumber(clientValues.finalBalance) ?? toNumber(summary.final_balance);
  const totalPnlFromSummary =
    toNumber(clientValues.totalPnl) ??
    toNumber(clientValues.totalPnlUsdt) ??
    toNumber(summary.total_pnl) ??
    toNumber(summary.total_pnl_usdt);

  const initialBalance =
    initialFromSummary ?? (finalFromSummary !== null && totalPnlFromSummary !== null
      ? finalFromSummary - totalPnlFromSummary
      : 0);
  const finalBalance =
    finalFromSummary ?? (totalPnlFromSummary !== null ? initialBalance + totalPnlFromSummary : initialBalance);
  const totalPnl = totalPnlFromSummary ?? finalBalance - initialBalance;

  const avgRiskFromSummary = toNumber(clientValues.avgRiskPerTrade) ?? toNumber(summary.avg_risk_per_trade);
  const riskSamples = result.trades
    .map((trade) => toNumber(pickRecordValue(trade, ["risk_usdt"])))
    .filter((value): value is number => value !== null);
  const avgRiskPerTrade =
    avgRiskFromSummary ??
    (riskSamples.length > 0
      ? riskSamples.reduce((sum, value) => sum + value, 0) / riskSamples.length
      : 0);

  const equityCurveFromPoints = mapEquityCurveFromChartPoints(result);
  const equityCurve =
    equityCurveFromPoints.length > 0
      ? equityCurveFromPoints
      : mapEquityCurveFromTrades(result.trades, initialBalance);

  return {
    initialBalance,
    finalBalance,
    totalPnl,
    avgRiskPerTrade,
    equityCurve,
  };
}

function humanizeMetricKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetricValue(value: unknown) {
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
}

export function toKpiRows(summary: JsonRecord | undefined) {
  if (!summary) {
    return [];
  }

  const clientStats = summary.client_stats ?? summary.clientStats;
  if (Array.isArray(clientStats)) {
    const rows = clientStats
      .map((item) => {
        const row = toRecord(item);
        if (!row) {
          return null;
        }
        const key = typeof row.key === "string" ? row.key : "";
        const label = typeof row.label === "string" && row.label.trim() ? row.label : humanizeMetricKey(key);
        if (!label) {
          return null;
        }
        return {
          label,
          value: formatMetricValue(row.value),
        };
      })
      .filter((row): row is { label: string; value: string } => row !== null);
    if (rows.length > 0) {
      return rows;
    }
  }

  const clientValues = toRecord(summary.client_values) ?? toRecord(summary.clientValues);
  const clientLabels = toRecord(summary.client_labels) ?? toRecord(summary.clientLabels) ?? {};
  if (clientValues) {
    const rows = Object.entries(clientValues).map(([key, value]) => {
      const mappedLabel = clientLabels[key];
      const label =
        typeof mappedLabel === "string" && mappedLabel.trim() ? mappedLabel : humanizeMetricKey(key);
      return {
        label,
        value: formatMetricValue(value),
      };
    });
    if (rows.length > 0) {
      return rows;
    }
  }

  return Object.entries(summary)
    .filter(([key, value]) => {
      if (
        key === "client_stats" ||
        key === "clientStats" ||
        key === "client_values" ||
        key === "clientValues" ||
        key === "client_labels" ||
        key === "clientLabels"
      ) {
        return false;
      }
      return typeof value !== "object" || value === null;
    })
    .map(([key, value]) => ({
      label: humanizeMetricKey(key),
      value: formatMetricValue(value),
    }));
}
