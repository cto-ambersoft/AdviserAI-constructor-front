import { describe, expect, it } from "vitest";

import { extractBacktestMetrics } from "@/components/auto-trade/launch-wizard/metrics";

describe("extractBacktestMetrics", () => {
  it("pulls the common summary fields", () => {
    const m = extractBacktestMetrics({
      win_rate: 55.5,
      total_pnl: 123.4,
      max_drawdown_pct: -8.2,
      total_trades: 42,
      sharpe_proxy: 1.3,
    });
    expect(m.winRate).toBe(55.5);
    expect(m.totalPnl).toBe(123.4);
    expect(m.maxDrawdown).toBe(-8.2);
    expect(m.trades).toBe(42);
    expect(m.sharpe).toBe(1.3);
  });

  it("falls back across alternative key names", () => {
    const m = extractBacktestMetrics({
      total_pnl_usdt: 9,
      max_drawdown: -4,
    });
    expect(m.totalPnl).toBe(9);
    expect(m.maxDrawdown).toBe(-4);
  });

  it("returns null for missing or non-numeric fields", () => {
    const m = extractBacktestMetrics({ win_rate: "n/a" });
    expect(m.winRate).toBeNull();
    expect(m.totalPnl).toBeNull();
    expect(m.trades).toBeNull();
  });

  it("tolerates a null/empty summary", () => {
    const m = extractBacktestMetrics(null);
    expect(m.winRate).toBeNull();
    expect(m.trades).toBeNull();
  });
});
