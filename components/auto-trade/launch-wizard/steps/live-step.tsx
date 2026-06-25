import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Step 6 — promote the sandbox strategy to live. The promote call is step-up
 * (2FA) gated transparently by the API client (UX overhaul T10).
 */
export function LiveStep({
  canPromote,
  isPromoting,
  promoted,
  onPromote,
}: {
  canPromote: boolean;
  isPromoting: boolean;
  promoted: boolean;
  onPromote: () => void;
}) {
  if (promoted) {
    return (
      <div className="inline-flex items-center gap-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        Promoted to live. The strategy now trades for real.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Promote the strategy to live trading.
      </p>

      <Button onClick={onPromote} disabled={!canPromote || isPromoting}>
        {isPromoting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Promoting…
          </>
        ) : (
          "Promote to live"
        )}
      </Button>

      {!canPromote ? (
        <p className="text-xs text-muted-foreground">
          The KPI gate is not passed yet — complete it before going live.
        </p>
      ) : null}
    </div>
  );
}
