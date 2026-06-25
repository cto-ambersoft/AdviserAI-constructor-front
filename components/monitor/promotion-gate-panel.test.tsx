import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PromotionGatePanel } from "@/components/monitor/promotion-gate-panel";
import type { PromotionStatusRead } from "@/lib/api/types";

function status(over: Partial<PromotionStatusRead> = {}): PromotionStatusRead {
  return {
    config_id: 1,
    lifecycle_stage: "sandbox",
    sandbox_days: 9,
    can_promote: false,
    criteria: [
      { name: "min_win_rate", actual: 40, threshold: 50, passed: false },
    ],
    ...over,
  };
}

describe("PromotionGatePanel", () => {
  it("shows 'unavailable' when there is no status", () => {
    render(<PromotionGatePanel promotion={null} isLoading={false} />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("renders each criterion and a not-ready verdict", () => {
    render(<PromotionGatePanel promotion={status()} isLoading={false} />);
    expect(screen.getByText("Not ready")).toBeInTheDocument();
    expect(screen.getByText(/min win rate/)).toBeInTheDocument();
    expect(screen.getByText(/40\.0 \/ 50\.0/)).toBeInTheDocument();
  });

  it("shows ready-to-promote when the gate passes", () => {
    render(
      <PromotionGatePanel
        promotion={status({
          can_promote: true,
          criteria: [
            { name: "min_trades", actual: 30, threshold: 20, passed: true },
          ],
        })}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Ready to promote")).toBeInTheDocument();
  });
});
