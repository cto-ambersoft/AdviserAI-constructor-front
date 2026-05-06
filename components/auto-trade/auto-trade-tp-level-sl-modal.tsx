"use client";

import { useState } from "react";
import { Slider } from "radix-ui";

import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Side = "LONG" | "SHORT";

type Props = {
  /** Visible level number (1-based) for the title. */
  levelNumber: number;
  /** Current persisted value: % of profit locked, or null = "do not move". */
  value: number | null;
  /** Position side — affects price preview math. */
  side?: Side;
  /** TP price-offset from entry, in %. Used for the live preview. */
  tpPriceOffsetPct: number;
  /**
   * Reference entry price for the preview block. Optional; falls back to a
   * synthetic 100,000 when no real value is known yet (form-time preview).
   */
  previewEntryPrice?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (nextValue: number | null) => void;
};

type Preset = {
  label: string;
  caption: string;
  value: number | null;
  tone: "neutral" | "warn" | "primary";
};

const PRESETS: Preset[] = [
  {
    label: "Don't move SL",
    caption: "Keep the stop-loss where it is",
    value: null,
    tone: "neutral",
  },
  {
    label: "Reduce risk -50%",
    caption: "Move SL halfway between original SL and entry",
    value: -50,
    tone: "warn",
  },
  {
    label: "Breakeven (0%)",
    caption: "Move SL to entry — no further loss possible",
    value: 0,
    tone: "primary",
  },
  {
    label: "Lock 50% of profit",
    caption: "Move SL halfway between entry and this TP",
    value: 50,
    tone: "primary",
  },
  {
    label: "Lock at TP price (100%)",
    caption: "Move SL to TP — zero drawdown on remaining qty",
    value: 100,
    tone: "primary",
  },
];

const SLIDER_MIN = -100;
const SLIDER_MAX = 150;
const PREVIEW_FALLBACK_ENTRY = 100_000;

export function AutoTradeTPLevelSLModal({
  levelNumber,
  value,
  side = "LONG",
  tpPriceOffsetPct,
  previewEntryPrice,
  open,
  onOpenChange,
  onSave,
}: Props) {
  // Modal is mounted fresh each open (parent only renders when open=true),
  // so seeding state from props is sufficient — no useEffect needed.
  const [draft, setDraft] = useState<number | null>(value);
  const [draftMode, setDraftMode] = useState<"preset" | "custom">(
    inferMode(value),
  );

  const entry =
    Number.isFinite(previewEntryPrice) &&
    (previewEntryPrice as number) > 0
      ? (previewEntryPrice as number)
      : PREVIEW_FALLBACK_ENTRY;
  const tpPrice =
    side === "SHORT"
      ? entry * (1 - tpPriceOffsetPct / 100)
      : entry * (1 + tpPriceOffsetPct / 100);
  const interval = tpPrice - entry; // signed: > 0 for LONG, < 0 for SHORT
  const projectedSL =
    draft === null ? null : entry + (interval * draft) / 100;

  const handleSave = () => {
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            TP #{levelNumber} — what happens to the stop-loss?
          </DialogTitle>
          <DialogDescription>
            Pick where the SL should jump when this take-profit fires.
            Negative values keep some risk but cut it; 0 is breakeven; 100 sets
            SL at the TP price — no drawdown allowed on the remaining size.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            {PRESETS.map((preset) => {
              const active =
                draftMode === "preset" &&
                ((draft === null && preset.value === null) ||
                  (draft !== null && preset.value === draft));
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDraft(preset.value);
                    setDraftMode("preset");
                  }}
                  className={cn(
                    "rounded-md border p-3 text-left transition",
                    active
                      ? toneClasses(preset.tone, "active")
                      : toneClasses(preset.tone, "inactive"),
                  )}
                >
                  <div className="text-sm font-semibold">{preset.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {preset.caption}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setDraftMode("custom");
              if (draft === null) setDraft(50);
            }}
            className={cn(
              "w-full rounded-md border p-3 text-left transition",
              draftMode === "custom"
                ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-100"
                : "border-border/60 bg-background/30 text-foreground hover:border-border",
            )}
          >
            <div className="text-sm font-semibold">Custom %</div>
            <div className="text-xs text-muted-foreground">
              Pick any value between {SLIDER_MIN}% and {SLIDER_MAX}% on the
              entry → TP axis (e.g. 25% to lock a quarter of the profit).
            </div>
          </button>

          {draftMode === "custom" && draft !== null ? (
            <CustomSlider
              value={draft}
              onChange={setDraft}
            />
          ) : null}
        </div>

        <PriceLadder
          side={side}
          entry={entry}
          tpPrice={tpPrice}
          projectedSL={projectedSL}
          tpPriceOffsetPct={tpPriceOffsetPct}
          previewIsSynthetic={!previewEntryPrice}
          levelNumber={levelNumber}
          draft={draft}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────── custom slider + numeric input ─────────────────────

function CustomSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const clamp = (raw: number) => Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, raw));

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-background/30 p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <Label text={`Lock % (${SLIDER_MIN}…${SLIDER_MAX})`} />
          <input
            type="number"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={String(value)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(clamp(next));
            }}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex items-end">
          <span className="text-xs text-muted-foreground">
            {describeValue(value)}
          </span>
        </div>
      </div>

      <Slider.Root
        className="relative flex h-5 w-full touch-none items-center"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={1}
        value={[value]}
        onValueChange={(next) => onChange(clamp(next[0] ?? 0))}
      >
        <Slider.Track className="relative h-1 w-full grow rounded-full bg-border">
          {/* Marker for the entry / breakeven (0%) point. */}
          <span
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/60"
            style={{ left: `${pctOnSlider(0)}%` }}
            aria-hidden
          />
          <Slider.Range className="absolute h-full rounded-full bg-emerald-400/60" />
        </Slider.Track>
        <Slider.Thumb
          aria-label="SL lock percent"
          className="block h-4 w-4 rounded-full border-2 border-emerald-300 bg-background shadow focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        />
      </Slider.Root>

      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{SLIDER_MIN}% loose</span>
        <span>0 entry</span>
        <span>100 at TP</span>
        <span>{SLIDER_MAX}% past TP</span>
      </div>
    </div>
  );
}

function pctOnSlider(value: number): number {
  const range = SLIDER_MAX - SLIDER_MIN;
  return ((value - SLIDER_MIN) / range) * 100;
}

// ────────────── price ladder preview ─────────────────────────────

function PriceLadder({
  side,
  entry,
  tpPrice,
  projectedSL,
  tpPriceOffsetPct,
  previewIsSynthetic,
  levelNumber,
  draft,
}: {
  side: Side;
  entry: number;
  tpPrice: number;
  projectedSL: number | null;
  tpPriceOffsetPct: number;
  previewIsSynthetic: boolean;
  levelNumber: number;
  draft: number | null;
}) {
  const fmt = (price: number) =>
    price.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const slDirectionTone =
    draft === null
      ? "neutral"
      : draft >= 0
        ? "good"
        : "warn";

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Preview
          {previewIsSynthetic ? " (synthetic entry = $100,000)" : ""}
        </span>
        <span className="text-xs text-muted-foreground">
          {side} · TP{levelNumber} = {tpPriceOffsetPct.toFixed(2)}%
        </span>
      </div>
      <div className="grid grid-cols-[110px_auto] gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">TP price</span>
        <span className="font-mono text-emerald-300">${fmt(tpPrice)}</span>

        <span className="text-muted-foreground">Entry</span>
        <span className="font-mono">${fmt(entry)}</span>

        <span className="text-muted-foreground">New SL</span>
        <span className="font-mono">
          {projectedSL === null ? (
            <span className="text-muted-foreground">— (no change)</span>
          ) : (
            <span
              className={cn(
                slDirectionTone === "good" && "text-emerald-300",
                slDirectionTone === "warn" && "text-amber-300",
              )}
            >
              ${fmt(projectedSL)}
              <span className="ml-2 text-xs text-muted-foreground">
                {describeValue(draft as number)}
              </span>
            </span>
          )}
        </span>
      </div>
      {previewIsSynthetic ? (
        <p className="text-xs text-muted-foreground">
          The real entry price is known at signal time. Preview keeps the
          proportions; formula:{" "}
          <span className="font-mono">SL = entry + (TP − entry) × X / 100</span>.
        </p>
      ) : null}
    </div>
  );
}

// ────────────── helpers ──────────────────────────────────────────

function inferMode(value: number | null): "preset" | "custom" {
  if (value === null) return "preset";
  if (value === -50 || value === 0 || value === 50 || value === 100) {
    return "preset";
  }
  return "custom";
}

function describeValue(value: number): string {
  if (value === 0) return "breakeven";
  if (value === 100) return "at TP price";
  if (value < 0) return `loosens SL by ${Math.abs(value)}% toward original`;
  if (value > 100) return `${value - 100}% beyond TP price`;
  return `locks ${value}% of profit`;
}

function toneClasses(
  tone: "neutral" | "warn" | "primary",
  state: "active" | "inactive",
): string {
  if (state === "active") {
    if (tone === "warn") {
      return "border-amber-400/70 bg-amber-400/10 text-amber-100";
    }
    if (tone === "primary") {
      return "border-emerald-400/70 bg-emerald-400/10 text-emerald-100";
    }
    return "border-foreground/40 bg-foreground/5 text-foreground";
  }
  return "border-border/60 bg-background/30 text-foreground hover:border-border";
}
