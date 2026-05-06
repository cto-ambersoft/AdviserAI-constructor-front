/**
 * Frontend-side helpers for the admin AI backtest config screen.
 *
 * The previous version of this file shipped a hardcoded fallback dataset
 * (AI_BACKTEST_CONFIGS) and a manually-maintained column array with English
 * labels and pixel widths. Both have moved server-side:
 *
 * - Configs come from `GET /api/v1/ai-backtests/ai-configs` (camelCase).
 * - Columns/labels come from `GET /api/v1/ai-backtests/ai-configs/schema`.
 * - Catalogue metric labels come from `.../ai-forecast-catalogue/metrics-schema`.
 * - Agent code → human label mapping comes from `.../agents`.
 *
 * Anything that *cannot* be derived from those payloads (visual tone for an
 * enum, badge variants etc.) lives here.
 */

import type {
  AiConfigEnumOption,
  AiConfigField,
  AiConfigFieldTone,
} from "@/lib/api/services/ai-backtests";

export type ToneClasses = {
  border: string;
  background: string;
  text: string;
};

export const TONE_CLASSES: Record<AiConfigFieldTone, ToneClasses> = {
  neutral: {
    border: "border-muted-foreground/25",
    background: "bg-muted/45",
    text: "text-muted-foreground",
  },
  success: {
    border: "border-emerald-400/40",
    background: "bg-emerald-500/15",
    text: "text-emerald-100",
  },
  warning: {
    border: "border-amber-400/40",
    background: "bg-amber-500/15",
    text: "text-amber-100",
  },
  danger: {
    border: "border-rose-400/45",
    background: "bg-rose-500/15",
    text: "text-rose-100",
  },
};

export function findEnumOption(
  field: AiConfigField,
  value: unknown,
): AiConfigEnumOption | null {
  if (!field.options) return null;
  const stringValue = typeof value === "string" ? value : String(value ?? "");
  return field.options.find((option) => option.value === stringValue) ?? null;
}
