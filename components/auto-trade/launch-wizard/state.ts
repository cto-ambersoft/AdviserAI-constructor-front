/**
 * Launch wizard state machine (UX overhaul T7). Pure + framework-free so the
 * step flow is unit-testable. The six steps walk a new strategy from selection
 * through sandbox to a live promotion.
 */
export const WIZARD_STEPS = [
  { id: "strategy", title: "Strategy" },
  { id: "backtest", title: "Backtest" },
  { id: "exchange", title: "Exchange" },
  { id: "sandbox", title: "Sandbox" },
  { id: "gate", title: "KPI Gate" },
  { id: "live", title: "Go Live" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export type WizardData = {
  /** Step 1 — chosen personal-analysis profile to drive signals. */
  profileId?: number;
  strategyName?: string;
  /** Step 2 — backtest verdict the user accepted. */
  backtestAccepted?: boolean;
  /** Step 3 — exchange account + sizing. */
  accountId?: number;
  positionSizeUsdt?: number;
  /** Step 4 — config created + started in sandbox. */
  configId?: number;
  /** Step 6 — promoted to live. */
  promoted?: boolean;
};

export type WizardState = {
  stepIndex: number;
  data: WizardData;
};

export type WizardAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; index: number }
  | { type: "set"; patch: Partial<WizardData> };

const LAST = WIZARD_STEPS.length - 1;

const clamp = (index: number) => Math.max(0, Math.min(LAST, index));

export function initialWizardState(): WizardState {
  return { stepIndex: 0, data: {} };
}

/**
 * Whether the user may advance past `stepId` given the data gathered so far.
 * Pure so the Next-button gate is unit-testable. Steps with their own terminal
 * action (gate/live) never block forward navigation here.
 */
export function canLeaveStep(stepId: WizardStepId, data: WizardData): boolean {
  switch (stepId) {
    case "strategy":
      return data.profileId != null;
    case "backtest":
      return data.backtestAccepted === true;
    case "exchange":
      return data.accountId != null && (data.positionSizeUsdt ?? 0) > 0;
    case "sandbox":
      return data.configId != null;
    case "gate":
    case "live":
      return true;
    default:
      return true;
  }
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "next":
      return { ...state, stepIndex: clamp(state.stepIndex + 1) };
    case "back":
      return { ...state, stepIndex: clamp(state.stepIndex - 1) };
    case "goto":
      return { ...state, stepIndex: clamp(action.index) };
    case "set": {
      const patch = action.patch;
      const data: WizardData = { ...state.data, ...patch };
      // Cascade: editing an upstream identity field invalidates everything
      // derived from it, so the user can't promote a config that no longer
      // matches their selections (review #1).
      const profileChanged =
        "profileId" in patch && patch.profileId !== state.data.profileId;
      const sizingChanged =
        ("accountId" in patch && patch.accountId !== state.data.accountId) ||
        ("positionSizeUsdt" in patch &&
          patch.positionSizeUsdt !== state.data.positionSizeUsdt);
      if (profileChanged) {
        data.backtestAccepted = undefined;
      }
      if (profileChanged || sizingChanged) {
        data.configId = undefined;
        data.promoted = undefined;
      }
      return { ...state, data };
    }
    default:
      return state;
  }
}
