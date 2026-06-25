"use client";

import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutoTradeAiOverlaySection } from "@/components/auto-trade/auto-trade-ai-overlay-section";
import { AutoTradeRiskGovernanceSection } from "@/components/auto-trade/auto-trade-risk-section";
import { AutoTradeStrategyProfileSection } from "@/components/auto-trade/auto-trade-strategy-profile-section";
import type { AutoTradeFormState } from "@/components/auto-trade/types";
import { isSupportedAutoTradeExchange } from "@/components/auto-trade/utils";
import type {
  ExchangeAccountRead,
  PersonalAnalysisProfileRead,
  StrategyRead,
} from "@/lib/api";

type Props = {
  form: AutoTradeFormState;
  profiles: PersonalAnalysisProfileRead[];
  accounts: ExchangeAccountRead[];
  strategies: StrategyRead[];
  isStrategiesLoading?: boolean;
  isBusy?: boolean;
  validationMessage: string;
  onChange: (updater: (prev: AutoTradeFormState) => AutoTradeFormState) => void;
  onSubmit: () => void;
};

export function AutoTradeConfigForm({
  form,
  profiles,
  accounts,
  strategies,
  isStrategiesLoading = false,
  isBusy = false,
  validationMessage,
  onChange,
  onSubmit,
}: Props) {
  const selectedAccount =
    accounts.find((account) => account.id === form.account_id) ?? null;
  const isOkxSelected =
    selectedAccount?.exchange_name.trim().toLowerCase() === "okx";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 pt-7 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, enabled: event.target.checked }))
            }
          />
          Enabled
        </label>

        <div className="space-y-1">
          <Label text="Signal source" />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={form.signal_source === "analysis" ? "default" : "outline"}
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  signal_source: "analysis",
                  strategy_id: null,
                }))
              }
            >
              Analysis
            </Button>
            <Button
              type="button"
              variant={
                form.signal_source === "strategy_atr_block" ? "default" : "outline"
              }
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  signal_source: "strategy_atr_block",
                }))
              }
            >
              ATR Strategy
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label text="Profile" />
          <select
            className={INPUT_CLASS}
            value={form.profile_id ?? ""}
            onChange={(event) =>
              onChange((prev) => ({
                ...prev,
                profile_id: event.target.value ? Number(event.target.value) : null,
              }))
            }
          >
            <option value="">Select profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                #{profile.id} {profile.symbol} {profile.is_active ? "" : "(inactive)"}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label text="Exchange account" />
          <select
            className={INPUT_CLASS}
            value={form.account_id ?? ""}
            onChange={(event) =>
              onChange((prev) => ({
                ...prev,
                account_id: event.target.value ? Number(event.target.value) : null,
              }))
            }
          >
            <option value="">Select account</option>
            {accounts.map((account) => {
              const isSupported = isSupportedAutoTradeExchange(account);
              const statusSuffix = isSupported ? "" : " (unsupported)";
              return (
                <option key={account.id} value={account.id}>
                  {account.account_label} / {account.exchange_name} / {account.mode}
                  {statusSuffix}
                </option>
              );
            })}
          </select>
        </div>

        <div className="space-y-1">
          <Label text="Strategy name (optional)" />
          <input
            type="text"
            className={INPUT_CLASS}
            value={form.strategy_name ?? ""}
            maxLength={64}
            placeholder="e.g. BTC-VWAP-Asia"
            onChange={(event) =>
              onChange((prev) => ({
                ...prev,
                strategy_name: event.target.value.length > 0 ? event.target.value : null,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Shown in the multi-strategy switcher. Defaults to the profile symbol.
          </p>
        </div>

        <div className="space-y-1">
          <Label text="Attached forecast (optional)" />
          <input
            type="text"
            className={INPUT_CLASS}
            value={form.attached_forecast_id ?? ""}
            maxLength={64}
            placeholder="forecastId from the AI Forecast Catalogue"
            onChange={(event) =>
              onChange((prev) => ({
                ...prev,
                attached_forecast_id:
                  event.target.value.length > 0 ? event.target.value : null,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Links this live strategy to a validated catalogue forecast (provenance).
          </p>
        </div>

        <NumberInput
          label="Position size USDT"
          value={form.position_size_usdt}
          min={0.0001}
          step={0.01}
          onChange={(value) =>
            onChange((prev) => ({ ...prev, position_size_usdt: value }))
          }
        />

        <NumberInput
          label="Leverage"
          value={form.leverage}
          min={1}
          max={125}
          step={1}
          onChange={(value) => onChange((prev) => ({ ...prev, leverage: value }))}
        />

        <NumberInput
          label="Min confidence %"
          value={form.min_confidence_pct}
          min={0}
          max={100}
          step={0.1}
          onChange={(value) =>
            onChange((prev) => ({ ...prev, min_confidence_pct: value }))
          }
        />

        <NumberInput
          label="Fast close confidence %"
          value={form.fast_close_confidence_pct}
          min={0}
          max={100}
          step={0.1}
          onChange={(value) =>
            onChange((prev) => ({ ...prev, fast_close_confidence_pct: value }))
          }
        />

        <NumberInput
          label="Confirm reports required"
          value={form.confirm_reports_required}
          min={1}
          max={5}
          step={1}
          integer
          onChange={(value) =>
            onChange((prev) => ({ ...prev, confirm_reports_required: value }))
          }
        />

        <div className="space-y-1">
          <Label text='Risk mode ("1:X")' />
          <input
            className={INPUT_CLASS}
            value={form.risk_mode}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, risk_mode: event.target.value }))
            }
            placeholder="1:2"
          />
        </div>

        <NumberInput
          label="SL %"
          value={form.sl_pct}
          min={0.0001}
          step={0.01}
          onChange={(value) => onChange((prev) => ({ ...prev, sl_pct: value }))}
        />

        <NumberInput
          label="TP %"
          value={form.tp_pct}
          min={0.0001}
          step={0.01}
          onChange={(value) => onChange((prev) => ({ ...prev, tp_pct: value }))}
        />

        {form.signal_source === "strategy_atr_block" ? (
          <>
            <div className="space-y-1">
              <Label text="ATR strategy" />
              <select
                className={INPUT_CLASS}
                value={form.strategy_id ?? ""}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    strategy_id: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                disabled={isStrategiesLoading}
              >
                <option value="">
                  {isStrategiesLoading ? "Loading strategies..." : "Select strategy"}
                </option>
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    #{strategy.id} {strategy.name} {strategy.is_active ? "" : "(inactive)"}
                  </option>
                ))}
              </select>
            </div>

            <NumberInput
              label="Timeframe bars"
              value={form.bars}
              min={100}
              max={20000}
              step={1}
              integer
              onChange={(value) => onChange((prev) => ({ ...prev, bars: value }))}
            />

            <NumberInput
              label="Poll interval seconds"
              value={form.poll_interval_seconds}
              min={15}
              max={3600}
              step={1}
              integer
              onChange={(value) =>
                onChange((prev) => ({ ...prev, poll_interval_seconds: value }))
              }
            />

            <div className="space-y-1">
              <Label text="Timeframe" />
              <input
                className={INPUT_CLASS}
                value={form.timeframe}
                onChange={(event) =>
                  onChange((prev) => ({ ...prev, timeframe: event.target.value }))
                }
                placeholder="1h"
              />
            </div>

            <OptionalNumberInput
              label="Override ema_period"
              value={form.strategy_overrides.ema_period}
              min={1}
              step={1}
              integer
              onChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  strategy_overrides: { ...prev.strategy_overrides, ema_period: value },
                }))
              }
            />

            <OptionalNumberInput
              label="Override atr_period"
              value={form.strategy_overrides.atr_period}
              min={1}
              step={1}
              integer
              onChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  strategy_overrides: { ...prev.strategy_overrides, atr_period: value },
                }))
              }
            />

            <OptionalNumberInput
              label="Override impulse_atr"
              value={form.strategy_overrides.impulse_atr}
              min={0.000001}
              step={0.01}
              onChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  strategy_overrides: { ...prev.strategy_overrides, impulse_atr: value },
                }))
              }
            />

            <OptionalNumberInput
              label="Override ob_buffer_atr"
              value={form.strategy_overrides.ob_buffer_atr}
              min={0.000001}
              step={0.01}
              onChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  strategy_overrides: { ...prev.strategy_overrides, ob_buffer_atr: value },
                }))
              }
            />
          </>
        ) : null}
      </div>

      <AutoTradeStrategyProfileSection
        profile={form.strategy_profile}
        onChange={(updater) =>
          onChange((prev) => ({
            ...prev,
            strategy_profile: updater(prev.strategy_profile),
          }))
        }
      />

      <AutoTradeRiskGovernanceSection
        value={form.risk}
        onChange={(updater) =>
          onChange((prev) => ({ ...prev, risk: updater(prev.risk) }))
        }
      />

      <AutoTradeAiOverlaySection
        accountId={form.account_id ?? undefined}
      />

      {isOkxSelected ? (
        <p className="rounded-md border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          `okx` is currently not supported for auto-trade futures. Save is blocked
          to avoid backend `422`.
        </p>
      ) : null}

      {validationMessage ? (
        <p className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-destructive">
          {validationMessage}
        </p>
      ) : (
        <Badge variant="outline" className="border-emerald-400/45 text-emerald-300">
          Validation passed
        </Badge>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={onSubmit} disabled={isBusy || Boolean(validationMessage) || isOkxSelected}>
          {isBusy ? "Saving..." : "Save config"}
        </Button>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  integer = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label text={label} />
      <input
        className={INPUT_CLASS}
        type="number"
        value={String(value)}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) {
            onChange(integer ? Math.round(parsed) : parsed);
          }
        }}
      />
    </div>
  );
}

function OptionalNumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  integer = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label text={label} />
      <input
        className={INPUT_CLASS}
        type="number"
        value={value === null ? "" : String(value)}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = event.target.value.trim();
          if (!nextValue) {
            onChange(null);
            return;
          }
          const parsed = Number(nextValue);
          if (Number.isFinite(parsed)) {
            onChange(integer ? Math.round(parsed) : parsed);
          }
        }}
      />
    </div>
  );
}
