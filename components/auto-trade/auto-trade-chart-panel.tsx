"use client";

import type { SeriesMarker, Time } from "lightweight-charts";
import { MarketChart } from "@/components/trading/market-chart";
import { INPUT_CLASS } from "@/components/trading/form-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CandlePoint } from "@/lib/trading/chart-types";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";

type Props = {
  candles: CandlePoint[];
  markers: SeriesMarker<Time>[];
  symbol: string;
  timeframe: string;
  bars: number;
  minBars: number;
  maxBars: number;
  timeframes: string[];
  isLoading: boolean;
  onTimeframeChange: (value: string) => void;
  onBarsChange: (value: number) => void;
};

export function AutoTradeChartPanel({
  candles,
  markers,
  symbol,
  timeframe,
  bars,
  minBars,
  maxBars,
  timeframes,
  isLoading,
  onTimeframeChange,
  onBarsChange,
}: Props) {
  return (
    <Card className={CARD_CLASS}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Market Chart</CardTitle>
          <div className="flex items-center gap-2">
            <select
              className={`${INPUT_CLASS} min-w-24`}
              value={timeframe}
              onChange={(event) => onTimeframeChange(event.target.value)}
            >
              {timeframes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              className={`${INPUT_CLASS} w-24`}
              type="number"
              value={bars}
              min={minBars}
              max={maxBars}
              step={10}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  const clamped = Math.max(
                    minBars,
                    Math.min(maxBars, Math.round(value)),
                  );
                  onBarsChange(clamped);
                }
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[420px] w-full" />
        ) : candles.length === 0 ? (
          <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted-foreground">
            No OHLCV data for current scope.
          </div>
        ) : (
          <MarketChart candles={candles} markers={markers} height={420} />
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Symbol: {symbol || "-"} | Candles: {candles.length}
        </p>
      </CardContent>
    </Card>
  );
}
