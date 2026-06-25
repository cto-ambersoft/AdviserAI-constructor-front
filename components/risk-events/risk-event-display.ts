import { notifyError, notifyInfo, notifyWarning } from "@/lib/notifications";
import type { RiskEvent } from "@/stores/risk-events-store";

// Human titles per risk event type. — TZ §4.
const RISK_EVENT_TITLES: Record<string, string> = {
  kill_switch_triggered: "Volatility kill-switch triggered",
  portfolio_dd_halt: "Portfolio drawdown halt",
  kpi_guard_triggered: "KPI guard tripped",
  strategy_auto_paused: "Strategy auto-paused",
  position_emergency_closed_unprotected:
    "Unprotected position emergency-closed",
  data_stale: "Market data is stale",
  risk_blocked: "Entry blocked by risk rules",
  risk_check_degraded: "Risk check degraded",
  // B5 (W10) Promotion Pipeline + B6 (W12) anomaly detection.
  promotion_ready: "Strategy ready for promotion",
  strategy_promoted: "Strategy promoted to live",
  strategy_demoted: "Strategy demoted to sandbox",
  promotion_gate_failed: "Promotion gate not satisfied",
  strategy_anomaly_detected: "Strategy anomaly detected",
};

const ERROR_EVENTS = new Set<string>([
  "kill_switch_triggered",
  "portfolio_dd_halt",
  "position_emergency_closed_unprotected",
]);

const WARNING_EVENTS = new Set<string>([
  "kpi_guard_triggered",
  "strategy_auto_paused",
  "data_stale",
  // Promotion blocked + anomaly are advisory warnings (no auto-action taken).
  "promotion_gate_failed",
  "strategy_anomaly_detected",
]);

// Events that may have flipped strategy/portfolio state (paused, halted, stage
// changed) and so warrant a portfolio refetch — events are hints, not the
// source of truth. — §4.2.
export const REFETCH_EVENT_TYPES = new Set<string>([
  "kill_switch_triggered",
  "portfolio_dd_halt",
  "kpi_guard_triggered",
  "strategy_auto_paused",
  "position_emergency_closed_unprotected",
  // Promotion/demotion change lifecycle_stage shown on the monitor card.
  "strategy_promoted",
  "strategy_demoted",
]);

export function riskEventTitle(event: RiskEvent): string {
  return (
    RISK_EVENT_TITLES[event.event_type] ??
    event.event_type.replace(/_/g, " ")
  );
}

/** Toast a risk event at a severity matched to its type, deduped per type+message. */
export function notifyRiskEvent(event: RiskEvent): void {
  const title = riskEventTitle(event);
  const message = event.message ? `${title}: ${event.message}` : title;
  const options = {
    dedupeKey: `risk:${event.event_type}:${event.message ?? ""}`,
  };

  if (ERROR_EVENTS.has(event.event_type)) {
    notifyError(message, options);
  } else if (WARNING_EVENTS.has(event.event_type)) {
    notifyWarning(message, options);
  } else {
    notifyInfo(message, options);
  }
}
