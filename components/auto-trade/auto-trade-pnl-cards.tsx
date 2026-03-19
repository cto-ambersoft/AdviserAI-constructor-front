"use client";

import type {
  AccountTradesPnlRead,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";

type Props = {
  accountPnl: AccountTradesPnlRead | null;
  isLoading: boolean;
};

function formatSigned(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function tone(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-muted-foreground";
  }
  return value > 0 ? "font-medium text-emerald-300" : "font-medium text-red-300";
}

export function AutoTradePnlCards({
  accountPnl,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const realized = accountPnl?.realized ?? null;
  const unrealized = accountPnl?.unrealized ?? null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MetricCard
        title="Realized PnL"
        value={formatSigned(realized)}
        valueClass={tone(realized)}
      />
      <MetricCard
        title="Unrealized PnL"
        value={formatSigned(unrealized)}
        valueClass={tone(unrealized)}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  valueClass,
}: {
  title: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-xl ${valueClass ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
