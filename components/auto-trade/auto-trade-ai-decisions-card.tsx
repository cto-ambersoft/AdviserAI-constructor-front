"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, ChevronRight, RefreshCw, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AutoTradeEventRead } from "@/lib/api/types";
import {
  listDecisionEvents,
  normaliseReasoningEntry,
  type AiDecisionEvent,
  type AiReasoningEntry,
} from "@/lib/api/services/ai-decision-events";
import { formatDateTime } from "@/components/auto-trade/utils";

const OVERLAY_EVENT_PREFIX = "ai_overlay_";

type Props = {
  /** Live audit events already fetched by the dashboard. */
  events: AutoTradeEventRead[];
  /** Symbol scope for the decision-events query (e.g. "BTCUSDT"). */
  symbol?: string | null;
};

type ReasoningCompact = {
  agent_key?: string;
  signal?: string;
  confidence?: number;
  weight?: number;
  summary?: string;
};

type OverlayPayload = {
  overlay_event: string;
  reason?: string;
  ai_trend?: {
    direction?: string;
    strength?: number;
    occurred_at?: string;
    decision_event_id?: string;
  };
  reasoning_path?: ReasoningCompact[];
  before?: unknown;
  after?: unknown;
};

function isOverlayEvent(event: AutoTradeEventRead): boolean {
  return event.event_type.startsWith(OVERLAY_EVENT_PREFIX);
}

function getOverlayPayload(event: AutoTradeEventRead): OverlayPayload | null {
  if (!event.payload || typeof event.payload !== "object") {
    return null;
  }
  return event.payload as OverlayPayload;
}

function directionBadgeVariant(direction?: string): "default" | "destructive" | "outline" | "secondary" {
  if (direction === "up") return "default";
  if (direction === "down") return "destructive";
  return "outline";
}

function ReasoningPathList({
  entries,
  emptyHint,
}: {
  entries: AiReasoningEntry[] | ReasoningCompact[] | undefined;
  emptyHint?: string;
}) {
  if (!entries || entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {emptyHint ?? "No per-agent reasoning available."}
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {entries.map((entry, index) => {
        const normalised =
          "agentKey" in entry || "agent_key" in entry
            ? normaliseReasoningEntry(entry as AiReasoningEntry)
            : { agentKey: "unknown", ...entry };
        const signal = (normalised as AiReasoningEntry).signal ?? "—";
        const confidence = (normalised as AiReasoningEntry).confidence;
        const weight = (normalised as AiReasoningEntry).weight;
        const summary = (normalised as AiReasoningEntry).summary;
        return (
          <li
            key={`${normalised.agentKey}-${index}`}
            className="rounded border border-border/50 bg-card/40 px-2 py-1 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{normalised.agentKey}</span>
              <Badge variant={directionBadgeVariant(signal)} className="text-[10px]">
                {String(signal).toUpperCase()}
              </Badge>
              {typeof confidence === "number" ? (
                <span className="text-muted-foreground">
                  conf {confidence.toFixed(2)}
                </span>
              ) : null}
              {typeof weight === "number" ? (
                <span className="text-muted-foreground">
                  w {weight.toFixed(2)}
                </span>
              ) : null}
            </div>
            {summary ? (
              <p className="mt-1 text-muted-foreground">{summary}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function OverlayEventRow({ event }: { event: AutoTradeEventRead }) {
  const [expanded, setExpanded] = useState(false);
  const payload = getOverlayPayload(event);
  const direction = payload?.ai_trend?.direction;
  const strength = payload?.ai_trend?.strength;
  const decisionEventId = payload?.ai_trend?.decision_event_id;

  return (
    <li className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-start gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              {formatDateTime(event.created_at)}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {event.event_type.replace(OVERLAY_EVENT_PREFIX, "")}
            </Badge>
            {direction ? (
              <Badge variant={directionBadgeVariant(direction)} className="text-[10px]">
                ai_trend {direction.toUpperCase()}
                {typeof strength === "number" ? ` (${strength.toFixed(2)})` : ""}
              </Badge>
            ) : null}
            {payload?.reason ? (
              <span className="text-muted-foreground">{payload.reason}</span>
            ) : null}
          </div>
          {!expanded && event.message ? (
            <p className="mt-0.5 truncate text-muted-foreground">
              {event.message}
            </p>
          ) : null}
        </div>
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2 border-t border-border/40 pt-2">
          {decisionEventId ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              decision_event_id: {decisionEventId}
            </p>
          ) : null}
          {payload?.before !== undefined || payload?.after !== undefined ? (
            <p className="text-muted-foreground">
              {payload?.before !== undefined ? `before ${JSON.stringify(payload.before)}` : ""}
              {payload?.before !== undefined && payload?.after !== undefined ? "  →  " : ""}
              {payload?.after !== undefined ? `after ${JSON.stringify(payload.after)}` : ""}
            </p>
          ) : null}
          <ReasoningPathList
            entries={payload?.reasoning_path}
            emptyHint="Reasoning path was not denormalised for this event."
          />
        </div>
      ) : null}
    </li>
  );
}

function DecisionEventRow({ event }: { event: AiDecisionEvent }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-start gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              {formatDateTime(event.occurredAt)}
            </span>
            <span className="font-medium">{event.symbol}</span>
            <Badge
              variant={directionBadgeVariant(event.aiTrend.direction)}
              className="text-[10px]"
            >
              {event.aiTrend.direction.toUpperCase()}
              {" "}
              ({event.aiTrend.strength.toFixed(2)})
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            evt {event.eventId.slice(0, 16)}
            {event.eventId.length > 16 ? "…" : ""}
          </p>
        </div>
      </button>
      {expanded ? (
        <div className="mt-2 border-t border-border/40 pt-2">
          <ReasoningPathList entries={event.perAgent} />
        </div>
      ) : null}
    </li>
  );
}

export function AutoTradeAiDecisionsCard({ events, symbol }: Props) {
  const overlayEvents = useMemo(
    () => events.filter(isOverlayEvent).slice(0, 25),
    [events],
  );

  const [decisionEvents, setDecisionEvents] = useState<AiDecisionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!symbol) {
      setDecisionEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await listDecisionEvents({ symbol, limit: 10 });
      setDecisionEvents(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-300" />
            <CardTitle>AI Decisions</CardTitle>
            {symbol ? (
              <Badge variant="outline" className="text-[10px]">
                {symbol}
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void reload()}
            disabled={loading || !symbol}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="space-y-2">
          <header className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Latest decision events from core
          </header>
          {error ? (
            <p className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {!symbol ? (
            <p className="text-xs text-muted-foreground">
              Select an auto-trade scope with a profile symbol to load
              decision events.
            </p>
          ) : decisionEvents.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground">
              No decision events yet for this symbol.
            </p>
          ) : (
            <ul className="space-y-1">
              {decisionEvents.map((event) => (
                <DecisionEventRow key={event.eventId} event={event} />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <header className="text-xs font-medium text-muted-foreground">
            Recent overlay actions (live)
          </header>
          {overlayEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No overlay actions recorded yet. Enable the AI Trend Overlay
              section in the auto-trade form to start producing entries here.
            </p>
          ) : (
            <ul className="space-y-1">
              {overlayEvents.map((event) => (
                <OverlayEventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
