import { describe, expect, it } from "vitest";

import { summarizeAgentAccuracy } from "@/components/auto-trade/agent-accuracy-utils";
import type { AgentAccuracyMetric } from "@/lib/api/services/ai-backtests";

function metric(over: Partial<AgentAccuracyMetric>): AgentAccuracyMetric {
  return {
    agentKey: "tw",
    windowDays: 7,
    hitRate: 0.5,
    meanEdge: 0,
    sampleSize: 0,
    ...over,
  } as AgentAccuracyMetric;
}

describe("summarizeAgentAccuracy (T17/W12f)", () => {
  it("rolls up 7d and 30d per (config, agent)", () => {
    const rows = summarizeAgentAccuracy([
      metric({ aiConfigId: "C1", agentKey: "tw", windowDays: 7, hitRate: 0.8, sampleSize: 10 }),
      metric({ aiConfigId: "C1", agentKey: "tw", windowDays: 30, hitRate: 0.6, sampleSize: 40 }),
      metric({ aiConfigId: "C1", agentKey: "news", windowDays: 7, hitRate: 0.5, sampleSize: 5 }),
    ]);
    expect(rows.map((r) => r.agentKey)).toEqual(["news", "tw"]);
    const tw = rows.find((r) => r.agentKey === "tw")!;
    expect(tw.hitRate7d).toBe(0.8);
    expect(tw.hitRate30d).toBe(0.6);
    expect(tw.sampleSize7d).toBe(10);
    expect(tw.sampleSize30d).toBe(40);
  });

  it("keeps the same agent in different configs as separate rows (I7)", () => {
    const rows = summarizeAgentAccuracy([
      metric({ aiConfigId: "C1", agentKey: "tw", windowDays: 7, hitRate: 0.9, sampleSize: 20 }),
      metric({ aiConfigId: "C2", agentKey: "tw", windowDays: 7, hitRate: 0.3, sampleSize: 4 }),
    ]);
    expect(rows).toHaveLength(2);
    const c1 = rows.find((r) => r.aiConfigId === "C1")!;
    const c2 = rows.find((r) => r.aiConfigId === "C2")!;
    expect(c1.hitRate7d).toBe(0.9);
    expect(c1.sampleSize7d).toBe(20);
    expect(c2.hitRate7d).toBe(0.3);
    expect(c2.sampleSize7d).toBe(4);
  });

  it("returns [] for no metrics", () => {
    expect(summarizeAgentAccuracy([])).toEqual([]);
  });
});
