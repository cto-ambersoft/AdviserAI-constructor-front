import type { PortfolioSummaryResponse } from "@/lib/api/types";

/**
 * config_ids of strategies currently in `sandbox` — the ones that show a Promote
 * action and whose gate-status is worth prefetching so the button reflects
 * readiness without the user opening the Gate panel. Bounded by sandbox count.
 */
export function sandboxConfigIds(
  portfolio: PortfolioSummaryResponse | null,
): number[] {
  return (portfolio?.strategies ?? [])
    .filter((entry) => entry.lifecycle_stage === "sandbox")
    .map((entry) => entry.config_id);
}
