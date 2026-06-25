"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { AccountTradesPnlRead } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";

type Props = {
  accountPnl: AccountTradesPnlRead | null;
  isLoading: boolean;
};

function isNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatSigned(value: number | null | undefined, digits = 2) {
  if (!isNum(value)) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function tone(value: number | null | undefined) {
  if (!isNum(value) || value === 0) {
    return "text-muted-foreground";
  }
  return value > 0 ? "font-medium text-emerald-300" : "font-medium text-red-300";
}

export function AutoTradePnlCards({ accountPnl, isLoading }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);

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

  // W9 — `realized` stays GROSS (Σ exchange realizedPnl). The net/commission/
  // funding breakdown is additive and only present when the backend supplies
  // `net_pnl_usdt` (null on the fallback path with no synced ledger fills), so
  // gate the net view on it and otherwise fall back to the legacy gross number.
  const realizedGross = accountPnl?.gross_realized_usdt ?? accountPnl?.realized ?? null;
  const commission = accountPnl?.commission_usdt ?? null;
  const funding = accountPnl?.funding_usdt ?? null;
  const net = accountPnl?.net_pnl_usdt ?? null;
  const unrealized = accountPnl?.unrealized ?? null;

  const hasBreakdown = isNum(net);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {hasBreakdown ? (
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle
              className="cursor-help text-sm font-medium text-muted-foreground"
              title="Net realized P&L on closed parts = gross realized − commission + funding (Binance income convention)."
            >
              Net PnL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl ${tone(net)}`}>{formatSigned(net)}</p>
            <button
              type="button"
              onClick={() => setShowBreakdown((open) => !open)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              aria-expanded={showBreakdown}
            >
              {showBreakdown ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Breakdown
            </button>
            {showBreakdown ? (
              <dl className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs">
                <BreakdownRow
                  label="Realized"
                  title="Price PnL of closed parts (exchange realizedPnl), before fees and funding."
                  value={formatSigned(realizedGross)}
                  valueClass={tone(realizedGross)}
                />
                <BreakdownRow
                  label="Commission"
                  title="Trading commissions in USDT (incl. BNB at mark price), always ≥ 0."
                  value={isNum(commission) ? `-${Math.abs(commission).toFixed(2)}` : "-"}
                  valueClass={
                    isNum(commission) && commission !== 0
                      ? "font-medium text-red-300"
                      : "text-muted-foreground"
                  }
                />
                {/* W9 §9.1 — funding is always shown (even 0.00) so the row
                    does not jump in/out between refreshes. */}
                <BreakdownRow
                  label="Funding"
                  title="Funding over the holding window. Negative = paid, positive = received."
                  value={formatSigned(funding)}
                  valueClass={tone(funding)}
                />
              </dl>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <MetricCard
          title="Realized PnL"
          value={formatSigned(realizedGross)}
          valueClass={tone(realizedGross)}
        />
      )}
      <MetricCard
        title="Unrealized PnL"
        value={formatSigned(unrealized)}
        valueClass={tone(unrealized)}
      />
    </div>
  );
}

function BreakdownRow({
  label,
  title,
  value,
  valueClass,
}: {
  label: string;
  title: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt
        className="cursor-help text-muted-foreground underline decoration-dotted underline-offset-2"
        title={title}
      >
        {label}
      </dt>
      <dd className={valueClass ?? "text-muted-foreground"}>{value}</dd>
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
