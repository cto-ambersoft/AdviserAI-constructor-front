import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { getProfileOaCalibration } = vi.hoisted(() => ({
  getProfileOaCalibration: vi.fn(),
}));

vi.mock("@/lib/api/services/analysis", () => ({
  getProfileOaCalibration,
}));

import { OaCalibrationPanel } from "@/components/oa/oa-calibration-panel";

describe("OaCalibrationPanel", () => {
  beforeEach(() => getProfileOaCalibration.mockReset());

  it("renders nothing when OA is disabled for the profile", () => {
    const { container } = render(
      <OaCalibrationPanel profileId={1} enabled={false} />,
    );
    expect(container.firstChild).toBeNull();
    expect(getProfileOaCalibration).not.toHaveBeenCalled();
  });

  it("renders nothing for an unsaved profile (no id)", () => {
    const { container } = render(
      <OaCalibrationPanel profileId={null} enabled />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the collecting-data state for a NEUTRAL profile", async () => {
    getProfileOaCalibration.mockResolvedValue({
      calibration: { method: "none", status: "NEUTRAL", sampleSize: 8, trainSize: 0, holdoutSize: 0 },
      accuracy: [],
    });
    render(<OaCalibrationPanel profileId={1} enabled />);
    await waitFor(() =>
      expect(screen.getByText(/collecting data: 8 closed outcomes/i)).toBeInTheDocument(),
    );
  });

  it("refetches and drops the old profile's data when the profile changes (A→B)", async () => {
    getProfileOaCalibration.mockImplementation((id: number) =>
      Promise.resolve({
        calibration: {
          method: "platt",
          status: "active",
          sampleSize: id === 1 ? 111 : 222,
          trainSize: 1,
          holdoutSize: 1,
          reliabilityBins: [],
        },
        accuracy: [],
      }),
    );
    const { rerender } = render(<OaCalibrationPanel profileId={1} enabled />);
    await waitFor(() => expect(screen.getByText(/111/)).toBeInTheDocument());

    rerender(<OaCalibrationPanel profileId={2} enabled />);
    await waitFor(() => expect(getProfileOaCalibration).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.getByText(/222/)).toBeInTheDocument());
    // the previous profile's data is gone (no stale flash persisting)
    expect(screen.queryByText(/111/)).toBeNull();
  });

  it("shows metrics + reliability diagram for an active calibrator", async () => {
    getProfileOaCalibration.mockResolvedValue({
      calibration: {
        method: "platt",
        status: "active",
        sampleSize: 120,
        trainSize: 84,
        holdoutSize: 36,
        ece: 0.05,
        holdoutBrier: 0.21,
        holdoutBrierRaw: 0.3,
        holdoutLogLoss: 0.6,
        holdoutLogLossRaw: 0.7,
        reliabilityBins: [
          { pMid: 0.55, predictedMean: 0.55, observedRate: 0.5, count: 20 },
          { pMid: 0.65, predictedMean: 0.65, observedRate: 0.66, count: 16 },
        ],
      },
      accuracy: [
        { windowDays: 30, hitRate: 0.62, meanEdge: 1.1, sampleSize: 120, realSampleSize: 20, shadowSampleSize: 100 },
      ],
    });
    render(<OaCalibrationPanel profileId={1} enabled />);

    await waitFor(() => expect(screen.getByTestId("oa-calibration-panel")).toBeInTheDocument());
    // active badge + metrics + the SVG diagram
    expect(screen.getByTestId("oa-signal-badge").textContent).toMatch(/calibrated/i);
    expect(screen.getByText(/Brier \(cal\/raw\)/i)).toBeInTheDocument();
    expect(screen.getByTestId("reliability-diagram")).toBeInTheDocument();
    expect(screen.getAllByTestId("reliability-point")).toHaveLength(2);
  });
});
