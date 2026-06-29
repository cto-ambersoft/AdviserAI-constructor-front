import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { ReliabilityDiagram } from "@/components/oa/reliability-diagram";

describe("ReliabilityDiagram", () => {
  it("renders one point per non-empty bin (empty bins skipped)", () => {
    const { getAllByTestId, queryByTestId } = render(
      <ReliabilityDiagram
        bins={[
          { pMid: 0.55, predictedMean: 0.55, observedRate: 0.5, count: 10 },
          { pMid: 0.65, predictedMean: 0.65, observedRate: 0.6, count: 4 },
          { pMid: 0.75, predictedMean: 0.75, observedRate: 0, count: 0 }, // empty → skipped
        ]}
      />,
    );
    expect(queryByTestId("reliability-diagram")).not.toBeNull();
    expect(getAllByTestId("reliability-point")).toHaveLength(2);
  });

  it("renders the frame/diagonal even with no bins", () => {
    const { queryByTestId, queryAllByTestId } = render(
      <ReliabilityDiagram bins={[]} />,
    );
    expect(queryByTestId("reliability-diagram")).not.toBeNull();
    expect(queryAllByTestId("reliability-point")).toHaveLength(0);
  });
});
