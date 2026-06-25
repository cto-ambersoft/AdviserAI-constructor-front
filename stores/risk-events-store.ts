"use client";

import { create } from "zustand";

// Streamable risk/governance event types (mirror of the backend STREAMABLE_EVENTS
// in constructor/app/services/events/stream.py). — TZ §4.
export const RISK_EVENT_TYPES = [
  "risk_blocked",
  "risk_check_degraded",
  "kpi_guard_triggered",
  "strategy_auto_paused",
  "kill_switch_triggered",
  "position_emergency_closed_unprotected",
  "data_stale",
  "portfolio_dd_halt",
  // B5 (W10) Promotion Pipeline + B6 (W12) anomaly detection.
  "promotion_ready",
  "strategy_promoted",
  "strategy_demoted",
  "promotion_gate_failed",
  "strategy_anomaly_detected",
] as const;

export type RiskEventType = (typeof RISK_EVENT_TYPES)[number];

export type RiskEvent = {
  event_type: string;
  payload: Record<string, unknown>;
  message: string | null;
  /** Client receive time — used for ordering / display. */
  receivedAt: number;
};

export type RiskEventsStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "limited";

const STREAM_URL = "/api/events/stream";
const EVENT_BUFFER_LIMIT = 50;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30_000;
// After this many consecutive failures we slow to the max delay and surface a
// "limited" state instead of hammering (covers the 429 stream-cap case). — §4.2.
const LIMITED_AFTER_ATTEMPTS = 5;

/** Exponential backoff with jitter; capped at RECONNECT_MAX_MS. */
export function reconnectDelayMs(attempt: number): number {
  const exponential = RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(RECONNECT_MAX_MS, exponential);
  return capped + Math.floor(Math.random() * 1000);
}

/** Parse an SSE `data:` line into a RiskEvent, or null when malformed. */
export function parseRiskEvent(
  raw: string,
  fallbackType: string,
  receivedAt: number,
): RiskEvent | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const payload = parsed.payload;
    return {
      event_type:
        typeof parsed.event_type === "string" ? parsed.event_type : fallbackType,
      payload:
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {},
      message: typeof parsed.message === "string" ? parsed.message : null,
      receivedAt,
    };
  } catch {
    return null;
  }
}

type RiskEventsState = {
  status: RiskEventsStatus;
  events: RiskEvent[];
  lastEvent: RiskEvent | null;
  /** Monotonic counter — consumers key effects on this to react to new events. */
  eventSeq: number;
  /**
   * T15 (W12g): latest portfolio KPI snapshot pushed over SSE (same shape as
   * GET /auto-trade/portfolio). Kept OUT of the risk `events` feed — it's a data
   * update, not an alert. The Live Monitor renders KPIs from this instead of polling.
   */
  lastPortfolioKpi: Record<string, unknown> | null;
  portfolioKpiSeq: number;
  connect: () => void;
  disconnect: () => void;
  ingest: (event: RiskEvent) => void;
};

/** SSE event name carrying the portfolio KPI snapshot (not a risk alert). */
export const PORTFOLIO_KPI_EVENT = "portfolio_kpi";

// Module-scoped connection state — guarantees exactly ONE EventSource per tab,
// independent of how many components subscribe. — §4.2.
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let manualClose = false;

export const useRiskEventsStore = create<RiskEventsState>((set, get) => {
  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (manualClose) {
      return;
    }
    reconnectAttempts += 1;
    set({
      status:
        reconnectAttempts >= LIMITED_AFTER_ATTEMPTS ? "limited" : "reconnecting",
    });
    clearReconnectTimer();
    reconnectTimer = setTimeout(openConnection, reconnectDelayMs(reconnectAttempts));
  }

  function openConnection() {
    if (typeof window === "undefined") {
      return;
    }
    clearReconnectTimer();
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    manualClose = false;
    set({ status: reconnectAttempts > 0 ? "reconnecting" : "connecting" });

    const source = new EventSource(STREAM_URL);
    eventSource = source;

    source.onopen = () => {
      reconnectAttempts = 0;
      set({ status: "open" });
    };

    source.onerror = () => {
      // EventSource is CLOSED on a fatal error (incl. our BFF's non-200 such as
      // 429). Take over reconnection ourselves with backoff instead of letting
      // it busy-loop.
      source.close();
      if (eventSource === source) {
        eventSource = null;
      }
      scheduleReconnect();
    };

    const onNamed = (event: MessageEvent, fallbackType: string) => {
      const parsed = parseRiskEvent(event.data, fallbackType, Date.now());
      if (parsed) {
        get().ingest(parsed);
      }
    };

    for (const type of RISK_EVENT_TYPES) {
      source.addEventListener(type, (event) =>
        onNamed(event as MessageEvent, type),
      );
    }
    // T15: portfolio KPI snapshots update a dedicated slot, NOT the risk feed.
    source.addEventListener(PORTFOLIO_KPI_EVENT, (event) => {
      const parsed = parseRiskEvent(
        (event as MessageEvent).data,
        PORTFOLIO_KPI_EVENT,
        Date.now(),
      );
      if (parsed) {
        set((state) => ({
          lastPortfolioKpi: parsed.payload,
          portfolioKpiSeq: state.portfolioKpiSeq + 1,
        }));
      }
    });
    source.onmessage = (event) => onNamed(event, "message");
  }

  return {
    status: "idle",
    events: [],
    lastEvent: null,
    eventSeq: 0,
    lastPortfolioKpi: null,
    portfolioKpiSeq: 0,

    connect: () => {
      // Idempotent: one EventSource per tab. Skip if already active/scheduled.
      const status = get().status;
      if (
        eventSource ||
        reconnectTimer ||
        status === "connecting" ||
        status === "open"
      ) {
        return;
      }
      manualClose = false;
      reconnectAttempts = 0;
      openConnection();
    },

    disconnect: () => {
      manualClose = true;
      clearReconnectTimer();
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      reconnectAttempts = 0;
      set({ status: "idle" });
    },

    ingest: (event) =>
      set((state) => ({
        events: [event, ...state.events].slice(0, EVENT_BUFFER_LIMIT),
        lastEvent: event,
        eventSeq: state.eventSeq + 1,
      })),
  };
});
