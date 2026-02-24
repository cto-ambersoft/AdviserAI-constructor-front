"use client";

import { Button } from "@/components/ui/button";
import { NumericField } from "@/components/trading/form-controls";
import type { GridStrategyFormState } from "@/components/trading/strategies/types";

type GridStrategyFormProps = {
  value: GridStrategyFormState;
  onChange: (next: GridStrategyFormState) => void;
  onRun: () => Promise<void>;
};

export function GridStrategyForm({ value, onChange, onRun }: GridStrategyFormProps) {
  return (
    <div className="grid gap-3 md:grid-cols-8">
      <NumericField
        label="Grid MA"
        value={value.ma_period}
        onChange={(next) => onChange({ ...value, ma_period: next })}
      />
      <NumericField
        label="Spacing %"
        value={value.grid_spacing_pct}
        onChange={(next) => onChange({ ...value, grid_spacing_pct: next })}
      />
      <NumericField
        label="Levels"
        value={value.grids_down}
        onChange={(next) => onChange({ ...value, grids_down: next })}
      />
      <NumericField
        label="Fee %"
        value={value.order_fee_pct}
        onChange={(next) => onChange({ ...value, order_fee_pct: next })}
      />
      <NumericField
        label="Allocation"
        value={value.allocation_usdt}
        onChange={(next) => onChange({ ...value, allocation_usdt: next })}
      />
      <NumericField
        label="Initial Capital"
        value={value.initial_capital_usdt}
        onChange={(next) => onChange({ ...value, initial_capital_usdt: next })}
      />
      <NumericField
        label="Order Size"
        value={value.order_size_usdt}
        onChange={(next) => onChange({ ...value, order_size_usdt: next })}
      />
      <label className="flex items-center gap-2 pt-7 text-sm">
        <input
          type="checkbox"
          checked={value.close_open_positions_on_eod}
          onChange={(event) =>
            onChange({ ...value, close_open_positions_on_eod: event.target.checked })
          }
        />
        Close EOD
      </label>
      <div className="flex items-end">
        <Button onClick={() => void onRun()}>Run Grid</Button>
      </div>
    </div>
  );
}
