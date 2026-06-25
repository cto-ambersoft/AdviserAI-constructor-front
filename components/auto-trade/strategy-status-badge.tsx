import {
  deriveStrategyStatus,
  type StrategyStatusInput,
} from "@/lib/auto-trade/strategy-status";
import { cn } from "@/lib/utils";

/**
 * Unified strategy status badge — the single visual for a strategy's headline
 * state across the dashboard, monitor, and launch wizard (UX overhaul T5).
 * Logic lives in {@link deriveStrategyStatus}; this is pure presentation.
 *
 * `showDot` adds a small run-state indicator (filled when running).
 */
export function StrategyStatusBadge({
  lifecycleStage,
  isRunning,
  canPromote,
  showDot = false,
  className,
}: StrategyStatusInput & { showDot?: boolean; className?: string }) {
  const status = deriveStrategyStatus({ lifecycleStage, isRunning, canPromote });

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        status.tone,
        className,
      )}
      title={`Status: ${status.label}`}
    >
      {showDot ? (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            isRunning ? "" : "opacity-40",
          )}
          aria-hidden="true"
        />
      ) : null}
      {status.label}
    </span>
  );
}
