import type { SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";
import type { BacktestResponse, JsonRecord, MarketOhlcvResponse } from "@/lib/api/types";
import type { CandlePoint, OverlayLine } from "@/lib/trading/chart-types";

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
        const value = toNumber(pickRecordValue(record, ["value", "v", "price", "y"]));
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
      pickRecordValue(row, ["entry_time", "entry_ts", "open_time", "time"]),
    );
    const exitTime = toUnixTimestamp(
      pickRecordValue(row, ["exit_time", "close_time", "exit_ts"]),
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
  return markers;
}

export function toKpiRows(summary: JsonRecord | undefined) {
  if (!summary) {
    return [];
  }
  return Object.entries(summary).map(([key, value]) => ({
    label: key,
    value:
      typeof value === "number"
        ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : String(value),
  }));
}
