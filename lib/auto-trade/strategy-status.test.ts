import { describe, expect, it } from "vitest";

import { deriveStrategyStatus } from "@/lib/auto-trade/strategy-status";

describe("deriveStrategyStatus", () => {
  it("a running live strategy is Live", () => {
    const s = deriveStrategyStatus({ lifecycleStage: "live", isRunning: true });
    expect(s.key).toBe("live");
    expect(s.label).toBe("Live");
  });

  it("a live strategy that is not running is Paused", () => {
    const s = deriveStrategyStatus({ lifecycleStage: "live", isRunning: false });
    expect(s.key).toBe("paused");
    expect(s.label).toBe("Paused");
  });

  it("a sandbox strategy that passed the gate is Eligible", () => {
    const s = deriveStrategyStatus({
      lifecycleStage: "sandbox",
      isRunning: true,
      canPromote: true,
    });
    expect(s.key).toBe("eligible");
    expect(s.label).toBe("Eligible");
  });

  it("a sandbox strategy that has not passed the gate is Sandbox", () => {
    const s = deriveStrategyStatus({
      lifecycleStage: "sandbox",
      canPromote: false,
    });
    expect(s.key).toBe("sandbox");
    expect(s.label).toBe("Sandbox");
  });

  it("maps the remaining lifecycle stages straight through", () => {
    expect(deriveStrategyStatus({ lifecycleStage: "research" }).key).toBe("research");
    expect(deriveStrategyStatus({ lifecycleStage: "validation" }).key).toBe("validation");
    expect(deriveStrategyStatus({ lifecycleStage: "rejected" }).key).toBe("rejected");
    expect(deriveStrategyStatus({ lifecycleStage: "archived" }).key).toBe("archived");
  });

  it("falls back to a neutral Unknown badge for missing/unrecognised stages", () => {
    const missing = deriveStrategyStatus({ lifecycleStage: null });
    expect(missing.key).toBe("unknown");
    expect(missing.label).toBe("Unknown");
    expect(deriveStrategyStatus({ lifecycleStage: "weird" }).key).toBe("unknown");
  });

  it("gives every status a non-empty tone className", () => {
    for (const stage of ["live", "sandbox", "validation", "research", "rejected", "archived", "weird"]) {
      expect(deriveStrategyStatus({ lifecycleStage: stage }).tone.length).toBeGreaterThan(0);
    }
  });
});
