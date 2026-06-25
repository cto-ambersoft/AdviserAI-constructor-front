"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AutoTradePositionWithPnlRead } from "@/lib/api/types";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";

type Props = {
  positions: AutoTradePositionWithPnlRead[];
  isLoading: boolean;
  /** Open the post-trade trace drawer for a position id. */
  onTrace: (positionId: number) => void;
};

function formatPnl(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function pnlTone(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-foreground";
  }
  return value > 0 ? "text-emerald-300" : "text-red-300";
}

function statusTone(status: string) {
  const s = status.trim().toLowerCase();
  if (s === "open") return "bg-emerald-500/20 text-emerald-200";
  if (s === "error") return "bg-red-500/20 text-red-200";
  return "bg-muted text-muted-foreground";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AutoTradePositionsCard({ positions, isLoading, onTrace }: Props) {
  return (
    <Card className={CARD_CLASS}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Positions</CardTitle>
          {isLoading ? (
            <Badge variant="outline" className="text-xs">
              Loading...
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && positions.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions yet.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-md border border-border/70">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-2 text-left">Symbol</th>
                  <th className="px-2 py-2 text-left">Side</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">PnL (USDT)</th>
                  <th className="px-2 py-2 text-left">Opened</th>
                  <th className="px-2 py-2 text-right">Trace</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((item) => {
                  const pnl = item.pnl.total_pnl_usdt ?? item.pnl.net_pnl_usdt;
                  return (
                    <tr
                      key={item.position.id}
                      className="border-t border-border/60"
                    >
                      <td className="px-2 py-1.5">{item.pnl.symbol}</td>
                      <td className="px-2 py-1.5">{item.pnl.side}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${statusTone(item.pnl.status)}`}
                        >
                          {item.pnl.status}
                        </span>
                      </td>
                      <td className={`px-2 py-1.5 ${pnlTone(pnl)}`}>
                        {formatPnl(pnl)}
                      </td>
                      <td className="px-2 py-1.5">
                        {formatDateTime(item.position.opened_at)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onTrace(item.position.id)}
                        >
                          Trace
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
