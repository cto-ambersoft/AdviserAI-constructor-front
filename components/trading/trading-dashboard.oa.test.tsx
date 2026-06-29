import { describe, expect, it } from "vitest";

import {
  buildPersonalProfilePayload,
  toPersonalProfileForm,
} from "@/components/trading/trading-dashboard";
import type { PersonalAnalysisProfileRead } from "@/lib/api/types";

function profile(
  over: Partial<PersonalAnalysisProfileRead> = {},
): PersonalAnalysisProfileRead {
  return {
    id: 1,
    user_id: 1,
    symbol: "BTCUSDT",
    query_prompt: null,
    agents: {},
    agent_weights: {},
    interval_minutes: 60,
    is_active: true,
    debate_enabled: null,
    oa_enabled: null,
    next_run_at: "",
    last_triggered_at: null,
    last_completed_at: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("personal profile Outcome-Aware wiring (S8)", () => {
  it("maps oa_enabled from the profile into the form (off by default)", () => {
    expect(
      toPersonalProfileForm(null, profile({ oa_enabled: true }), "BTCUSDT").oaEnabled,
    ).toBe(true);
    expect(
      toPersonalProfileForm(null, profile({ oa_enabled: false }), "BTCUSDT").oaEnabled,
    ).toBe(false);
    expect(
      toPersonalProfileForm(null, profile({ oa_enabled: null }), "BTCUSDT").oaEnabled,
    ).toBe(false);
    // a brand-new profile defaults OFF
    expect(toPersonalProfileForm(null, null, "BTCUSDT").oaEnabled).toBe(false);
  });

  it("forwards oaEnabled into the save payload as oa_enabled", () => {
    const on = toPersonalProfileForm(null, profile({ oa_enabled: true }), "BTCUSDT");
    expect(buildPersonalProfilePayload(on).oa_enabled).toBe(true);

    const off = toPersonalProfileForm(null, null, "BTCUSDT");
    expect(buildPersonalProfilePayload(off).oa_enabled).toBe(false);
  });
});
