"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  WIZARD_STEPS,
  canLeaveStep,
  initialWizardState,
  wizardReducer,
} from "@/components/auto-trade/launch-wizard/state";
import { WizardStepper } from "@/components/auto-trade/launch-wizard/stepper";
import { StrategyStep } from "@/components/auto-trade/launch-wizard/steps/strategy-step";
import { BacktestStep } from "@/components/auto-trade/launch-wizard/steps/backtest-step";
import { ExchangeStep } from "@/components/auto-trade/launch-wizard/steps/exchange-step";
import { SandboxStep } from "@/components/auto-trade/launch-wizard/steps/sandbox-step";
import { GateStep } from "@/components/auto-trade/launch-wizard/steps/gate-step";
import { LiveStep } from "@/components/auto-trade/launch-wizard/steps/live-step";
import {
  ApiError,
  getPromotionStatus,
  listExchangeAccounts,
  listPersonalAnalysisProfiles,
  promoteStrategy,
  type ExchangeAccountRead,
  type PersonalAnalysisProfileRead,
} from "@/lib/api";
import type { PromotionStatusRead } from "@/lib/api/types";
import { notifyError, notifySuccess } from "@/lib/notifications";

/**
 * Guided launch flow for a new strategy (UX overhaul T7+). The shell owns the
 * step machine, shared data (profiles/accounts), and Next gating; each step
 * body collects its slice of the wizard data.
 */
export function LaunchWizard() {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    wizardReducer,
    undefined,
    initialWizardState,
  );
  const [profiles, setProfiles] = useState<PersonalAnalysisProfileRead[]>([]);
  const [accounts, setAccounts] = useState<ExchangeAccountRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    const [profilesRes, accountsRes] = await Promise.allSettled([
      listPersonalAnalysisProfiles(),
      listExchangeAccounts(),
    ]);
    if (!mountedRef.current) return;
    if (profilesRes.status === "fulfilled") setProfiles(profilesRes.value);
    if (accountsRes.status === "fulfilled") setAccounts(accountsRes.value);
    // Surface a fetch failure instead of silently showing an empty list (#4).
    if (profilesRes.status === "rejected" || accountsRes.status === "rejected") {
      setLoadFailed(true);
      notifyError("Couldn't load profiles or accounts. Please retry.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const [promotion, setPromotion] = useState<PromotionStatusRead | null>(null);
  const [isPromotionLoading, setIsPromotionLoading] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  const step = WIZARD_STEPS[state.stepIndex];
  const isFirst = state.stepIndex === 0;
  const isLast = state.stepIndex === WIZARD_STEPS.length - 1;
  const canAdvance = canLeaveStep(step.id, state.data);

  const configId = state.data.configId ?? null;
  const onGateOrLive = step.id === "gate" || step.id === "live";

  const loadPromotion = useCallback(async () => {
    if (configId == null) return;
    setIsPromotionLoading(true);
    try {
      setPromotion(await getPromotionStatus(configId));
    } catch {
      // Background poll — degrade to "unavailable" rather than crashing (#5).
      setPromotion(null);
    } finally {
      setIsPromotionLoading(false);
    }
  }, [configId]);

  useEffect(() => {
    if (onGateOrLive && configId != null) {
      void loadPromotion();
    }
  }, [onGateOrLive, configId, loadPromotion]);

  const handlePromote = useCallback(async () => {
    if (configId == null) return;
    setIsPromoting(true);
    try {
      await promoteStrategy(configId);
      dispatch({ type: "set", patch: { promoted: true } });
      notifySuccess("Strategy promoted to live.");
      void loadPromotion();
    } catch (error) {
      // Any failure (API or transport) surfaces as a toast, never an unhandled
      // rejection (#5).
      notifyError(
        error instanceof ApiError && error.message
          ? error.message
          : "Failed to promote strategy.",
      );
    } finally {
      setIsPromoting(false);
    }
  }, [configId, loadPromotion]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">New strategy</h1>
        <Button variant="ghost" onClick={() => router.push("/auto-trade")}>
          Cancel
        </Button>
      </div>

      <WizardStepper steps={WIZARD_STEPS} current={state.stepIndex} />

      {loadFailed ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-sm border border-destructive/35 bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive">
            Couldn&apos;t load profiles or accounts.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={isLoading}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <Card className="border-border/90 bg-card/90 shadow-none">
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {step.id === "strategy" ? (
            <StrategyStep
              data={state.data}
              dispatch={dispatch}
              profiles={profiles}
              isLoading={isLoading}
            />
          ) : step.id === "backtest" ? (
            <BacktestStep
              data={state.data}
              dispatch={dispatch}
              profiles={profiles}
            />
          ) : step.id === "exchange" ? (
            <ExchangeStep
              data={state.data}
              dispatch={dispatch}
              accounts={accounts}
              isLoading={isLoading}
            />
          ) : step.id === "sandbox" ? (
            <SandboxStep data={state.data} dispatch={dispatch} />
          ) : step.id === "gate" ? (
            <GateStep
              promotion={promotion}
              isLoading={isPromotionLoading}
              onRefresh={() => void loadPromotion()}
            />
          ) : (
            <LiveStep
              canPromote={promotion?.can_promote === true}
              isPromoting={isPromoting}
              promoted={state.data.promoted === true}
              onPromote={() => void handlePromote()}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => dispatch({ type: "back" })}
          disabled={isFirst}
        >
          Back
        </Button>
        {isLast ? (
          <Button onClick={() => router.push("/auto-trade")}>Finish</Button>
        ) : (
          <Button
            onClick={() => dispatch({ type: "next" })}
            disabled={!canAdvance}
          >
            Next
          </Button>
        )}
      </div>
    </main>
  );
}
