"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { NumericField } from "@/components/trading/form-controls";
import type { AtrStrategyFormState } from "@/components/trading/strategies/types";

type AtrStrategyFormProps = {
  value: AtrStrategyFormState;
  onChange: (next: AtrStrategyFormState) => void;
  onRun: () => Promise<void>;
  isRunning?: boolean;
  showRunButton?: boolean;
};

export function AtrStrategyForm({
  value,
  onChange,
  onRun,
  isRunning = false,
  showRunButton = true,
}: AtrStrategyFormProps) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      <NumericField
        label="ATR EMA"
        value={value.ema_period}
        onChange={(next) => onChange({ ...value, ema_period: next })}
      />
      <NumericField
        label="ATR Period"
        value={value.atr_period}
        onChange={(next) => onChange({ ...value, atr_period: next })}
      />
      <NumericField
        label="Impulse ATR"
        value={value.impulse_atr}
        onChange={(next) => onChange({ ...value, impulse_atr: next })}
      />
      <NumericField
        label="OB Buffer ATR"
        value={value.ob_buffer_atr}
        onChange={(next) => onChange({ ...value, ob_buffer_atr: next })}
      />
      <NumericField
        label="Allocation"
        value={value.allocation_usdt}
        onChange={(next) => onChange({ ...value, allocation_usdt: next })}
      />
      <label className="flex items-center gap-2 pt-7 text-sm">
        <input
          type="checkbox"
          checked={value.one_trade_per_ob}
          onChange={(event) => onChange({ ...value, one_trade_per_ob: event.target.checked })}
        />
        One trade per OB
      </label>
      {showRunButton ? (
        <div className="flex items-end">
          <Button onClick={() => void onRun()} disabled={isRunning}>
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isRunning ? "Running..." : "Run ATR OB"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
