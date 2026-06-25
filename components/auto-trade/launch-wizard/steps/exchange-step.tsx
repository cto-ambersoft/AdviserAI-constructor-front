import type { Dispatch } from "react";
import Link from "next/link";

import { INPUT_CLASS } from "@/components/trading/form-controls";
import { isSupportedAutoTradeExchange } from "@/components/auto-trade/utils";
import type {
  WizardAction,
  WizardData,
} from "@/components/auto-trade/launch-wizard/state";
import type { ExchangeAccountRead } from "@/lib/api";

// Real-money sizing guardrails (review #2): reject absurd values and warn below
// the typical exchange minimum notional.
const MAX_POSITION_USDT = 1_000_000;
const MIN_NOTIONAL_USDT = 100;

/**
 * Step 3 — choose the exchange sub-account and position size (UX overhaul T9).
 * If no supported account is connected, the step links out to Connect Exchange
 * and the wizard stays blocked until one exists.
 */
export function ExchangeStep({
  data,
  dispatch,
  accounts,
  isLoading,
}: {
  data: WizardData;
  dispatch: Dispatch<WizardAction>;
  accounts: ExchangeAccountRead[];
  isLoading: boolean;
}) {
  const supported = accounts.filter(isSupportedAutoTradeExchange);
  const selected = supported.find((a) => a.id === data.accountId) ?? null;
  const isReal = selected?.mode === "real";

  if (!isLoading && supported.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No supported exchange account is connected yet.
        </p>
        <Link
          href="/settings/connect-exchange"
          className="text-sm font-medium text-primary hover:underline"
        >
          Connect an exchange →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Exchange account
        </label>
        <select
          className={INPUT_CLASS}
          value={data.accountId ?? ""}
          disabled={isLoading}
          onChange={(event) => {
            const id = Number(event.target.value);
            dispatch({
              type: "set",
              patch: { accountId: Number.isFinite(id) && id > 0 ? id : undefined },
            });
          }}
        >
          <option value="">Select account</option>
          {supported.map((account) => (
            <option key={account.id} value={account.id}>
              {account.account_label} · {account.exchange_name} / {account.mode}
            </option>
          ))}
        </select>
        {isReal ? (
          <p className="text-xs text-amber-300">
            Sandbox validation runs on demo accounts. On this real account the
            strategy won&apos;t place orders until you promote it to live.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Position size (USDT margin)
        </label>
        <input
          className={INPUT_CLASS}
          type="number"
          min={1}
          max={MAX_POSITION_USDT}
          value={data.positionSizeUsdt ?? ""}
          placeholder="e.g. 100"
          onChange={(event) => {
            const value = Number(event.target.value);
            const valid =
              Number.isFinite(value) && value > 0 && value <= MAX_POSITION_USDT;
            dispatch({
              type: "set",
              patch: { positionSizeUsdt: valid ? value : undefined },
            });
          }}
        />
        {data.positionSizeUsdt != null &&
        data.positionSizeUsdt < MIN_NOTIONAL_USDT ? (
          <p className="text-xs text-amber-300">
            Most pairs require ≥ {MIN_NOTIONAL_USDT} USDT notional; smaller
            orders may be rejected by the exchange.
          </p>
        ) : null}
      </div>
    </div>
  );
}
