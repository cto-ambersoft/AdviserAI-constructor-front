"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountBalanceResponse, StrategyPortfolioEntry } from "@/lib/api/types";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";

type Props = {
  /**
   * Portfolio entry for the currently-selected strategy. Provides
   * margin_used_usdt and the basic strategy metadata; balance comes from the
   * separate ``getAutoTradeBalance`` call so the card can show a degraded
   * state if the exchange fetch fails without dragging the whole portfolio
   * response down.
   */
  strategy: StrategyPortfolioEntry | null;
  balance: AccountBalanceResponse | null;
  leverage: number;
  isLoading: boolean;
};

function formatUsdt(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)} USDT`;
}

export function AutoTradeBudgetCard({ strategy, balance, leverage, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-32" />
          <div className="mt-3">
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (strategy === null) {
    return (
      <Card className={CARD_CLASS}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No strategy selected.</p>
        </CardContent>
      </Card>
    );
  }

  const balanceTotal = balance?.total_usdt ?? strategy.balance_total_usdt;
  const balanceFree = balance?.free_usdt ?? strategy.balance_free_usdt;
  const balanceError = balance?.error ?? strategy.balance_error;
  const marginUsed = strategy.margin_used_usdt;

  // Used / total ratio for the progress bar. We clamp to [0, 100] so a
  // momentarily-stale balance reading does not produce a >100 % bar.
  const ratio =
    typeof balanceTotal === "number" && balanceTotal > 0
      ? Math.max(0, Math.min(100, (marginUsed / balanceTotal) * 100))
      : null;

  // W9 — `margin_used_usdt` is now the posted MARGIN (Σ notional/leverage), not
  // notional. Per product decision §9.2 the portfolio surfaces margin only and
  // does not render notional as a separate figure; we keep the leveraged
  // exposure as an explanatory tooltip on the "margin used" caption instead.
  const marginLabel = `Posted margin across open positions (Σ notional / leverage). Leveraged exposure ≈ margin × ${leverage}×.`;

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Budget — {strategy.strategy_name ?? strategy.profile_symbol ?? "Strategy"}
        </CardTitle>
        {strategy.mode ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
              strategy.mode === "real"
                ? "bg-amber-500/20 text-amber-200"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {strategy.mode}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl">
            {formatUsdt(marginUsed)} / {formatUsdt(balanceTotal)}
          </p>
          {ratio !== null ? (
            <span className="text-xs text-muted-foreground">{ratio.toFixed(0)} %</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span
            title={marginLabel}
            className="cursor-help underline decoration-dotted underline-offset-2"
          >
            margin used
          </span>{" "}
          / balance
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-emerald-500/60"
            style={{ width: ratio !== null ? `${ratio}%` : "0%" }}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {strategy.open_positions_count} open position
          {strategy.open_positions_count === 1 ? "" : "s"} • free{" "}
          {formatUsdt(balanceFree)}
        </div>
        {balanceError ? (
          <p className="mt-2 text-xs text-amber-300">
            Balance unavailable: {balanceError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
