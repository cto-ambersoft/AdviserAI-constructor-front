// Shared KPI formatting for the Live Monitor (F2). Missing values render "—",
// never 0. Mirrors the W9 health-card conventions; kept local to this feature.

export function formatUsdt(value: number | null | undefined, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(digits)} USDT`;
}

/** Signed USDT with a +/- sign — for PnL figures. */
export function formatSignedUsdt(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} USDT`;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(digits)}%`;
}

export function formatNum(value: number | null | undefined, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

/**
 * KPI freshness from `kpi_as_of`. null → "—" (strategy stopped / no snapshot —
 * never shown as 0). Recent → "N min ago"; older → "updated HH:MM". — TZ §3.
 */
export function formatKpiFreshness(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) {
    return "updated just now";
  }
  if (diffMinutes < 60) {
    return `updated ${diffMinutes} min ago`;
  }
  return `updated ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const PnL_TONE = {
  up: "text-emerald-300",
  down: "text-red-300",
  flat: "text-foreground",
} as const;

export function pnlTone(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return PnL_TONE.flat;
  }
  return value > 0 ? PnL_TONE.up : PnL_TONE.down;
}

// health_class is 4-valued (healthy / warning / critical / insufficient_data).
// `insufficient_data` and a missing value are NEUTRAL, never error-styled. — §3.
export function HealthClassBadge({
  value,
}: {
  value: string | null | undefined;
}) {
  const cls = value ?? "";
  const tone =
    cls === "healthy"
      ? "bg-emerald-500/20 text-emerald-200"
      : cls === "warning"
        ? "bg-amber-500/20 text-amber-200"
        : cls === "critical"
          ? "bg-red-500/20 text-red-200"
          : "bg-muted text-muted-foreground";
  const label = cls ? cls.replace(/_/g, " ") : "no data";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}

// Lifecycle stage styling now lives in the unified StrategyStatusBadge
// (lib/auto-trade/strategy-status.ts) — UX overhaul T5/T6.
