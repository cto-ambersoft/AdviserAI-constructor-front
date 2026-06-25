/**
 * Defensive extraction of headline metrics from a free-form backtest `summary`
 * (UX overhaul T8). The backend types `summary` as an open record, so we pull
 * known keys (with a couple of historical aliases) and coerce to number|null.
 */
export type BacktestMetrics = {
  winRate: number | null;
  totalPnl: number | null;
  maxDrawdown: number | null;
  trades: number | null;
  sharpe: number | null;
};

type Summary = Record<string, unknown> | null | undefined;

function num(summary: Summary, ...keys: string[]): number | null {
  if (!summary) return null;
  for (const key of keys) {
    const value = summary[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function extractBacktestMetrics(summary: Summary): BacktestMetrics {
  return {
    winRate: num(summary, "win_rate", "win_rate_pct"),
    totalPnl: num(summary, "total_pnl", "total_pnl_usdt", "net_profit"),
    maxDrawdown: num(summary, "max_drawdown_pct", "max_drawdown"),
    trades: num(summary, "total_trades", "num_trades", "trades_count"),
    sharpe: num(summary, "sharpe_proxy", "sharpe"),
  };
}
