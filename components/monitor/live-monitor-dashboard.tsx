"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Play, RefreshCw, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  demoteStrategy,
  getAutoTradePortfolio,
  getPromotionStatus,
  getStrategyHealth,
  playAllAutoTrade,
  playAutoTrade,
  promoteStrategy,
  stopAllAutoTrade,
  stopAutoTrade,
} from "@/lib/api";
import type {
  PortfolioSummaryResponse,
  PromotionStatusRead,
  StrategyHealthRead,
  StrategyPortfolioEntry,
} from "@/lib/api/types";
import { AutoTradeClosePositionsModal } from "@/components/auto-trade/auto-trade-close-positions-modal";
import {
  formatPct,
  formatSignedUsdt,
  pnlTone,
} from "@/components/monitor/kpi-format";
import { AnomalyFeed } from "@/components/monitor/anomaly-feed";
import { sandboxConfigIds } from "@/components/monitor/promotion-utils";
import { StrategyMonitorCard } from "@/components/monitor/strategy-monitor-card";
import {
  notifyRiskEvent,
  REFETCH_EVENT_TYPES,
} from "@/components/risk-events/risk-event-display";
import {
  useRiskEventsStore,
  type RiskEventsStatus,
} from "@/stores/risk-events-store";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const CARD_CLASS = "border-border/80 bg-card/80 shadow-sm backdrop-blur";
const POLL_INTERVAL_MS = 30_000;

function strategyLabel(entry: StrategyPortfolioEntry): string {
  return entry.strategy_name ?? entry.profile_symbol ?? "Strategy";
}

export function LiveMonitorDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioSummaryResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-strategy lifecycle busy flags + bulk busy + close-modal target.
  const [pendingByConfig, setPendingByConfig] = useState<
    Record<number, boolean>
  >({});
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [closeTarget, setCloseTarget] = useState<{
    accountId: number;
    label: string;
  } | null>(null);

  // Health drill-down state, keyed by config_id (undefined = not yet fetched).
  const [expandedConfigId, setExpandedConfigId] = useState<number | null>(null);
  const [healthByConfig, setHealthByConfig] = useState<
    Record<number, StrategyHealthRead | null>
  >({});
  const [healthLoading, setHealthLoading] = useState<Record<number, boolean>>(
    {},
  );

  // B5 (W10) — promotion gate-status drill-down state, keyed by config_id.
  const [promotionExpandedId, setPromotionExpandedId] = useState<number | null>(
    null,
  );
  const [promotionByConfig, setPromotionByConfig] = useState<
    Record<number, PromotionStatusRead | null>
  >({});
  const [promotionLoading, setPromotionLoading] = useState<
    Record<number, boolean>
  >({});

  // `silent` refreshes (poll / after-action) update data without flipping the
  // full-page skeleton or clobbering the view with a transient error. — §3.
  const loadPortfolio = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoading(true);
    }
    try {
      const next = await getAutoTradePortfolio();
      setPortfolio(next);
      setError(null);
    } catch (caught) {
      if (!opts?.silent) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Could not load portfolio.",
        );
      }
    } finally {
      if (!opts?.silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  // AC#7 — auto-poll so the dashboard reads as "live". 30s interval, skipped
  // while the tab is hidden (no background requests), and re-fetched promptly
  // on return. Held in a ref so the timer is created once. — §3.
  const pollRef = useRef<() => void>(() => {});
  useEffect(() => {
    pollRef.current = () => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      void loadPortfolio({ silent: true });
    };
  }, [loadPortfolio]);
  useEffect(() => {
    const interval = setInterval(() => pollRef.current(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        pollRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const setConfigPending = useCallback((configId: number, value: boolean) => {
    setPendingByConfig((prev) => ({ ...prev, [configId]: value }));
  }, []);

  const handlePlay = useCallback(
    async (entry: StrategyPortfolioEntry) => {
      setConfigPending(entry.config_id, true);
      try {
        // Gated — the step-up interceptor prompts for a code when 2FA is on.
        await playAutoTrade({ account_id: entry.account_id });
        notifySuccess(`Started ${strategyLabel(entry)}.`);
        await loadPortfolio({ silent: true });
      } catch (caught) {
        if (caught instanceof ApiError) notifyError(caught.message);
        else throw caught;
      } finally {
        setConfigPending(entry.config_id, false);
      }
    },
    [loadPortfolio, setConfigPending],
  );

  const handleStop = useCallback(
    async (entry: StrategyPortfolioEntry) => {
      setConfigPending(entry.config_id, true);
      try {
        await stopAutoTrade({ account_id: entry.account_id });
        notifySuccess(`Stopped ${strategyLabel(entry)}.`);
        await loadPortfolio({ silent: true });
      } catch (caught) {
        if (caught instanceof ApiError) notifyError(caught.message);
        else throw caught;
      } finally {
        setConfigPending(entry.config_id, false);
      }
    },
    [loadPortfolio, setConfigPending],
  );

  const handlePlayAll = useCallback(async () => {
    setIsBulkBusy(true);
    try {
      const outcome = await playAllAutoTrade();
      notifySuccess(
        `Play-all: ${outcome.succeeded} started, ${outcome.skipped} skipped, ${outcome.failed} failed.`,
      );
      await loadPortfolio({ silent: true });
    } catch (caught) {
      if (caught instanceof ApiError) notifyError(caught.message);
      else throw caught;
    } finally {
      setIsBulkBusy(false);
    }
  }, [loadPortfolio]);

  const handleStopAll = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Stop every running strategy? Open positions stay open.")
    ) {
      return;
    }
    setIsBulkBusy(true);
    try {
      const outcome = await stopAllAutoTrade();
      notifySuccess(
        `Stop-all: ${outcome.succeeded} stopped, ${outcome.skipped} skipped, ${outcome.failed} failed.`,
      );
      await loadPortfolio({ silent: true });
    } catch (caught) {
      if (caught instanceof ApiError) notifyError(caught.message);
      else throw caught;
    } finally {
      setIsBulkBusy(false);
    }
  }, [loadPortfolio]);

  const handleToggleHealth = useCallback(
    async (entry: StrategyPortfolioEntry) => {
      const configId = entry.config_id;
      if (expandedConfigId === configId) {
        setExpandedConfigId(null);
        return;
      }
      setExpandedConfigId(configId);
      if (healthByConfig[configId] !== undefined) {
        return; // already fetched (value or null)
      }
      setHealthLoading((prev) => ({ ...prev, [configId]: true }));
      try {
        const health = await getStrategyHealth(configId);
        setHealthByConfig((prev) => ({ ...prev, [configId]: health }));
      } catch {
        setHealthByConfig((prev) => ({ ...prev, [configId]: null }));
      } finally {
        setHealthLoading((prev) => ({ ...prev, [configId]: false }));
      }
    },
    [expandedConfigId, healthByConfig],
  );

  // B5 — fetch the promotion gate-status for one strategy. Deliberately NOT
  // cached: readiness is time-varying (a sandbox strategy accrues demo trades)
  // and gates an irreversible, real-money Promote action, so every view must be
  // fresh. The prior cached value keeps rendering until the new fetch resolves.
  const loadPromotionStatus = useCallback(async (configId: number) => {
    setPromotionLoading((prev) => ({ ...prev, [configId]: true }));
    try {
      const status = await getPromotionStatus(configId);
      setPromotionByConfig((prev) => ({ ...prev, [configId]: status }));
    } catch {
      setPromotionByConfig((prev) => ({ ...prev, [configId]: null }));
    } finally {
      setPromotionLoading((prev) => ({ ...prev, [configId]: false }));
    }
  }, []);

  // S3 — prefetch gate-status for sandbox strategies so the Promote button/title
  // reflects readiness without opening the Gate panel. Keyed on the *set* of
  // sandbox config_ids, so it runs when a strategy enters sandbox (new / demoted)
  // — not on every PnL poll. Bounded by sandbox count.
  const sandboxKey = sandboxConfigIds(portfolio).join(",");
  useEffect(() => {
    if (!sandboxKey) return;
    for (const configId of sandboxKey.split(",").map(Number)) {
      void loadPromotionStatus(configId);
    }
  }, [sandboxKey, loadPromotionStatus]);

  const handleTogglePromotion = useCallback(
    async (entry: StrategyPortfolioEntry) => {
      const configId = entry.config_id;
      if (promotionExpandedId === configId) {
        setPromotionExpandedId(null);
        return;
      }
      setPromotionExpandedId(configId);
      await loadPromotionStatus(configId);
    },
    [promotionExpandedId, loadPromotionStatus],
  );

  const handlePromote = useCallback(
    async (entry: StrategyPortfolioEntry) => {
      const configId = entry.config_id;
      setConfigPending(configId, true);
      try {
        // Step-up gated — the client interceptor prompts for a 2FA code.
        await promoteStrategy(configId);
        notifySuccess(`Promoted ${strategyLabel(entry)} to live.`);
        await loadPortfolio({ silent: true });
      } catch (caught) {
        if (caught instanceof ApiError) {
          if (caught.status === 422) {
            notifyError(
              "Promotion gate not satisfied — see the Gate panel for which criteria failed.",
            );
            // Surface the fresh criteria so the user sees why it was blocked.
            setPromotionExpandedId(configId);
            void loadPromotionStatus(configId);
          } else {
            notifyError(caught.message);
          }
        } else throw caught;
      } finally {
        setConfigPending(configId, false);
      }
    },
    [loadPortfolio, loadPromotionStatus, setConfigPending],
  );

  const handleDemote = useCallback(
    async (entry: StrategyPortfolioEntry) => {
      const configId = entry.config_id;
      setConfigPending(configId, true);
      try {
        await demoteStrategy(configId);
        notifySuccess(`Demoted ${strategyLabel(entry)} to sandbox.`);
        // Drop the old gate snapshot so a re-expand shows fresh criteria, not
        // the stale status from this strategy's previous sandbox tenure.
        setPromotionByConfig((prev) => {
          const next = { ...prev };
          delete next[configId];
          return next;
        });
        await loadPortfolio({ silent: true });
      } catch (caught) {
        if (caught instanceof ApiError) notifyError(caught.message);
        else throw caught;
      } finally {
        setConfigPending(configId, false);
      }
    },
    [loadPortfolio, setConfigPending],
  );

  // F5 — react to live risk events (hints, not source of truth): toast each one
  // and refetch the portfolio for state-changing events (paused/halted). Fires
  // once per new event (eventSeq); loadPortfolio is stable. — §4.2.
  const eventSeq = useRiskEventsStore((state) => state.eventSeq);
  const connectionStatus = useRiskEventsStore((state) => state.status);
  useEffect(() => {
    if (eventSeq === 0) {
      return;
    }
    const event = useRiskEventsStore.getState().lastEvent;
    if (!event) {
      return;
    }
    notifyRiskEvent(event);
    if (REFETCH_EVENT_TYPES.has(event.event_type)) {
      void loadPortfolio({ silent: true });
    }
  }, [eventSeq, loadPortfolio]);

  // T15 (W12g): KPI numbers arrive over SSE (portfolio_kpi) — render them straight
  // from the stream instead of waiting for the 30s poll. The poll stays as a
  // fallback (page load, missed events, balances). Same shape as getAutoTradePortfolio.
  const portfolioKpiSeq = useRiskEventsStore((state) => state.portfolioKpiSeq);
  useEffect(() => {
    if (portfolioKpiSeq === 0) {
      return;
    }
    const snapshot = useRiskEventsStore.getState().lastPortfolioKpi as
      | PortfolioSummaryResponse
      | null;
    if (snapshot) {
      // I5: the push skips the merged-equity DD (sends 0); keep the last polled
      // portfolio_max_dd_pct so the live PnL update doesn't zero the DD card.
      setPortfolio((prev) => ({
        ...snapshot,
        portfolio_max_dd_pct:
          snapshot.portfolio_max_dd_pct || prev?.portfolio_max_dd_pct || 0,
      }));
    }
  }, [portfolioKpiSeq]);

  const strategies = portfolio?.strategies ?? [];
  const hasStrategies = strategies.length > 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Live Monitor</h1>
            <ConnectionPill status={connectionStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            Portfolio-wide auto-trade KPIs across every strategy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void handlePlayAll()}
            disabled={isBulkBusy || !hasStrategies}
          >
            {isBulkBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Play all
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleStopAll()}
            disabled={isBulkBusy || !hasStrategies}
          >
            <Square className="size-4" />
            Stop all
          </Button>
          <Button
            variant="outline"
            onClick={() => void loadPortfolio()}
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

      <AnomalyFeed />

      {error ? (
        <Card className={CARD_CLASS}>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <PortfolioSummary portfolio={portfolio} isLoading={isLoading && !portfolio} />

      {isLoading && !portfolio ? (
        <Card className={CARD_CLASS}>
          <CardContent className="space-y-2 py-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : strategies.length === 0 ? (
        <Card className={CARD_CLASS}>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <div>
              <p className="text-sm font-medium">No active strategies yet</p>
              <p className="text-sm text-muted-foreground">
                Launch one to start tracking its live KPIs here.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/auto-trade/new">New strategy</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Strategies ({strategies.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {strategies.map((entry) => (
              <StrategyMonitorCard
                key={entry.config_id}
                entry={entry}
                isBusy={Boolean(pendingByConfig[entry.config_id]) || isBulkBusy}
                onPlay={() => void handlePlay(entry)}
                onStop={() => void handleStop(entry)}
                onClose={() =>
                  setCloseTarget({
                    accountId: entry.account_id,
                    label: strategyLabel(entry),
                  })
                }
                isExpanded={expandedConfigId === entry.config_id}
                onToggleHealth={() => void handleToggleHealth(entry)}
                health={healthByConfig[entry.config_id] ?? null}
                isHealthLoading={Boolean(healthLoading[entry.config_id])}
                onPromote={() => void handlePromote(entry)}
                onDemote={() => void handleDemote(entry)}
                isPromotionExpanded={promotionExpandedId === entry.config_id}
                onTogglePromotion={() => void handleTogglePromotion(entry)}
                promotion={promotionByConfig[entry.config_id] ?? null}
                isPromotionLoading={Boolean(
                  promotionLoading[entry.config_id],
                )}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {closeTarget ? (
        <AutoTradeClosePositionsModal
          accountId={closeTarget.accountId}
          accountLabel={closeTarget.label}
          open
          onOpenChange={(open) => {
            if (!open) setCloseTarget(null);
          }}
          onClosed={() => {
            void loadPortfolio({ silent: true });
          }}
        />
      ) : null}
    </main>
  );
}

function ConnectionPill({ status }: { status: RiskEventsStatus }) {
  const config: Record<
    string,
    { label: string; dot: string; text: string }
  > = {
    open: { label: "Live", dot: "bg-emerald-400", text: "text-emerald-300" },
    connecting: {
      label: "Connecting…",
      dot: "bg-muted-foreground/60",
      text: "text-muted-foreground",
    },
    reconnecting: {
      label: "Reconnecting…",
      dot: "bg-amber-400",
      text: "text-amber-300",
    },
    limited: { label: "Stream limited", dot: "bg-red-400", text: "text-red-300" },
    idle: {
      label: "Offline",
      dot: "bg-muted-foreground/50",
      text: "text-muted-foreground",
    },
  };
  const { label, dot, text } = config[status] ?? config.idle;
  return (
    <span
      className={cn("flex items-center gap-1.5 text-xs", text)}
      title="Live risk-event stream"
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function PortfolioSummary({
  portfolio,
  isLoading,
}: {
  portfolio: PortfolioSummaryResponse | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card className={CARD_CLASS}>
        <CardContent className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!portfolio) {
    return null;
  }

  return (
    <Card className={CARD_CLASS}>
      <CardContent className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-5">
        <SummaryMetric
          label="Realized PnL"
          value={formatSignedUsdt(portfolio.total_realized_pnl_usdt)}
          tone={pnlTone(portfolio.total_realized_pnl_usdt)}
        />
        <SummaryMetric
          label="Unrealized PnL"
          value={formatSignedUsdt(portfolio.total_unrealized_pnl_usdt)}
          tone={pnlTone(portfolio.total_unrealized_pnl_usdt)}
        />
        <SummaryMetric
          label="Open positions"
          value={String(portfolio.total_open_positions)}
        />
        <SummaryMetric
          label="Running strategies"
          value={String(portfolio.total_running_strategies)}
        />
        <SummaryMetric
          label="Portfolio Max DD"
          value={formatPct(portfolio.portfolio_max_dd_pct)}
          hint="% of per-trade notional, not account equity (W9 proxy)."
        />
      </CardContent>
    </Card>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-lg", tone)}>{value}</span>
      {hint ? (
        <span className="text-[10px] leading-tight text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
