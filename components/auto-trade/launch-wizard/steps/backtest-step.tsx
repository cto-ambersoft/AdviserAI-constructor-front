import { useState, type Dispatch } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  extractBacktestMetrics,
  type BacktestMetrics,
} from "@/components/auto-trade/launch-wizard/metrics";
import type {
  WizardAction,
  WizardData,
} from "@/components/auto-trade/launch-wizard/state";
import { ApiError, runAtrOrderBlockBacktest } from "@/lib/api";
import type { PersonalAnalysisProfileRead } from "@/lib/api";
import { DEFAULT_BACKTEST_COSTS } from "@/lib/trading/backtest-costs";
import { notifyError } from "@/lib/notifications";

function fmt(value: number | null, suffix = "") {
  return value === null ? "—" : `${value.toFixed(1)}${suffix}`;
}

/**
 * Step 2 — run a quick ATR Order-Block backtest for the profile symbol and let
 * the user accept the result before going further (UX overhaul T8).
 */
export function BacktestStep({
  data,
  dispatch,
  profiles,
}: {
  data: WizardData;
  dispatch: Dispatch<WizardAction>;
  profiles: PersonalAnalysisProfileRead[];
}) {
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const profile = profiles.find((p) => p.id === data.profileId) ?? null;
  const symbol = profile?.symbol ?? "";

  const run = async () => {
    if (!symbol) {
      notifyError("Pick a profile first.");
      return;
    }
    setIsRunning(true);
    // Re-running invalidates a prior acceptance until the new result is accepted.
    dispatch({ type: "set", patch: { backtestAccepted: false } });
    try {
      // Quick validation run with conservative ATR Order-Block defaults; the
      // dashboard owns full parameter tuning.
      const result = await runAtrOrderBlockBacktest({
        ...DEFAULT_BACKTEST_COSTS,
        exchange_name: "bybit",
        symbol,
        timeframe: "1h",
        bars: 500,
        include_series: false,
        trades_limit: 1000,
        ema_period: 50,
        atr_period: 14,
        impulse_atr: 1.5,
        ob_buffer_atr: 0.15,
        one_trade_per_ob: true,
        allocation_usdt: 1000,
        run_with_ai: false,
        ai_entry_side_lock: true,
      });
      setMetrics(extractBacktestMetrics(result.summary));
    } catch (error) {
      notifyError(
        error instanceof ApiError && error.message
          ? error.message
          : "Backtest failed.",
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Validate <span className="font-medium text-foreground">{symbol || "the strategy"}</span>{" "}
        on recent history before risking it in sandbox.
      </p>

      <Button onClick={() => void run()} disabled={isRunning || !symbol}>
        {isRunning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running…
          </>
        ) : metrics ? (
          "Re-run backtest"
        ) : (
          "Run backtest"
        )}
      </Button>

      {metrics ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Win rate" value={fmt(metrics.winRate, "%")} />
          <Metric label="Total PnL" value={fmt(metrics.totalPnl)} />
          <Metric label="Max DD" value={fmt(metrics.maxDrawdown, "%")} />
          <Metric label="Sharpe" value={fmt(metrics.sharpe)} />
          <Metric label="Trades" value={metrics.trades === null ? "—" : String(metrics.trades)} />
        </div>
      ) : null}

      {metrics ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.backtestAccepted === true}
            onChange={(event) =>
              dispatch({
                type: "set",
                patch: { backtestAccepted: event.target.checked },
              })
            }
          />
          I accept this result and want to continue.
        </label>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border/70 bg-background/40 p-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-base text-foreground">{value}</div>
    </div>
  );
}
