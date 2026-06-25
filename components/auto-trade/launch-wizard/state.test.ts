import { describe, expect, it } from "vitest";

import {
  WIZARD_STEPS,
  canLeaveStep,
  initialWizardState,
  wizardReducer,
} from "@/components/auto-trade/launch-wizard/state";

describe("wizardReducer", () => {
  it("starts on the first step with empty data", () => {
    const s = initialWizardState();
    expect(s.stepIndex).toBe(0);
    expect(WIZARD_STEPS[s.stepIndex].id).toBe("strategy");
    expect(s.data).toEqual({});
  });

  it("advances and clamps at the last step", () => {
    let s = initialWizardState();
    for (let i = 0; i < WIZARD_STEPS.length + 3; i++) {
      s = wizardReducer(s, { type: "next" });
    }
    expect(s.stepIndex).toBe(WIZARD_STEPS.length - 1);
  });

  it("goes back and clamps at the first step", () => {
    let s = { ...initialWizardState(), stepIndex: 2 };
    s = wizardReducer(s, { type: "back" });
    expect(s.stepIndex).toBe(1);
    s = wizardReducer(s, { type: "back" });
    s = wizardReducer(s, { type: "back" });
    expect(s.stepIndex).toBe(0);
  });

  it("persists field updates across navigation", () => {
    let s = initialWizardState();
    s = wizardReducer(s, { type: "set", patch: { accountId: 7 } });
    s = wizardReducer(s, { type: "next" });
    s = wizardReducer(s, { type: "set", patch: { positionSizeUsdt: 100 } });
    s = wizardReducer(s, { type: "back" });
    expect(s.data.accountId).toBe(7);
    expect(s.data.positionSizeUsdt).toBe(100);
  });

  it("jumps to a clamped step via goto", () => {
    let s = initialWizardState();
    s = wizardReducer(s, { type: "goto", index: 99 });
    expect(s.stepIndex).toBe(WIZARD_STEPS.length - 1);
    s = wizardReducer(s, { type: "goto", index: -5 });
    expect(s.stepIndex).toBe(0);
  });
});

describe("wizardReducer set cascade", () => {
  const SEEDED = {
    profileId: 1,
    backtestAccepted: true,
    accountId: 5,
    positionSizeUsdt: 100,
    configId: 77,
    promoted: false,
  };

  it("clears backtest acceptance + config when the profile changes", () => {
    const s = wizardReducer(
      { stepIndex: 3, data: { ...SEEDED } },
      { type: "set", patch: { profileId: 2 } },
    );
    expect(s.data.profileId).toBe(2);
    expect(s.data.backtestAccepted).toBeUndefined();
    expect(s.data.configId).toBeUndefined();
  });

  it("clears the config when the account changes", () => {
    const s = wizardReducer(
      { stepIndex: 3, data: { ...SEEDED } },
      { type: "set", patch: { accountId: 9 } },
    );
    expect(s.data.accountId).toBe(9);
    expect(s.data.configId).toBeUndefined();
    // an upstream identity change does not wipe the (still-valid) backtest accept
    expect(s.data.backtestAccepted).toBe(true);
  });

  it("clears the config when the position size changes", () => {
    const s = wizardReducer(
      { stepIndex: 3, data: { ...SEEDED } },
      { type: "set", patch: { positionSizeUsdt: 250 } },
    );
    expect(s.data.configId).toBeUndefined();
  });

  it("does not cascade when re-selecting the same upstream value", () => {
    const s = wizardReducer(
      { stepIndex: 3, data: { ...SEEDED } },
      { type: "set", patch: { profileId: 1 } },
    );
    expect(s.data.backtestAccepted).toBe(true);
    expect(s.data.configId).toBe(77);
  });

  it("does not cascade on derived-field updates (accept / configId / name)", () => {
    let s = wizardReducer(
      { stepIndex: 1, data: { profileId: 1, configId: 77 } },
      { type: "set", patch: { backtestAccepted: true } },
    );
    expect(s.data.configId).toBe(77);
    s = wizardReducer(s, { type: "set", patch: { strategyName: "x" } });
    expect(s.data.configId).toBe(77);
  });
});

describe("canLeaveStep", () => {
  it("blocks strategy until a profile is chosen", () => {
    expect(canLeaveStep("strategy", {})).toBe(false);
    expect(canLeaveStep("strategy", { profileId: 1 })).toBe(true);
  });

  it("blocks backtest until the result is accepted", () => {
    expect(canLeaveStep("backtest", {})).toBe(false);
    expect(canLeaveStep("backtest", { backtestAccepted: true })).toBe(true);
  });

  it("blocks exchange until account + positive size are set", () => {
    expect(canLeaveStep("exchange", { accountId: 3 })).toBe(false);
    expect(canLeaveStep("exchange", { accountId: 3, positionSizeUsdt: 0 })).toBe(false);
    expect(canLeaveStep("exchange", { accountId: 3, positionSizeUsdt: 50 })).toBe(true);
  });

  it("blocks sandbox until a config has been created", () => {
    expect(canLeaveStep("sandbox", {})).toBe(false);
    expect(canLeaveStep("sandbox", { configId: 9 })).toBe(true);
  });

  it("never blocks the terminal gate/live steps", () => {
    expect(canLeaveStep("gate", {})).toBe(true);
    expect(canLeaveStep("live", {})).toBe(true);
  });
});
