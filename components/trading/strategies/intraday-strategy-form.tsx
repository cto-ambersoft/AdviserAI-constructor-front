"use client";

import { Button } from "@/components/ui/button";
import { Field, NumericField } from "@/components/trading/form-controls";
import type { IntradayStrategyFormState } from "@/components/trading/strategies/types";

type IntradayStrategyFormProps = {
  value: IntradayStrategyFormState;
  onChange: (next: IntradayStrategyFormState) => void;
  onRun: () => Promise<void>;
  sideOptions: string[];
};

export function IntradayStrategyForm({
  value,
  onChange,
  onRun,
  sideOptions,
}: IntradayStrategyFormProps) {
  return (
    <div className="grid gap-3 md:grid-cols-8">
      <Field
        label="Momentum Side"
        value={value.side}
        options={sideOptions}
        onChange={(next) => onChange({ ...value, side: next })}
      />
      <NumericField
        label="Lookback"
        value={value.lookback}
        onChange={(next) => onChange({ ...value, lookback: next })}
      />
      <NumericField
        label="ATR Mult"
        value={value.atr_mult}
        onChange={(next) => onChange({ ...value, atr_mult: next })}
      />
      <NumericField
        label="RR"
        value={value.rr}
        onChange={(next) => onChange({ ...value, rr: next })}
      />
      <NumericField
        label="Vol Mult"
        value={value.vol_mult}
        onChange={(next) => onChange({ ...value, vol_mult: next })}
      />
      <NumericField
        label="Time Exit"
        value={value.time_exit_bars}
        onChange={(next) => onChange({ ...value, time_exit_bars: next })}
      />
      <NumericField
        label="Entry Size"
        value={value.entry_size_usdt}
        onChange={(next) => onChange({ ...value, entry_size_usdt: next })}
      />
      <div className="flex items-end">
        <Button onClick={() => void onRun()}>Run Momentum</Button>
      </div>
    </div>
  );
}
