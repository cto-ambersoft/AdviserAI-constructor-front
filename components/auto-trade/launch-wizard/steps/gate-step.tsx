import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PromotionGatePanel } from "@/components/monitor/promotion-gate-panel";
import { remainingTrades } from "@/lib/auto-trade/promotion";
import type { PromotionStatusRead } from "@/lib/api/types";

/**
 * Step 5 — show the sandbox→live KPI gate readiness, including how many more
 * closed trades are still needed (UX overhaul T10).
 */
export function GateStep({
  promotion,
  isLoading,
  onRefresh,
}: {
  promotion: PromotionStatusRead | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const remaining = remainingTrades(promotion);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The strategy must pass every criterion before it can trade live.
      </p>

      <PromotionGatePanel promotion={promotion} isLoading={isLoading} />

      {remaining !== null && remaining > 0 ? (
        <p className="text-xs text-amber-300">
          ~{remaining} more closed trade{remaining === 1 ? "" : "s"} needed to
          pass the sample-size gate.
        </p>
      ) : null}

      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Refresh
      </Button>
    </div>
  );
}
