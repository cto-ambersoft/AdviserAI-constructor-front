/**
 * Single source of truth for a strategy's headline status (UX overhaul T5).
 *
 * The backend exposes `lifecycle_stage` (research → sandbox → validation → live,
 * plus rejected/archived), `is_running`, and a sandbox-only `can_promote` gate.
 * This collapses those into one human-facing status so the dashboard, monitor,
 * and launch wizard all show the same badge:
 *
 *   - live + running          → Live
 *   - live + not running      → Paused (a promoted strategy that isn't trading)
 *   - sandbox + can_promote    → Eligible (gate passed, ready for live)
 *   - sandbox                  → Sandbox
 *   - research/validation/...  → shown as-is
 *
 * Note: the spec's "Draft"/"Backtested" labels have no backend lifecycle stage;
 * they map onto `research`/`validation`. We intentionally do not invent stages
 * the backend does not track.
 */
export type StrategyStatusKey =
  | "research"
  | "sandbox"
  | "eligible"
  | "validation"
  | "live"
  | "paused"
  | "rejected"
  | "archived"
  | "unknown";

export type StrategyStatusInput = {
  lifecycleStage: string | null | undefined;
  isRunning?: boolean | null;
  canPromote?: boolean | null;
};

export type StrategyStatus = {
  key: StrategyStatusKey;
  label: string;
  tone: string;
};

const TONE: Record<StrategyStatusKey, string> = {
  live: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  eligible: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  validation: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  sandbox: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  paused: "border-red-500/40 bg-red-500/10 text-red-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-300",
  research: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  archived: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
  unknown: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
};

const LABEL: Record<StrategyStatusKey, string> = {
  live: "Live",
  eligible: "Eligible",
  validation: "Validation",
  sandbox: "Sandbox",
  paused: "Paused",
  rejected: "Rejected",
  research: "Research",
  archived: "Archived",
  unknown: "Unknown",
};

function status(key: StrategyStatusKey): StrategyStatus {
  return { key, label: LABEL[key], tone: TONE[key] };
}

export function deriveStrategyStatus(input: StrategyStatusInput): StrategyStatus {
  const stage = (input.lifecycleStage ?? "").toLowerCase().trim();

  switch (stage) {
    case "live":
      return status(input.isRunning === false ? "paused" : "live");
    case "sandbox":
      return status(input.canPromote === true ? "eligible" : "sandbox");
    case "validation":
      return status("validation");
    case "research":
      return status("research");
    case "rejected":
      return status("rejected");
    case "archived":
      return status("archived");
    default:
      return status("unknown");
  }
}
