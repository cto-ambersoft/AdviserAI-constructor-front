import { describe, expect, it } from "vitest";

import { remainingTrades } from "@/lib/auto-trade/promotion";
import type { PromotionStatusRead } from "@/lib/api/types";

function status(
  criteria: { name: string; actual: number; threshold: number; passed: boolean }[],
): PromotionStatusRead {
  return {
    config_id: 1,
    lifecycle_stage: "sandbox",
    sandbox_days: 1,
    can_promote: false,
    criteria,
  };
}

describe("remainingTrades", () => {
  it("returns the shortfall on the trades criterion", () => {
    const s = status([
      { name: "min_trades", actual: 6, threshold: 10, passed: false },
    ]);
    expect(remainingTrades(s)).toBe(4);
  });

  it("is zero once the trades threshold is met", () => {
    const s = status([
      { name: "closed_trades", actual: 15, threshold: 10, passed: true },
    ]);
    expect(remainingTrades(s)).toBe(0);
  });

  it("rounds a fractional shortfall up", () => {
    const s = status([
      { name: "trades", actual: 6.2, threshold: 10, passed: false },
    ]);
    expect(remainingTrades(s)).toBe(4);
  });

  it("returns null when there is no trades criterion or no status", () => {
    expect(remainingTrades(status([{ name: "win_rate", actual: 50, threshold: 55, passed: false }]))).toBeNull();
    expect(remainingTrades(null)).toBeNull();
  });
});
