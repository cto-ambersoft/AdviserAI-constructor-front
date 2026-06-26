import { describe, expect, it } from "vitest";

import { summarizeDebate } from "./debate";

describe("summarizeDebate", () => {
  it("returns null when there is no analysisStructured", () => {
    expect(summarizeDebate(null)).toBeNull();
    expect(summarizeDebate(undefined)).toBeNull();
  });

  it("returns null when no debate ran", () => {
    expect(summarizeDebate({ bias: "BULLISH" })).toBeNull();
  });

  it("returns null when the debate did not apply", () => {
    expect(summarizeDebate({ debate: { applied: false } })).toBeNull();
  });

  it("maps an applied debate summary", () => {
    const view = summarizeDebate({
      debate: {
        applied: true,
        topology: "directional_risk",
        winner: "bear",
        rounds: 2,
        riskRounds: 1,
        terminationReason: "converged",
        confidenceDelta: -0.1,
        actionChanged: true,
        recordId: "rec-1",
      },
    });
    expect(view).toEqual({
      topology: "directional_risk",
      winner: "bear",
      rounds: 2,
      riskRounds: 1,
      terminationReason: "converged",
      confidenceDelta: -0.1,
      actionChanged: true,
    });
  });

  it("tolerates missing optional fields", () => {
    const view = summarizeDebate({ debate: { applied: true, winner: "bull" } });
    expect(view).not.toBeNull();
    expect(view?.winner).toBe("bull");
    expect(view?.riskRounds).toBeNull();
    expect(view?.rounds).toBe(0);
    expect(view?.actionChanged).toBe(false);
  });
});
