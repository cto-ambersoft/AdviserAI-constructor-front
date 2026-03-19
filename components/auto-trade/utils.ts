import type {
  AutoTradeConfigRead,
  ExchangeAccountRead,
} from "@/lib/api";
import type {
  AutoTradeFormState,
  AutoTradeFormValidation,
} from "@/components/auto-trade/types";

const RISK_MODE_PATTERN = /^1\s*:\s*([0-9]+(?:[.,][0-9]+)?)$/;

export function toAutoTradeForm(config: AutoTradeConfigRead | null): AutoTradeFormState {
  return {
    enabled: config?.enabled ?? false,
    profile_id: config?.profile_id ?? null,
    account_id: config?.account_id ?? null,
    position_size_usdt: config?.position_size_usdt ?? 100,
    leverage: config?.leverage ?? 1,
    min_confidence_pct: config?.min_confidence_pct ?? 62,
    fast_close_confidence_pct: config?.fast_close_confidence_pct ?? 80,
    confirm_reports_required: config?.confirm_reports_required ?? 2,
    risk_mode: config?.risk_mode ?? "1:2",
    sl_pct: config?.sl_pct ?? 1,
    tp_pct: config?.tp_pct ?? 2,
  };
}

export function parseRiskModeRatio(value: string): number | null {
  const normalized = value.trim();
  const match = RISK_MODE_PATTERN.exec(normalized);
  if (!match) {
    return null;
  }
  const ratio = Number(match[1].replace(",", "."));
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return null;
  }
  return ratio;
}

export function normalizeRiskMode(value: string): string {
  const ratio = parseRiskModeRatio(value);
  return ratio === null ? value.trim() : `1:${ratio}`;
}

export function isSupportedAutoTradeExchange(account: ExchangeAccountRead): boolean {
  const exchange = account.exchange_name.trim().toLowerCase();
  return exchange === "bybit" || exchange === "binance";
}

export function getAutoTradeValidation(
  form: AutoTradeFormState,
  selectedAccount: ExchangeAccountRead | null,
): AutoTradeFormValidation {
  if (!form.profile_id || form.profile_id <= 0) {
    return { isValid: false, message: "Select a personal-analysis profile." };
  }
  if (!form.account_id || form.account_id <= 0) {
    return { isValid: false, message: "Select an exchange account." };
  }
  if (!selectedAccount) {
    return { isValid: false, message: "Selected account was not found." };
  }
  if (!isSupportedAutoTradeExchange(selectedAccount)) {
    return {
      isValid: false,
      message: "Auto-trade futures v1 supports only Bybit and Binance.",
    };
  }
  if (!(form.position_size_usdt > 0)) {
    return { isValid: false, message: "position_size_usdt must be greater than 0." };
  }
  if (!Number.isInteger(Math.round(form.leverage)) || form.leverage < 1 || form.leverage > 125) {
    return { isValid: false, message: "leverage must be in range [1..125]." };
  }
  if (form.min_confidence_pct < 0 || form.min_confidence_pct > 100) {
    return { isValid: false, message: "min_confidence_pct must be in range [0..100]." };
  }
  if (
    form.fast_close_confidence_pct < 0 ||
    form.fast_close_confidence_pct > 100
  ) {
    return {
      isValid: false,
      message: "fast_close_confidence_pct must be in range [0..100].",
    };
  }
  if (form.fast_close_confidence_pct < form.min_confidence_pct) {
    return {
      isValid: false,
      message:
        "fast_close_confidence_pct must be greater than or equal to min_confidence_pct.",
    };
  }
  if (
    !Number.isInteger(Math.round(form.confirm_reports_required)) ||
    form.confirm_reports_required < 1 ||
    form.confirm_reports_required > 5
  ) {
    return {
      isValid: false,
      message: "confirm_reports_required must be in range [1..5].",
    };
  }
  if (!(form.sl_pct > 0) || !(form.tp_pct > 0)) {
    return { isValid: false, message: "sl_pct and tp_pct must be greater than 0." };
  }

  const expectedRatio = parseRiskModeRatio(form.risk_mode);
  if (expectedRatio === null) {
    return {
      isValid: false,
      message: 'risk_mode must match "1:X" format (example: 1:2.5).',
    };
  }
  const actualRatio = form.tp_pct / form.sl_pct;
  if (Math.abs(actualRatio - expectedRatio) > 0.01) {
    return {
      isValid: false,
      message: `tp_pct/sl_pct must match risk_mode 1:${expectedRatio}.`,
    };
  }

  return { isValid: true, message: "" };
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
