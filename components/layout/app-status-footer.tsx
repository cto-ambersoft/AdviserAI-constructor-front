"use client";

import { useEffect, useMemo, useState } from "react";
import { getHealthStatus } from "@/lib/api";

const POLL_INTERVAL_MS = 30_000;

export function AppStatusFooter() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHealth = async () => {
      try {
        const data = await getHealthStatus();
        if (!isMounted) {
          return;
        }
        setStatus(typeof data.status === "string" ? data.status : null);
      } catch {
        if (!isMounted) {
          return;
        }
        setStatus(null);
      }
    };

    void loadHealth();
    const interval = window.setInterval(() => {
      void loadHealth();
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const isApiOk = useMemo(() => status?.toLowerCase() === "ok", [status]);
  const statusLabel = isApiOk ? "Connection is stable" : "disconnected";

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border/90 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-8 w-full max-w-[1600px] items-center justify-end px-3 md:px-6">
        <div
          className={`inline-flex items-center gap-2 rounded-sm border px-2 py-0.5 text-[11px] font-medium tracking-[0.04em] backdrop-blur ${
            isApiOk
              ? "border-[#00FFA3]/35 bg-[#00FFA3]/10 text-[#00FFA3]"
              : "border-destructive/35 bg-destructive/10 text-destructive"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isApiOk ? "status-dot-pulse bg-[#00FFA3]" : "bg-destructive"
            }`}
            aria-hidden="true"
          />
          <span>{statusLabel}</span>
        </div>
      </div>
    </footer>
  );
}
