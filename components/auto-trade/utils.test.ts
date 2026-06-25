import { describe, expect, it } from "vitest";

import {
  buildRiskConfigPayload,
  toAutoTradeForm,
  toRiskForm,
} from "@/components/auto-trade/utils";
import { DEFAULT_RISK_CONFIG } from "@/components/auto-trade/types";

describe("risk-config form mappers — Phase 4 fields (anomaly + promotion gate)", () => {
  it("buildRiskConfigPayload carries all 7 new fields", () => {
    const payload = buildRiskConfigPayload({
      ...DEFAULT_RISK_CONFIG,
      anomaly_detection_enabled: true,
      anomaly_z_threshold: 3.5,
      anomaly_window: 25,
      promote_min_win_rate_pct: 55,
      promote_max_dd_pct: 20,
      promote_min_trades: 30,
      promote_min_sandbox_days: 7,
    });
    expect(payload.anomaly_detection_enabled).toBe(true);
    expect(payload.anomaly_z_threshold).toBe(3.5);
    expect(payload.anomaly_window).toBe(25);
    expect(payload.promote_min_win_rate_pct).toBe(55);
    expect(payload.promote_max_dd_pct).toBe(20);
    expect(payload.promote_min_trades).toBe(30);
    expect(payload.promote_min_sandbox_days).toBe(7);
  });

  it("round-trips toRiskForm(buildRiskConfigPayload(form)) for the new fields", () => {
    const form = {
      ...DEFAULT_RISK_CONFIG,
      anomaly_detection_enabled: true,
      anomaly_z_threshold: 4,
      anomaly_window: 50,
      promote_min_trades: 20,
      promote_min_sandbox_days: 14,
    };
    const back = toRiskForm(buildRiskConfigPayload(form));
    expect(back.anomaly_detection_enabled).toBe(true);
    expect(back.anomaly_z_threshold).toBe(4);
    expect(back.anomaly_window).toBe(50);
    expect(back.promote_min_trades).toBe(20);
    expect(back.promote_min_sandbox_days).toBe(14);
  });

  it("toRiskForm(null) yields defaults with the Phase 4 rules off", () => {
    const form = toRiskForm(null);
    expect(form.anomaly_detection_enabled).toBe(false);
    expect(form.anomaly_z_threshold).toBeNull();
    expect(form.promote_min_trades).toBeNull();
    expect(form.promote_min_sandbox_days).toBeNull();
  });
});

describe("toAutoTradeForm — attached_forecast_id (T16/W12e)", () => {
  it("maps attached_forecast_id from the config", () => {
    const form = toAutoTradeForm({
      attached_forecast_id: "FC-btc-1h-001",
    } as never);
    expect(form.attached_forecast_id).toBe("FC-btc-1h-001");
  });

  it("defaults attached_forecast_id to null when absent", () => {
    const form = toAutoTradeForm(null);
    expect(form.attached_forecast_id).toBeNull();
  });
});
