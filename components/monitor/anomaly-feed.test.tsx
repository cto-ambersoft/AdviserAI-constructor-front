import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AnomalyFeed, findingMetrics } from "@/components/monitor/anomaly-feed";
import { useRiskEventsStore, type RiskEvent } from "@/stores/risk-events-store";

function setEvents(events: RiskEvent[]) {
  useRiskEventsStore.setState({ events });
}

function anomaly(payload: Record<string, unknown>, receivedAt = 1): RiskEvent {
  return {
    event_type: "strategy_anomaly_detected",
    payload,
    message: "Strategy anomaly detected",
    receivedAt,
  };
}

describe("findingMetrics", () => {
  it("joins finding metric names, humanized", () => {
    expect(
      findingMetrics({
        findings: [{ metric: "pnl_zscore" }, { metric: "win_rate_collapse" }],
      }),
    ).toBe("pnl zscore, win rate collapse");
  });

  it("returns empty string for missing or malformed findings", () => {
    expect(findingMetrics({})).toBe("");
    expect(findingMetrics({ findings: "nope" })).toBe("");
    expect(findingMetrics({ findings: [{}, 5, null] })).toBe("");
  });
});

describe("AnomalyFeed", () => {
  beforeEach(() => setEvents([]));

  it("renders nothing when there are no anomaly events", () => {
    setEvents([
      {
        event_type: "kpi_guard_triggered",
        payload: {},
        message: null,
        receivedAt: 1,
      },
    ]);
    const { container } = render(<AnomalyFeed />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists recent anomalies with severity and the metrics that fired", () => {
    setEvents([
      anomaly({ severity: "critical", findings: [{ metric: "pnl_zscore" }] }),
    ]);
    const { container } = render(<AnomalyFeed />);
    expect(screen.getByText("Recent anomalies")).toBeInTheDocument();
    expect(container.textContent).toContain("critical");
    expect(container.textContent).toContain("pnl zscore");
  });

  it("ignores non-anomaly events in the buffer", () => {
    setEvents([
      anomaly({ severity: "warning", findings: [{ metric: "trade_frequency" }] }),
      {
        event_type: "data_stale",
        payload: {},
        message: null,
        receivedAt: 2,
      },
    ]);
    const { container } = render(<AnomalyFeed />);
    // Exactly one anomaly row.
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });
});
