"use client";

import type { AccountTradeRead } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  trades: AccountTradeRead[];
  isLoading: boolean;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatNumber(value: number, digits = 4) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function sideTone(side: string) {
  const normalized = side.trim().toLowerCase();
  if (normalized === "buy") {
    return "font-medium text-emerald-300";
  }
  if (normalized === "sell") {
    return "font-medium text-red-300";
  }
  return "text-muted-foreground";
}

export function AutoTradeTradesTable({ trades, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return <p className="text-sm text-muted-foreground">No trades yet.</p>;
  }

  return (
    <div className="max-h-[380px] overflow-auto rounded-md border border-border/70">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-2 py-2 text-left">Time</th>
            <th className="px-2 py-2 text-left">Type</th>
            <th className="px-2 py-2 text-left">Side</th>
            <th className="px-2 py-2 text-left">Price</th>
            <th className="px-2 py-2 text-left">Amount</th>
            <th className="px-2 py-2 text-left">Fee</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={`${trade.exchange_trade_id}-${trade.timestamp}`}
              className="border-t border-border/60"
            >
              <td className="px-2 py-1.5">{formatDateTime(trade.timestamp)}</td>
              <td className="px-2 py-1.5">
                <Badge variant={trade.is_autotrade ? "default" : "outline"}>
                  {trade.is_autotrade ? "auto" : "manual"}
                </Badge>
              </td>
              <td className={`px-2 py-1.5 ${sideTone(trade.side)}`}>{trade.side}</td>
              <td className="px-2 py-1.5">{formatNumber(trade.price, 3)}</td>
              <td className="px-2 py-1.5">{formatNumber(trade.amount, 5)}</td>
              <td className="px-2 py-1.5">
                {formatNumber(trade.fee, 6)} {trade.fee_currency ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
