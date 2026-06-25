"use client";

import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  PromotionStatusRead,
  StrategyHealthRead,
  StrategyPortfolioEntry,
} from "@/lib/api/types";
import {
  formatNum,
  formatPct,
  formatSignedUsdt,
  formatUsdt,
  formatKpiFreshness,
  HealthClassBadge,
  pnlTone,
} from "@/components/monitor/kpi-format";
import { PromotionGatePanel } from "@/components/monitor/promotion-gate-panel";
import { StrategyStatusBadge } from "@/components/auto-trade/strategy-status-badge";
import { cn, formatTimestamp } from "@/lib/utils";

type Props = {
  entry: StrategyPortfolioEntry;
  /** True while a lifecycle action for this strategy (or a bulk action) is in flight. */
  isBusy: boolean;
  onPlay: () => void;
  onStop: () => void;
  onClose: () => void;
  isExpanded: boolean;
  onToggleHealth: () => void;
  health: StrategyHealthRead | null;
  isHealthLoading: boolean;
  // B5 (W10) — promotion lifecycle.
  onPromote: () => void;
  onDemote: () => void;
  isPromotionExpanded: boolean;
  onTogglePromotion: () => void;
  promotion: PromotionStatusRead | null;
  isPromotionLoading: boolean;
};

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-base text-foreground", tone)}>{value}</span>
    </div>
  );
}

export function StrategyMonitorCard({
  entry,
  isBusy,
  onPlay,
  onStop,
  onClose,
  isExpanded,
  onToggleHealth,
  health,
  isHealthLoading,
  onPromote,
  onDemote,
  isPromotionExpanded,
  onTogglePromotion,
  promotion,
  isPromotionLoading,
}: Props) {
  const name = entry.strategy_name ?? entry.profile_symbol ?? "Strategy";
  const stage = entry.lifecycle_stage;
  const canPromote = promotion?.can_promote ?? false;
  const sampleSize = entry.sample_size;
  const sampleLabel =
    typeof sampleSize === "number"
      ? `${sampleSize} closed trade${sampleSize === 1 ? "" : "s"}`
      : "no closed trades yet";

  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-3 space-y-3">
      {/* Header — identity + run state + 4-state health badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">
            {entry.exchange_name} · {entry.mode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StrategyStatusBadge
            lifecycleStage={stage}
            isRunning={entry.is_running}
            canPromote={canPromote}
            showDot
          />
          <HealthClassBadge value={entry.health_class} />
        </div>
      </div>

      {/* Live KPIs — nullable → "—", never 0 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Win rate" value={formatPct(entry.win_rate_pct)} />
        <Metric label="ROI" value={formatPct(entry.roi_pct)} />
        <Metric label="Max DD" value={formatPct(entry.max_dd_pct)} />
        <Metric label="Sharpe (proxy)" value={formatNum(entry.sharpe_proxy)} />
      </div>

      {/* Money row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Realized PnL"
          value={formatSignedUsdt(entry.realized_pnl_usdt)}
          tone={pnlTone(entry.realized_pnl_usdt)}
        />
        <Metric
          label="Unrealized PnL"
          value={formatSignedUsdt(entry.unrealized_pnl_usdt)}
          tone={pnlTone(entry.unrealized_pnl_usdt)}
        />
        <Metric label="Margin used" value={formatUsdt(entry.margin_used_usdt)} />
        <Metric label="Balance" value={formatUsdt(entry.balance_total_usdt)} />
      </div>

      {/* Freshness + denominator label (mandatory — TZ §3) */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          {entry.open_positions_count} open · {sampleLabel} · KPIs{" "}
          {formatKpiFreshness(entry.kpi_as_of)}
        </span>
        <span>
          ROI / Max DD: % of per-trade notional (position_size_usdt),{" "}
          <strong>not account equity</strong> — W9 proxy.
        </span>
      </div>

      {entry.balance_error ? (
        <p className="text-[11px] text-amber-300">
          Balance unavailable: {entry.balance_error}
        </p>
      ) : null}

      {/* Controls. `play` is step-up-gated: the client interceptor prompts for a
          code automatically when 2FA is on — no special handling here. — §1/§3. */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {entry.is_running ? (
          <Button size="sm" variant="outline" onClick={onStop} disabled={isBusy}>
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Pause className="size-3.5" />
            )}
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={onPlay} disabled={isBusy}>
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Play
          </Button>
        )}
        {entry.open_positions_count > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={isBusy}
          >
            <XCircle className="size-3.5" />
            Close positions
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onToggleHealth}>
          <Activity className="size-3.5" />
          {isExpanded ? "Hide health" : "Health"}
        </Button>

        {/* Promotion lifecycle controls. Promote/Demote are step-up gated — the
            client interceptor prompts for a code automatically. */}
        {stage === "sandbox" || stage === "validation" ? (
          <>
            <Button size="sm" variant="ghost" onClick={onTogglePromotion}>
              <ShieldCheck className="size-3.5" />
              {isPromotionExpanded ? "Hide gate" : "Gate"}
            </Button>
            <Button
              size="sm"
              onClick={onPromote}
              // Always clickable for a sandbox strategy: gate-status (prefetched)
              // is time-varying, so we never *disable* on a possibly-stale
              // not-ready — the title hints readiness and a failed gate still
              // surfaces its criteria via the 422 toast + Gate panel.
              disabled={isBusy}
              title={
                promotion !== null && !canPromote
                  ? "KPI gate not satisfied yet — promoting will explain why"
                  : "Promote to live"
              }
            >
              {isBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUpCircle className="size-3.5" />
              )}
              Promote
            </Button>
          </>
        ) : null}
        {stage === "live" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDemote}
            disabled={isBusy}
            title="Demote to sandbox (stops the strategy)"
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowDownCircle className="size-3.5" />
            )}
            Demote
          </Button>
        ) : null}
      </div>

      {/* On-read composite health drill-down (W9 strategy-health endpoint). */}
      {isExpanded ? (
        <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
          {isHealthLoading && !health ? (
            <Skeleton className="h-4 w-40" />
          ) : !health ? (
            <p className="text-xs text-muted-foreground">
              Composite health unavailable — needs a saved strategy with closed
              trades.
            </p>
          ) : (
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Composite health · {health.window_days}d window
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric
                  label="Health score"
                  value={`${formatNum(health.health_score, 0)}/100`}
                />
                <Metric
                  label="Stability"
                  value={formatNum(health.stability_score)}
                />
                <Metric
                  label="Total PnL"
                  value={formatSignedUsdt(health.total_pnl_usdt)}
                  tone={pnlTone(health.total_pnl_usdt)}
                />
                <Metric
                  label="Closed trades"
                  value={formatNum(health.sample_size, 0)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                as of {formatTimestamp(health.computed_at)}
                {health.health_class === "insufficient_data"
                  ? " · insufficient data (< 10 closed trades) — not scored yet"
                  : ""}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Promotion KPI-gate readiness drill-down (B5 promotion-status endpoint). */}
      {isPromotionExpanded ? (
        <PromotionGatePanel promotion={promotion} isLoading={isPromotionLoading} />
      ) : null}
    </div>
  );
}
