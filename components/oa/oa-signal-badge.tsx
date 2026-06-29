import { Badge } from "@/components/ui/badge";
import type { OaProfileAccuracy, OaProfileCalibration } from "@/lib/api/types";

type Props = {
  calibration: OaProfileCalibration | null | undefined;
  accuracy?: OaProfileAccuracy[];
};

function pickWindow(accuracy?: OaProfileAccuracy[]) {
  if (!accuracy?.length) return null;
  return accuracy.find((a) => a.windowDays === 30) ?? accuracy[0];
}

/**
 * Compact Outcome-Aware status chip for the analysis output. While a profile is
 * still NEUTRAL (uncalibrated / too little history) it shows the data it's
 * collecting; once active it shows the calibrator + the profile's hit rate.
 */
export function OaSignalBadge({ calibration, accuracy }: Props) {
  const sampleSize = calibration?.sampleSize ?? 0;
  const isActive =
    calibration != null &&
    calibration.status === "active" &&
    calibration.method !== "none";

  if (!isActive) {
    return (
      <Badge variant="outline" data-testid="oa-signal-badge">
        OA: collecting data ({sampleSize})
      </Badge>
    );
  }

  const win = pickWindow(accuracy);
  const hitPct = win ? Math.round(win.hitRate * 100) : null;
  return (
    <Badge variant="ai" data-testid="oa-signal-badge">
      OA: calibrated · {calibration!.method}
      {hitPct != null ? ` · ${hitPct}% hit` : ""}
    </Badge>
  );
}

/**
 * Chip for the analysis OUTPUT showing the OA decision for THAT forecast (not the
 * profile-level calibrator), read defensively from the run's result.outcomeAware
 * (an untyped JSON record). Renders nothing when OA didn't run on the forecast.
 */
export function OaDecisionBadge({
  decision,
}: {
  decision: Record<string, unknown> | null | undefined;
}) {
  if (!decision || typeof decision !== "object") return null;
  const decisionLabel =
    typeof decision.decision === "string" ? decision.decision : null;
  const calibratedP =
    typeof decision.calibratedP === "number" ? decision.calibratedP : null;
  const gated = decision.minSampleGateTripped === true;

  if (gated || decisionLabel === "neutral") {
    return (
      <Badge variant="outline" data-testid="oa-decision-badge">
        OA: collecting data
      </Badge>
    );
  }
  if (!decisionLabel) return null;
  const p = calibratedP != null ? ` · p ${Math.round(calibratedP * 100)}%` : "";
  return (
    <Badge variant="ai" data-testid="oa-decision-badge">
      OA: {decisionLabel}
      {p}
    </Badge>
  );
}
