import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { OaDecisionBadge, OaSignalBadge } from "@/components/oa/oa-signal-badge";
import type { OaProfileCalibration } from "@/lib/api/types";

const active: OaProfileCalibration = {
  method: "platt",
  status: "active",
  sampleSize: 120,
  trainSize: 84,
  holdoutSize: 36,
} as OaProfileCalibration;

describe("OaSignalBadge", () => {
  it("shows 'collecting data' with the sample count when not calibrated", () => {
    render(
      <OaSignalBadge
        calibration={{ ...active, status: "NEUTRAL", method: "none", sampleSize: 7 }}
      />,
    );
    expect(screen.getByTestId("oa-signal-badge").textContent).toMatch(
      /collecting data \(7\)/i,
    );
  });

  it("shows 'collecting data' when calibration is null", () => {
    render(<OaSignalBadge calibration={null} />);
    expect(screen.getByTestId("oa-signal-badge").textContent).toMatch(
      /collecting data \(0\)/i,
    );
  });

  it("shows the calibrator + hit-rate when active", () => {
    render(
      <OaSignalBadge
        calibration={active}
        accuracy={[
          { windowDays: 30, hitRate: 0.62, meanEdge: 1.1, sampleSize: 120, realSampleSize: 20, shadowSampleSize: 100 },
        ]}
      />,
    );
    const text = screen.getByTestId("oa-signal-badge").textContent ?? "";
    expect(text).toMatch(/calibrated/i);
    expect(text).toMatch(/platt/);
    expect(text).toMatch(/62% hit/);
  });
});

describe("OaDecisionBadge", () => {
  it("renders nothing when OA didn't run on the forecast", () => {
    const { container } = render(<OaDecisionBadge decision={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows 'collecting data' for a gated/neutral decision", () => {
    render(<OaDecisionBadge decision={{ decision: "neutral", minSampleGateTripped: true }} />);
    expect(screen.getByTestId("oa-decision-badge").textContent).toMatch(
      /collecting data/i,
    );
  });

  it("shows the decision + calibrated probability when active", () => {
    render(<OaDecisionBadge decision={{ decision: "enter", calibratedP: 0.63, influenced: true }} />);
    const text = screen.getByTestId("oa-decision-badge").textContent ?? "";
    expect(text).toMatch(/enter/);
    expect(text).toMatch(/p 63%/);
  });
});
