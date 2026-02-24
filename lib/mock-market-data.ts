import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import type { Timeframe } from "@/stores/trading-store";

const timeframeToSeconds: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 60 * 5,
  "15m": 60 * 15,
  "1h": 60 * 60,
  "4h": 60 * 60 * 4,
  "1d": 60 * 60 * 24,
};

export function generateMockCandles(
  timeframe: Timeframe,
  basePrice: number,
  points = 180,
): CandlestickData[] {
  const candles: CandlestickData[] = [];
  const step = timeframeToSeconds[timeframe];
  const now = Math.floor(Date.now() / 1000);
  const start = now - points * step;
  let previousClose = basePrice;

  for (let i = 0; i < points; i += 1) {
    const drift = (Math.random() - 0.5) * 90;
    const open = previousClose;
    const close = Math.max(1, open + drift);
    const wickUp = Math.random() * 65;
    const wickDown = Math.random() * 65;

    candles.push({
      time: (start + i * step) as UTCTimestamp,
      open,
      high: Math.max(open, close) + wickUp,
      low: Math.max(1, Math.min(open, close) - wickDown),
      close,
    });

    previousClose = close;
  }

  return candles;
}
