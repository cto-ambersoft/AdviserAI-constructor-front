"use client";

import { useEffect, useState } from "react";

import { getHealthStatus } from "@/lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { deriveHealthTone, HEALTH_LABEL, type HealthTone } from "@/lib/health";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 30_000;

const TONE_STYLES: Record<HealthTone, { dot: string; pill: string; text: string }> = {
  ok: {
    dot: "status-dot-pulse bg-[#00FFA3]",
    pill: "border-[#00FFA3]/35 bg-[#00FFA3]/10 text-[#00FFA3]",
    text: "text-[#00FFA3]",
  },
  warn: {
    dot: "bg-amber-400",
    pill: "border-amber-400/35 bg-amber-400/10 text-amber-300",
    text: "text-amber-300",
  },
  error: {
    dot: "bg-destructive",
    pill: "border-destructive/35 bg-destructive/10 text-destructive",
    text: "text-destructive",
  },
};

/**
 * Compact API health indicator in the header (UX overhaul T4). Polls the
 * backend health endpoint, shows a tri-state coloured pill, and reveals the
 * raw status + last-checked time in a popover on click. Replaces the old fixed
 * status footer.
 */
export function StatusIndicator() {
  const [rawStatus, setRawStatus] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await getHealthStatus();
        if (!mounted) return;
        setRawStatus(typeof data.status === "string" ? data.status : null);
      } catch {
        if (!mounted) return;
        setRawStatus(null);
      } finally {
        if (mounted) {
          setCheckedAt(new Date().toLocaleTimeString());
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const tone = deriveHealthTone(rawStatus);
  const styles = TONE_STYLES[tone];
  const label = HEALTH_LABEL[tone];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`API status: ${label}`}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1 text-[11px] font-medium tracking-[0.04em] transition-colors",
            styles.pill,
          )}
        >
          <span
            className={cn("h-2 w-2 rounded-full", styles.dot)}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              API health
            </span>
            <span className={cn("text-xs font-medium", styles.text)}>{label}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Status: {rawStatus ?? "unreachable"}
          </p>
          <p className="text-xs text-muted-foreground">
            Last checked: {checkedAt ?? "—"}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
