import { describe, expect, it } from "vitest";

import { deriveHealthTone, HEALTH_LABEL } from "@/lib/health";

describe("deriveHealthTone", () => {
  it("maps healthy statuses to ok", () => {
    expect(deriveHealthTone("ok")).toBe("ok");
    expect(deriveHealthTone("OK")).toBe("ok");
    expect(deriveHealthTone("healthy")).toBe("ok");
    expect(deriveHealthTone("up")).toBe("ok");
  });

  it("maps degraded/partial statuses to warn", () => {
    expect(deriveHealthTone("degraded")).toBe("warn");
    expect(deriveHealthTone("warning")).toBe("warn");
    expect(deriveHealthTone("partial")).toBe("warn");
  });

  it("treats unknown, empty and missing statuses as error", () => {
    expect(deriveHealthTone("down")).toBe("error");
    expect(deriveHealthTone("")).toBe("error");
    expect(deriveHealthTone(null)).toBe("error");
    expect(deriveHealthTone(undefined)).toBe("error");
    expect(deriveHealthTone("something-weird")).toBe("error");
  });

  it("has a label for every tone", () => {
    expect(HEALTH_LABEL.ok.length).toBeGreaterThan(0);
    expect(HEALTH_LABEL.warn.length).toBeGreaterThan(0);
    expect(HEALTH_LABEL.error.length).toBeGreaterThan(0);
  });
});
