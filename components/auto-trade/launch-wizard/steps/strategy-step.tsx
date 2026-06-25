import type { Dispatch } from "react";

import { INPUT_CLASS } from "@/components/trading/form-controls";
import type {
  WizardAction,
  WizardData,
} from "@/components/auto-trade/launch-wizard/state";
import type { PersonalAnalysisProfileRead } from "@/lib/api";

/**
 * Step 1 — pick the analysis profile that will drive this strategy's signals
 * and give it a name (UX overhaul T8).
 */
export function StrategyStep({
  data,
  dispatch,
  profiles,
  isLoading,
}: {
  data: WizardData;
  dispatch: Dispatch<WizardAction>;
  profiles: PersonalAnalysisProfileRead[];
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose the analysis profile that generates signals, then name the
        strategy.
      </p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Analysis profile
        </label>
        <select
          className={INPUT_CLASS}
          value={data.profileId ?? ""}
          disabled={isLoading}
          onChange={(event) => {
            const id = Number(event.target.value);
            const profile = profiles.find((p) => p.id === id) ?? null;
            dispatch({
              type: "set",
              patch: {
                profileId: Number.isFinite(id) && id > 0 ? id : undefined,
                strategyName:
                  data.strategyName ||
                  (profile ? `${profile.symbol} strategy` : undefined),
              },
            });
          }}
        >
          <option value="">
            {isLoading
              ? "Loading profiles…"
              : profiles.length
                ? "Select profile"
                : "No profiles available"}
          </option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.symbol}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Strategy name
        </label>
        <input
          className={INPUT_CLASS}
          value={data.strategyName ?? ""}
          placeholder="e.g. BTCUSDT momentum"
          onChange={(event) =>
            dispatch({ type: "set", patch: { strategyName: event.target.value } })
          }
        />
      </div>
    </div>
  );
}
