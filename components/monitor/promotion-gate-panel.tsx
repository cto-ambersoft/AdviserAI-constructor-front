import { Skeleton } from "@/components/ui/skeleton";
import { formatNum } from "@/components/monitor/kpi-format";
import type { PromotionStatusRead } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Props = {
  promotion: PromotionStatusRead | null;
  isLoading: boolean;
};

/**
 * B5 (W10) — promotion KPI-gate readiness drill-down: per-criterion
 * actual/threshold + pass/fail, sandbox tenure, and a ready/not-ready verdict.
 * Pure presentation; the dashboard owns fetching/caching the status.
 */
export function PromotionGatePanel({ promotion, isLoading }: Props) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
      {isLoading && !promotion ? (
        <Skeleton className="h-4 w-48" />
      ) : !promotion ? (
        <p className="text-xs text-muted-foreground">
          Promotion status unavailable.
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              KPI gate · {formatNum(promotion.sandbox_days, 1)}d in sandbox
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                promotion.can_promote ? "text-emerald-300" : "text-amber-300",
              )}
            >
              {promotion.can_promote ? "Ready to promote" : "Not ready"}
            </span>
          </div>
          <ul className="space-y-1">
            {promotion.criteria.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted-foreground">
                  {c.passed ? "✓" : "✗"} {c.name.replace(/_/g, " ")}
                </span>
                <span className={cn(c.passed ? "text-emerald-300" : "text-red-300")}>
                  {formatNum(c.actual, 1)} / {formatNum(c.threshold, 1)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Promotion to live requires every criterion to pass + 2FA step-up.
          </p>
        </div>
      )}
    </div>
  );
}
