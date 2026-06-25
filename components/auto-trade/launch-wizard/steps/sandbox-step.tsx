import { useState, type Dispatch } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  WizardAction,
  WizardData,
} from "@/components/auto-trade/launch-wizard/state";
import {
  ApiError,
  playAutoTrade,
  upsertAutoTradeConfig,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notifications";

/**
 * Step 4 — create the auto-trade config and start it in sandbox (UX overhaul
 * T9). Sandbox is where the strategy earns the KPI gate before going live.
 */
export function SandboxStep({
  data,
  dispatch,
}: {
  data: WizardData;
  dispatch: Dispatch<WizardAction>;
}) {
  const [isStarting, setIsStarting] = useState(false);
  const started = data.configId != null;

  const start = async () => {
    if (data.profileId == null || data.accountId == null || !data.positionSizeUsdt) {
      notifyError("Strategy, account and size are required.");
      return;
    }
    setIsStarting(true);
    try {
      const config = await upsertAutoTradeConfig({
        enabled: true,
        profile_id: data.profileId,
        account_id: data.accountId,
        position_size_usdt: data.positionSizeUsdt,
        // Conservative starter defaults — fine-tuning happens on the dashboard.
        leverage: 1,
        min_confidence_pct: 62,
        fast_close_confidence_pct: 80,
        confirm_reports_required: 2,
        risk_mode: "1:2",
        sl_pct: 1,
        tp_pct: 2,
        ...(data.strategyName ? { strategy_name: data.strategyName } : {}),
      });
      await playAutoTrade({ account_id: data.accountId });
      dispatch({ type: "set", patch: { configId: config.id } });
      notifySuccess("Strategy started in sandbox.");
    } catch (error) {
      notifyError(
        error instanceof ApiError && error.message
          ? error.message
          : "Failed to start sandbox.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Start the strategy in{" "}
        <span className="font-medium text-foreground">sandbox</span>.
      </p>

      {started ? (
        <div className="inline-flex items-center gap-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Running in sandbox.
        </div>
      ) : (
        <Button onClick={() => void start()} disabled={isStarting}>
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            "Start in sandbox"
          )}
        </Button>
      )}
    </div>
  );
}
