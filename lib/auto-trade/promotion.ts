import type { PromotionStatusRead } from "@/lib/api/types";

/**
 * Trades still needed before the sandbox→live KPI gate's sample-size criterion
 * passes (UX overhaul T10). Computed client-side from the gate criteria — the
 * backend already exposes actual vs threshold per criterion, so no extra
 * endpoint is needed. Returns null when there is no sample-size criterion.
 */
export function remainingTrades(
  promotion: PromotionStatusRead | null | undefined,
): number | null {
  if (!promotion) return null;
  const criterion = promotion.criteria.find((c) => /trade/i.test(c.name));
  if (!criterion) return null;
  return Math.max(0, Math.ceil(criterion.threshold - criterion.actual));
}
