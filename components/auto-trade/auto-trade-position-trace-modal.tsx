"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, getPositionTrace } from "@/lib/api";
import type { AutoTradeEventRead, PositionTraceRead } from "@/lib/api/types";

type Props = {
  positionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// Auto-pause / kill-switch closes are the ones a trader most wants to spot.
function isSystemCloseReason(reason: string | null | undefined) {
  if (!reason) return false;
  const r = reason.toLowerCase();
  return (
    r.includes("kill_switch") || r.includes("auto_pause") || r.includes("risk")
  );
}

function levelTone(level: string) {
  const l = level.trim().toLowerCase();
  if (l === "error" || l === "critical") return "text-red-300";
  if (l === "warning" || l === "warn") return "text-amber-300";
  return "text-muted-foreground";
}

export function AutoTradePositionTraceModal({
  positionId,
  open,
  onOpenChange,
}: Props) {
  const [trace, setTrace] = useState<PositionTraceRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The parent mounts this only while ``open`` is true, so a fresh fetch per
  // open is correct and there is no stale state to reset.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        const next = await getPositionTrace(positionId);
        if (!cancelled) setTrace(next);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Failed to load trace.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, positionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Position #{positionId} — execution trace</DialogTitle>
          <DialogDescription>
            Signal → close timeline. Read-only; the AI decision-event id points
            into the analysis service and is shown, not dereferenced.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading trace...
          </p>
        ) : error ? (
          <p className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : trace === null ? (
          <p className="text-sm text-muted-foreground">No trace available.</p>
        ) : (
          <TraceBody trace={trace} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TraceBody({ trace }: { trace: PositionTraceRead }) {
  const events = trace.events ?? [];
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{trace.symbol}</span>
        <Badge variant="outline">{trace.side}</Badge>
        <Badge variant="outline">{trace.status}</Badge>
        <Badge variant="outline">state: {trace.state}</Badge>
        {trace.close_reason ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
              isSystemCloseReason(trace.close_reason)
                ? "bg-red-500/20 text-red-200"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {trace.close_reason}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        <Field label="Entry" value={formatPrice(trace.entry_price)} />
        <Field label="Close" value={formatPrice(trace.close_price)} />
        <Field label="Opened" value={formatDateTime(trace.opened_at)} />
        <Field label="Closed" value={formatDateTime(trace.closed_at)} />
      </div>

      {/* Linkage pointers — surfaced, not dereferenced. */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <LinkChip label="decision_event_id" value={trace.decision_event_id} />
        <LinkChip label="open_order" value={trace.open_order_id} />
        <LinkChip label="close_order" value={trace.close_order_id} />
        <LinkChip
          label="open_history"
          value={
            trace.open_history_id !== null &&
            trace.open_history_id !== undefined
              ? String(trace.open_history_id)
              : null
          }
        />
        <LinkChip
          label="close_history"
          value={
            trace.close_history_id !== null &&
            trace.close_history_id !== undefined
              ? String(trace.close_history_id)
              : null
          }
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Timeline ({events.length} event{events.length === 1 ? "" : "s"})
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded.</p>
        ) : (
          <ol className="space-y-2 border-l border-border/70 pl-3">
            {events.map((event: AutoTradeEventRead) => (
              <li key={event.id} className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </span>
                  <span className="font-mono">{event.event_type}</span>
                  <span className={`uppercase ${levelTone(event.level)}`}>
                    {event.level}
                  </span>
                </div>
                {event.message ? (
                  <p className="text-xs text-foreground">{event.message}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function LinkChip({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/40 px-1.5 py-0.5">
      <span className="uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-foreground">{value}</span>
    </span>
  );
}
