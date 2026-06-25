import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PORTFOLIO_KPI_EVENT,
  useRiskEventsStore,
} from "@/stores/risk-events-store";

// Minimal EventSource mock: captures listeners so the test can dispatch events.
class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, ((e: { data: string }) => void)[]> = {};
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: { data: string }) => void): void {
    (this.listeners[type] ??= []).push(cb);
  }

  emit(type: string, data: string): void {
    for (const cb of this.listeners[type] ?? []) {
      cb({ data });
    }
  }

  close(): void {}
}

describe("risk-events-store portfolio_kpi (T15/W12g)", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    useRiskEventsStore.setState({
      lastPortfolioKpi: null,
      portfolioKpiSeq: 0,
      events: [],
      lastEvent: null,
      eventSeq: 0,
    });
  });

  afterEach(() => {
    useRiskEventsStore.getState().disconnect();
    vi.unstubAllGlobals();
  });

  it("updates lastPortfolioKpi from a portfolio_kpi event without touching the risk feed", () => {
    useRiskEventsStore.getState().connect();
    const source = MockEventSource.instances[0];
    expect(source).toBeTruthy();

    const payload = {
      total_realized_pnl_usdt: 42.0,
      portfolio_max_dd_pct: 5.5,
      strategies: [],
    };
    source.emit(
      PORTFOLIO_KPI_EVENT,
      JSON.stringify({ event_type: PORTFOLIO_KPI_EVENT, payload }),
    );

    const state = useRiskEventsStore.getState();
    expect(state.portfolioKpiSeq).toBe(1);
    expect(state.lastPortfolioKpi).toEqual(payload);
    // KPI snapshots must NOT pollute the risk-events feed.
    expect(state.events).toHaveLength(0);
    expect(state.eventSeq).toBe(0);
  });
});
