"use client";

import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";

import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import { Button } from "@/components/ui/button";
import { AutoTradeTPLevelSLModal } from "@/components/auto-trade/auto-trade-tp-level-sl-modal";
import type {
  AutoTradeStrategyProfileFormState,
  AutoTradeTPLevelFormState,
} from "@/components/auto-trade/types";
import { cn } from "@/lib/utils";

const SECTION_CARD =
  "rounded-md border border-border/70 bg-card/40 p-3 space-y-3";
const ITEM_CARD = "rounded-md border border-border/60 bg-background/40 p-3";

type Props = {
  profile: AutoTradeStrategyProfileFormState;
  onChange: (
    updater: (prev: AutoTradeStrategyProfileFormState) => AutoTradeStrategyProfileFormState,
  ) => void;
};

export function AutoTradeStrategyProfileSection({ profile, onChange }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Advanced strategy profile</h3>
          <p className="text-xs text-muted-foreground">
            Configure multi-TP behavior. When disabled, the simple bracket
            SL/TP from the basic config is used.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.enabled}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, enabled: event.target.checked }))
            }
          />
          Enable
        </label>
      </div>

      {profile.enabled ? (
        <SLTPSection profile={profile} onChange={onChange} />
      ) : null}
    </div>
  );
}

// ─── SL/TP ─────────────────────────────────────────────────────────────────

function SLTPSection({ profile, onChange }: Props) {
  return (
    <div className={SECTION_CARD}>
      <h4 className="text-sm font-medium">Take-profit</h4>
      <p className="text-xs text-muted-foreground">
        The initial stop-loss comes from the basic config{" "}
        <span className="font-mono">sl_pct</span>. Configure how the take-profit
        fires here, then enable dynamic SL adjustments below.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label text="TP mode" />
          <select
            className={INPUT_CLASS}
            value={profile.tp_mode}
            onChange={(event) =>
              onChange((prev) => ({
                ...prev,
                tp_mode: event.target.value as AutoTradeStrategyProfileFormState["tp_mode"],
              }))
            }
          >
            <option value="single">single — one TP at tp_value%</option>
            <option value="multi">multi — staircase of partial TPs</option>
          </select>
        </div>

        {profile.tp_mode === "single" ? (
          <NumberInput
            label="TP offset from entry (%)"
            value={profile.tp_value}
            min={0.0001}
            step={0.01}
            onChange={(value) => onChange((prev) => ({ ...prev, tp_value: value }))}
            hint="Same shape as the basic tp_pct, but persisted on the profile."
          />
        ) : null}
      </div>

      {profile.tp_mode === "multi" ? (
        <MultiTPLevels profile={profile} onChange={onChange} />
      ) : null}
    </div>
  );
}

function MultiTPLevels({ profile, onChange }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const totalClosePct = profile.tp_levels.reduce(
    (sum, level) => sum + (Number.isFinite(level.close_pct) ? level.close_pct : 0),
    0,
  );

  const updateLevel = (
    index: number,
    patch: Partial<AutoTradeTPLevelFormState>,
  ) => {
    onChange((prev) => ({
      ...prev,
      tp_levels: prev.tp_levels.map((level, idx) =>
        idx === index ? { ...level, ...patch } : level,
      ),
    }));
  };

  const addLevel = () => {
    onChange((prev) => ({
      ...prev,
      tp_levels: [
        ...prev.tp_levels,
        {
          price_offset_pct: 1,
          close_pct: Math.max(1, 100 - totalClosePct),
          sl_lock_pct: null,
          move_sl_to: null,
        },
      ],
    }));
  };

  const removeLevel = (index: number) => {
    onChange((prev) => ({
      ...prev,
      tp_levels: prev.tp_levels.filter((_, idx) => idx !== index),
    }));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          TP levels — close % must add up to 100%. Currently{" "}
          <span
            className={
              Math.abs(totalClosePct - 100) > 0.1
                ? "text-amber-300"
                : "text-emerald-300"
            }
          >
            {totalClosePct.toFixed(2)}%
          </span>
          .
        </span>
        <Button type="button" size="sm" variant="outline" onClick={addLevel}>
          + Add level
        </Button>
      </div>

      {profile.tp_levels.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No levels yet — add at least one. Each level fires a partial close
          and can move the stop-loss.
        </p>
      ) : null}

      {profile.tp_levels.map((level, index) => (
        <div key={index} className={ITEM_CARD}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Take-profit level #{index + 1}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeLevel(index)}
              >
                Remove
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberInput
                label="Price offset from entry (%)"
                value={level.price_offset_pct}
                min={0.0001}
                step={0.01}
                onChange={(value) =>
                  updateLevel(index, { price_offset_pct: value })
                }
                hint="How far above entry (LONG) / below entry (SHORT) this TP triggers."
              />
              <NumberInput
                label="Close fraction (%)"
                value={level.close_pct}
                min={0.0001}
                max={100}
                step={0.1}
                onChange={(value) => updateLevel(index, { close_pct: value })}
                hint="Share of the position closed when this TP fires."
              />
            </div>

            <SLTriggerButton
              levelNumber={index + 1}
              value={level.sl_lock_pct}
              onClick={() => setOpenIndex(index)}
            />
          </div>
        </div>
      ))}

      {openIndex !== null && profile.tp_levels[openIndex] ? (
        <AutoTradeTPLevelSLModal
          levelNumber={openIndex + 1}
          value={profile.tp_levels[openIndex].sl_lock_pct}
          tpPriceOffsetPct={profile.tp_levels[openIndex].price_offset_pct}
          open
          onOpenChange={(open) => {
            if (!open) setOpenIndex(null);
          }}
          onSave={(nextValue) =>
            updateLevel(openIndex, {
              sl_lock_pct: nextValue,
              // Clear the legacy hint so payload stays consistent.
              move_sl_to: null,
            })
          }
        />
      ) : null}
    </div>
  );
}

function SLTriggerButton({
  levelNumber,
  value,
  onClick,
}: {
  levelNumber: number;
  value: number | null;
  onClick: () => void;
}) {
  const isUnset = value === null;
  const summary = describeLockPct(value);
  const subtitle =
    value === null
      ? "Click to choose where SL moves when this TP fires."
      : value === 0
        ? "SL → entry (no further loss possible)"
        : value === 100
          ? "SL → TP price (zero drawdown on remaining qty)"
          : value < 0
            ? `Loosens SL toward original by ${Math.abs(value)}%`
            : `Locks ${value}% of profit at this TP`;

  return (
    <div className="space-y-1">
      <Label text={`After TP #${levelNumber} — SL move`} />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition",
          "focus:outline-none focus:ring-2 focus:ring-emerald-400/40",
          isUnset
            ? "border-dashed border-border/70 bg-background/20 text-foreground hover:border-emerald-400/60 hover:bg-emerald-400/5"
            : "border-border/60 bg-background/40 text-foreground hover:border-emerald-400/60 hover:bg-emerald-400/5",
        )}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium leading-tight">
            {summary}
          </span>
          <span className="truncate text-xs leading-tight text-muted-foreground">
            {subtitle}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground transition group-hover:text-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="text-xs uppercase tracking-wide">Configure</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}

function describeLockPct(value: number | null): string {
  if (value === null) return "Choose…";
  if (value === 0) return "Breakeven (0%)";
  if (value === 50) return "Half profit (50%)";
  if (value === 100) return "At TP price (100%)";
  if (value < 0) return `Reduce risk (${value}%)`;
  return `Lock ${value}% of profit`;
}

// ─── Reusable inputs ──────────────────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  integer = false,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  hint?: string;
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

