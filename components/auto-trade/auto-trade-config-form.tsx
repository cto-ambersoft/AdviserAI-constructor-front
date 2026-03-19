"use client";

import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AutoTradeFormState } from "@/components/auto-trade/types";
import { isSupportedAutoTradeExchange } from "@/components/auto-trade/utils";
import type { ExchangeAccountRead, PersonalAnalysisProfileRead } from "@/lib/api";

type Props = {
  form: AutoTradeFormState;
  profiles: PersonalAnalysisProfileRead[];
  accounts: ExchangeAccountRead[];
  isBusy?: boolean;
  validationMessage: string;
  onChange: (updater: (prev: AutoTradeFormState) => AutoTradeFormState) => void;
  onSubmit: () => void;
};

export function AutoTradeConfigForm({
  form,
  profiles,
  accounts,
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
      </div>

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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
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
            onChange(parsed);
          }
        }}
      />
    </div>
  );
}
