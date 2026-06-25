import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StrategyStatusBadge } from "@/components/auto-trade/strategy-status-badge";

describe("StrategyStatusBadge", () => {
  it("renders Live for a running live strategy", () => {
    render(<StrategyStatusBadge lifecycleStage="live" isRunning />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders Paused for a stopped live strategy", () => {
    render(<StrategyStatusBadge lifecycleStage="live" isRunning={false} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("renders Eligible for a sandbox strategy that can promote", () => {
    render(
      <StrategyStatusBadge lifecycleStage="sandbox" canPromote isRunning />,
    );
    expect(screen.getByText("Eligible")).toBeInTheDocument();
  });

  it("exposes the status via title for hover/accessibility", () => {
    render(<StrategyStatusBadge lifecycleStage="sandbox" />);
    expect(screen.getByText("Sandbox")).toHaveAttribute(
      "title",
      "Status: Sandbox",
    );
  });
});
