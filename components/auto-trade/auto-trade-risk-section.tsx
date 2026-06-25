"use client";

import { ShieldAlert } from "lucide-react";

import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import type {
  AutoTradeRiskFormState,
  ConflictingSignalPolicy,
} from "@/components/auto-trade/types";

const SECTION_CARD =
  "rounded-md border border-border/70 bg-card/40 p-3 space-y-3";

type Props = {
  value: AutoTradeRiskFormState;
  onChange: (
    updater: (prev: AutoTradeRiskFormState) => AutoTradeRiskFormState,
  ) => void;
};

// Only the enforced policies are offered. `net`/`replace` exist in the schema
// but are not implemented, so they are intentionally not selectable.
const POLICY_OPTIONS: { value: ConflictingSignalPolicy; label: string }[] = [
  { value: "off", label: "off — no conflict handling" },
  { value: "block_opposite", label: "block_opposite — skip opposite-side entry" },
];

export function AutoTradeRiskGovernanceSection({ value, onChange }: Props) {
  // Typed field setter. A function declaration (not an arrow) avoids the
  // generic-vs-JSX ambiguity in .tsx, matching the AI-overlay section's
  // ``update<K>`` helper.
  function setField<K extends keyof AutoTradeRiskFormState>(
    key: K,
    next: AutoTradeRiskFormState[K],
  ) {
    onChange((prev) => ({ ...prev, [key]: next }));
  }

  const preTradeOff = !value.enabled;
  const kpiOff = !value.kpi_guard_enabled;
  const killOff = !value.kill_switch_enabled;
  const anomalyOff = !value.anomaly_detection_enabled;

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-300" />
        <div>
          <h3 className="text-sm font-semibold">Risk Governance</h3>
          <p className="text-xs text-muted-foreground">
            Opt-in pre-trade limits and autonomous safeguards. Every limit is
            optional — leave a field empty to keep that rule off. Thresholds ship
            off; calibrate before enabling on a live strategy.
          </p>
        </div>
      </div>

      {/* ── Pre-Trade Limits (W8) ─────────────────────────────────────────── */}
      <div className={SECTION_CARD}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">Pre-Trade Limits</h4>
            <p className="text-xs text-muted-foreground">
              Blocks the <em>next entry</em> when violated (records a{" "}
              <span className="font-mono">risk_blocked</span> event). Open
              positions are untouched.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => setField("enabled", e.target.checked)}
            />
            Enabled
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionalNumberInput
            label="Daily loss limit (USDT)"
            value={value.daily_loss_limit_usdt}
            min={0}
            step={1}
            disabled={preTradeOff}
            onChange={(v) => setField("daily_loss_limit_usdt", v)}
            hint="Absolute realized-loss cap for the UTC day."
          />
          <OptionalNumberInput
            label="Daily loss limit (%)"
            value={value.daily_loss_limit_pct}
            min={0.0001}
            max={100}
            step={0.1}
            disabled={preTradeOff}
            onChange={(v) => setField("daily_loss_limit_pct", v)}
            hint="% of the strategy's sub-account balance."
          />
          <OptionalNumberInput
            label="Max open positions"
            value={value.max_open_positions}
            min={1}
            step={1}
            integer
            disabled={preTradeOff}
            onChange={(v) => setField("max_open_positions", v)}
            hint="Portfolio-wide across your strategies."
          />
          <OptionalNumberInput
            label="Max open per symbol"
            value={value.max_open_positions_per_symbol}
            min={1}
            step={1}
            integer
            disabled={preTradeOff}
            onChange={(v) => setField("max_open_positions_per_symbol", v)}
            hint="Anti-duplicate across strategies on the same symbol."
          />
          <OptionalNumberInput
            label="Exposure cap (USDT)"
            value={value.exposure_cap_usdt}
            min={0.0001}
            step={1}
            disabled={preTradeOff}
            onChange={(v) => setField("exposure_cap_usdt", v)}
            hint="Σ open position size + the new entry."
          />
          <OptionalNumberInput
            label="Leverage ceiling"
            value={value.leverage_ceiling}
            min={1}
            max={125}
            step={1}
            integer
            disabled={preTradeOff}
            onChange={(v) => setField("leverage_ceiling", v)}
          />
          <div className="space-y-1 sm:col-span-2">
            <Label text="Conflicting-signal policy" />
            <select
              className={INPUT_CLASS}
              value={value.conflicting_signal_policy}
              disabled={preTradeOff}
              onChange={(e) =>
                setField(
                  "conflicting_signal_policy",
                  e.target.value as ConflictingSignalPolicy,
                )
              }
            >
              {POLICY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">block_opposite</span> skips an
              opposite-side entry while a position is open.
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Guard — auto-pause (W9) ───────────────────────────────────── */}
      <div className={SECTION_CARD}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">KPI Guard — auto-pause</h4>
            <p className="text-xs text-muted-foreground">
              <strong>Pauses the whole strategy</strong> on a confirmed live-KPI
              breach — distinct from the pre-trade daily-loss above, which only
              blocks the next entry. Statistical rules need ≥ 10 closed trades.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.kpi_guard_enabled}
              onChange={(e) => setField("kpi_guard_enabled", e.target.checked)}
            />
            Enable
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionalNumberInput
            label="Max drawdown (%)"
            value={value.kpi_guard_max_dd_pct}
            min={0.0001}
            max={100}
            step={0.1}
            disabled={kpiOff}
            onChange={(v) => setField("kpi_guard_max_dd_pct", v)}
          />
          <OptionalNumberInput
            label="Min win rate (%)"
            value={value.kpi_guard_min_win_rate_pct}
            min={0}
            max={100}
            step={0.1}
            disabled={kpiOff}
            onChange={(v) => setField("kpi_guard_min_win_rate_pct", v)}
          />
          <OptionalNumberInput
            label="Max daily loss (USDT)"
            value={value.kpi_guard_max_daily_loss_usdt}
            min={0}
            step={1}
            disabled={kpiOff}
            onChange={(v) => setField("kpi_guard_max_daily_loss_usdt", v)}
          />
          <OptionalNumberInput
            label="Max daily loss (%)"
            value={value.kpi_guard_max_daily_loss_pct}
            min={0.0001}
            max={100}
            step={0.1}
            disabled={kpiOff}
            onChange={(v) => setField("kpi_guard_max_daily_loss_pct", v)}
          />
          <OptionalNumberInput
            label="Min trades (sample floor)"
            value={value.kpi_guard_min_trades}
            min={1}
            step={1}
            integer
            disabled={kpiOff}
            onChange={(v) => setField("kpi_guard_min_trades", v)}
            hint="Statistical rules also require ≥ 10 closed trades regardless."
          />
        </div>
      </div>

      {/* ── Volatility Kill-Switch (W9) ───────────────────────────────────── */}
      <div className={SECTION_CARD}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">Volatility Kill-Switch</h4>
            <p className="text-xs text-muted-foreground">
              <strong>Hard-closes the position and pauses the strategy</strong>{" "}
              on a confirmed volatility spike (ATR spike or single-bar price
              move).
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.kill_switch_enabled}
              onChange={(e) => setField("kill_switch_enabled", e.target.checked)}
            />
            Enable
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionalNumberInput
            label="ATR spike multiplier"
            value={value.kill_switch_atr_spike_mult}
            min={1.0001}
            step={0.1}
            disabled={killOff}
            onChange={(v) => setField("kill_switch_atr_spike_mult", v)}
            hint="Trip when current ATR ≥ mult × baseline (must be > 1)."
          />
          <OptionalNumberInput
            label="ATR period"
            value={value.kill_switch_atr_period}
            min={2}
            step={1}
            integer
            disabled={killOff}
            onChange={(v) => setField("kill_switch_atr_period", v)}
          />
          <OptionalNumberInput
            label="Price move (%)"
            value={value.kill_switch_price_move_pct}
            min={0.0001}
            step={0.1}
            disabled={killOff}
            onChange={(v) => setField("kill_switch_price_move_pct", v)}
            hint="Trip on a single-bar move ≥ this %."
          />
          <OptionalNumberInput
            label="Cooldown (seconds)"
            value={value.kill_switch_cooldown_seconds}
            min={0}
            step={1}
            integer
            disabled={killOff}
            onChange={(v) => setField("kill_switch_cooldown_seconds", v)}
          />
          {!killOff ? (
            <p className="text-xs text-amber-300/90 sm:col-span-2">
              Set an ATR spike multiplier and/or a price-move % — at least one is
              required to arm the switch.
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Strategy Anomaly Detection (B6/W12) ───────────────────────────── */}
      <div className={SECTION_CARD}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">Anomaly Detection</h4>
            <p className="text-xs text-muted-foreground">
              <strong>Alert-only</strong> statistical detection of anomalous
              behaviour (PnL outliers, drawdown spikes, win-rate collapse, trade
              bursts). Empty fields ⇒ engine defaults (z 3.0 / window 20).
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.anomaly_detection_enabled}
              onChange={(e) =>
                setField("anomaly_detection_enabled", e.target.checked)
              }
            />
            Enable
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionalNumberInput
            label="Z-score threshold"
            value={value.anomaly_z_threshold}
            min={0.0001}
            max={20}
            step={0.5}
            disabled={anomalyOff}
            onChange={(v) => setField("anomaly_z_threshold", v)}
            hint="Flag when |z| ≥ this (default 3.0)."
          />
          <OptionalNumberInput
            label="Window (trades)"
            value={value.anomaly_window}
            min={2}
            max={1000}
            step={1}
            integer
            disabled={anomalyOff}
            onChange={(v) => setField("anomaly_window", v)}
            hint="Rolling window size (default 20)."
          />
        </div>
      </div>

      {/* ── Promotion KPI-Gate (B5/W10) ───────────────────────────────────── */}
      <div className={SECTION_CARD}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">Promotion Gate</h4>
            <p className="text-xs text-muted-foreground">
              Thresholds a <strong>sandbox</strong> strategy must clear (on demo
              trades) before it can be promoted to live. Empty fields ⇒ the
              gate&apos;s conservative defaults.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionalNumberInput
            label="Min win rate (%)"
            value={value.promote_min_win_rate_pct}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setField("promote_min_win_rate_pct", v)}
          />
          <OptionalNumberInput
            label="Max drawdown (%)"
            value={value.promote_max_dd_pct}
            min={0.0001}
            max={100}
            step={1}
            onChange={(v) => setField("promote_max_dd_pct", v)}
          />
          <OptionalNumberInput
            label="Min closed trades"
            value={value.promote_min_trades}
            min={1}
            step={1}
            integer
            onChange={(v) => setField("promote_min_trades", v)}
          />
          <OptionalNumberInput
            label="Min sandbox days"
            value={value.promote_min_sandbox_days}
            min={0}
            step={1}
            onChange={(v) => setField("promote_min_sandbox_days", v)}
          />
        </div>
      </div>
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
  disabled = false,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  hint?: string;
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
        disabled={disabled}
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
