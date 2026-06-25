import { describe, expect, it } from "vitest";

import { sandboxConfigIds } from "@/components/monitor/promotion-utils";
import type {
  PortfolioSummaryResponse,
  StrategyPortfolioEntry,
} from "@/lib/api/types";

function entry(
  config_id: number,
  lifecycle_stage: string,
): StrategyPortfolioEntry {
  return { config_id, lifecycle_stage } as StrategyPortfolioEntry;
}

function portfolio(
  strategies: StrategyPortfolioEntry[],
): PortfolioSummaryResponse {
  return { strategies } as PortfolioSummaryResponse;
}

describe("sandboxConfigIds", () => {
  it("returns [] for a null portfolio", () => {
    expect(sandboxConfigIds(null)).toEqual([]);
  });

  it("returns only the sandbox-stage config_ids", () => {
    const result = sandboxConfigIds(
      portfolio([
        entry(1, "sandbox"),
        entry(2, "live"),
        entry(3, "sandbox"),
        entry(4, "validation"),
      ]),
    );
    expect(result).toEqual([1, 3]);
  });

  it("returns [] when nothing is in sandbox", () => {
    expect(sandboxConfigIds(portfolio([entry(1, "live")]))).toEqual([]);
  });
});
