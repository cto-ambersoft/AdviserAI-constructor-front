"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { useRiskEventsStore } from "@/stores/risk-events-store";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 8;

/** Per-finding metrics carried on a strategy_anomaly_detected event payload. */
export function findingMetrics(payload: Record<string, unknown>): string {
  const findings = payload.findings;
  if (!Array.isArray(findings)) return "";
  return findings
    .map((f) =>
      f && typeof f === "object" && typeof (f as { metric?: unknown }).metric === "string"
        ? (f as { metric: string }).metric
        : null,
    )
    .filter((m): m is string => Boolean(m))
    .map((m) => m.replace(/_/g, " "))
    .join(", ");
}

/**
 * B6 (W12) — a compact feed of the most recent anomaly alerts, read from the
 * risk-events SSE buffer. Renders nothing until an anomaly arrives, so it adds
 * no empty chrome to the monitor.
 */
export function AnomalyFeed() {
  const events = useRiskEventsStore((state) => state.events);
  // Selecting the raw `events` array is the correct zustand pattern (filtering
  // inside the selector would return a new reference each render); memoize the
  // derived list so it only recomputes when the buffer changes.
  const anomalies = useMemo(
    () =>
      events
        .filter((event) => event.event_type === "strategy_anomaly_detected")
        .slice(0, MAX_SHOWN),
    [events],
  );

  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-300" />
        <h3 className="text-sm font-semibold">Recent anomalies</h3>
      </div>
      <ul className="space-y-1">
        {anomalies.map((event, index) => {
          const severity =
            typeof event.payload.severity === "string"
              ? event.payload.severity
              : "warning";
          const metrics = findingMetrics(event.payload);
          return (
            <li
              key={`${event.receivedAt}-${index}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-muted-foreground">
                <span
                  className={cn(
                    "font-medium uppercase",
                    severity === "critical"
                      ? "text-red-300"
                      : "text-amber-300",
                  )}
                >
                  {severity}
                </span>
                {metrics ? ` · ${metrics}` : ""}
              </span>
              <span className="text-muted-foreground/70">
                {new Date(event.receivedAt).toLocaleTimeString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
