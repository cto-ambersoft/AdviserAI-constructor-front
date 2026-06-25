import { describe, expect, it } from "vitest";

import { isStepUpGated } from "@/lib/api/step-up";

describe("isStepUpGated", () => {
  it("gates the static exact paths", () => {
    expect(isStepUpGated("POST", "/api/v1/live/auto-trade/play")).toBe(true);
    expect(isStepUpGated("PUT", "/api/v1/live/auto-trade/config")).toBe(true);
    expect(isStepUpGated("POST", "/api/v1/exchange/accounts")).toBe(true);
    expect(isStepUpGated("DELETE", "/api/v1/auth/2fa")).toBe(true);
  });

  it("gates promote/demote with a dynamic config_id segment", () => {
    expect(
      isStepUpGated("POST", "/api/v1/live/auto-trade/strategies/42/promote"),
    ).toBe(true);
    expect(
      isStepUpGated("POST", "/api/v1/live/auto-trade/strategies/7/demote"),
    ).toBe(true);
  });

  it("gates change/delete of an exchange API key (dynamic account_id) — T3/S1,S2", () => {
    expect(isStepUpGated("PATCH", "/api/v1/exchange/accounts/5")).toBe(true);
    expect(isStepUpGated("DELETE", "/api/v1/exchange/accounts/12")).toBe(true);
    // reads / validate are not gated
    expect(isStepUpGated("GET", "/api/v1/exchange/accounts/5")).toBe(false);
    expect(
      isStepUpGated("POST", "/api/v1/exchange/accounts/5/validate"),
    ).toBe(false);
    // non-numeric id must not match
    expect(isStepUpGated("PATCH", "/api/v1/exchange/accounts/abc")).toBe(false);
  });

  it("gates applying an agent-weight suggestion (dynamic ai_config_id) — T17/W12f", () => {
    expect(
      isStepUpGated(
        "POST",
        "/api/v1/ai-backtests/agent-weights/suggestions/AC-123/apply",
      ),
    ).toBe(true);
    // the read (suggestion preview) is not gated
    expect(
      isStepUpGated(
        "GET",
        "/api/v1/ai-backtests/agent-weights/suggestions/AC-123",
      ),
    ).toBe(false);
  });

  it("ignores the query string when matching", () => {
    expect(
      isStepUpGated(
        "POST",
        "/api/v1/live/auto-trade/strategies/42/promote?account_id=3",
      ),
    ).toBe(true);
  });

  it("is method-sensitive and case-insensitive on the method", () => {
    expect(
      isStepUpGated("post", "/api/v1/live/auto-trade/strategies/42/promote"),
    ).toBe(true);
    expect(
      isStepUpGated("GET", "/api/v1/live/auto-trade/strategies/42/promote"),
    ).toBe(false);
  });

  it("does NOT gate look-alike paths (non-numeric id, status route, prefixes)", () => {
    // config_id must be digits.
    expect(
      isStepUpGated("POST", "/api/v1/live/auto-trade/strategies/abc/promote"),
    ).toBe(false);
    // promotion-status is a read, not gated.
    expect(
      isStepUpGated(
        "GET",
        "/api/v1/live/auto-trade/strategies/42/promotion-status",
      ),
    ).toBe(false);
    // anchored — no trailing-segment bypass.
    expect(
      isStepUpGated(
        "POST",
        "/api/v1/live/auto-trade/strategies/42/promote/extra",
      ),
    ).toBe(false);
    expect(isStepUpGated("GET", "/api/v1/live/auto-trade/portfolio")).toBe(
      false,
    );
  });
});
