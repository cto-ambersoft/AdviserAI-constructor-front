"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Field, NumericField } from "@/components/trading/form-controls";
import type { KnifeStrategyFormState } from "@/components/trading/strategies/types";

type KnifeStrategyFormProps = {
  value: KnifeStrategyFormState;
  onChange: (next: KnifeStrategyFormState) => void;
  onRun: () => Promise<void>;
  sideOptions: string[];
  entryModeLongOptions: string[];
  entryModeShortOptions: string[];
  isRunning?: boolean;
  showRunButton?: boolean;
};

export function KnifeStrategyForm({
  value,
  onChange,
  onRun,
  sideOptions,
  entryModeLongOptions,
  entryModeShortOptions,
  isRunning = false,
  showRunButton = true,
}: KnifeStrategyFormProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-6">
        <Field
          label="Knife Side"
          value={value.side}
          options={sideOptions}
          onChange={(next) => onChange({ ...value, side: next })}
        />
        <Field
          label="Entry Mode Long"
          value={value.entry_mode_long}
          options={entryModeLongOptions}
          onChange={(next) => onChange({ ...value, entry_mode_long: next })}
        />
        <Field
          label="Entry Mode Short"
          value={value.entry_mode_short}
          options={entryModeShortOptions}
          onChange={(next) => onChange({ ...value, entry_mode_short: next })}
        />
        <NumericField
          label="Knife Move %"
          value={value.knife_move_pct}
          onChange={(next) => onChange({ ...value, knife_move_pct: next })}
        />
        <NumericField
          label="Entry K %"
          value={value.entry_k_pct}
          onChange={(next) => onChange({ ...value, entry_k_pct: next })}
        />
        <NumericField
          label="TP %"
          value={value.tp_pct}
          onChange={(next) => onChange({ ...value, tp_pct: next })}
        />
        <NumericField
          label="SL %"
          value={value.sl_pct}
          onChange={(next) => onChange({ ...value, sl_pct: next })}
        />
        {showRunButton ? (
          <div className="flex items-end">
            <Button onClick={() => void onRun()} disabled={isRunning}>
              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isRunning ? "Running..." : "Run Knife"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <NumericField
          label="Trades Limit"
          value={value.trades_limit}
          onChange={(next) => onChange({ ...value, trades_limit: next })}
        />
        <NumericField
          label="Account Balance"
          value={value.account_balance}
          onChange={(next) => onChange({ ...value, account_balance: next })}
        />
        <NumericField
          label="Max Range %"
          value={value.max_range_pct}
          onChange={(next) => onChange({ ...value, max_range_pct: next })}
        />
        <NumericField
          label="Max Wick Share %"
          value={value.max_wick_share_pct}
          onChange={(next) => onChange({ ...value, max_wick_share_pct: next })}
        />
        <NumericField
          label="Max Requotes"
          value={value.max_requotes}
          onChange={(next) => onChange({ ...value, max_requotes: next })}
        />
        <label className="flex items-center gap-2 pt-8 text-sm">
          <input
            type="checkbox"
            checked={value.include_series}
            onChange={(event) => onChange({ ...value, include_series: event.target.checked })}
          />
          include_series
        </label>
        <div className="space-y-2 pt-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.use_max_range_filter}
              onChange={(event) =>
                onChange({ ...value, use_max_range_filter: event.target.checked })
              }
            />
            use_max_range_filter
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.use_wick_filter}
              onChange={(event) => onChange({ ...value, use_wick_filter: event.target.checked })}
            />
            use_wick_filter
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.requote_each_candle}
              onChange={(event) =>
                onChange({ ...value, requote_each_candle: event.target.checked })
              }
            />
            requote_each_candle
          </label>
        </div>
      </div>
    </>
  );
}
