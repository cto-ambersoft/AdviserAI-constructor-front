"use client";

import { useEffect } from "react";

import { useRiskEventsStore } from "@/stores/risk-events-store";

/**
 * Opens the single per-tab SSE connection for risk/governance events while the
 * authenticated app is mounted, and closes it on unmount. Side-effect only —
 * renders nothing. Consumers read events via `useRiskEventsStore`. — F5.
 */
export function RiskEventsProvider() {
  const connect = useRiskEventsStore((state) => state.connect);
  const disconnect = useRiskEventsStore((state) => state.disconnect);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return null;
}
