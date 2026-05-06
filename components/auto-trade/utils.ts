import type {
  AutoTradeConfigRead,
  ExchangeAccountRead,
  StrategyProfileConfig,
  StrategyProfileTPLevel,
} from "@/lib/api";
import type {
  AdjustmentSource,
  AutoTradeFormState,
  AutoTradeFormValidation,
  AutoTradeStrategyProfileFormState,
  AutoTradeTPLevelFormState,
  SlMode,
  TpMode,
} from "@/components/auto-trade/types";
import {
  ADJUSTMENT_SOURCES,
  DEFAULT_STRATEGY_PROFILE,
} from "@/components/auto-trade/types";

const RISK_MODE_PATTERN = /^1\s*:\s*([0-9]+(?:[.,][0-9]+)?)$/;
const MOVE_SL_TO_PATTERN = /^tp([1-9]\d*)$/;

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function toSlMode(value: unknown): SlMode {
  if (value === "atr" || value === "percentage" || value === "fixed") {
    return value;
  }
  return DEFAULT_STRATEGY_PROFILE.sl_mode;
}

function toTpMode(value: unknown): TpMode {
  return value === "multi" ? "multi" : "single";
}

function toAdjustmentPriority(value: unknown): AdjustmentSource[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_STRATEGY_PROFILE.adjustment_priority];
  }
  const seen = new Set<AdjustmentSource>();
  const result: AdjustmentSource[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const normalized = raw.trim().toLowerCase();
    if (
      (normalized === "watcher" ||
        normalized === "trailing" ||
        normalized === "breakeven" ||
        normalized === "volatility") &&
      !seen.has(normalized)
    ) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result.length > 0
    ? result
    : [...DEFAULT_STRATEGY_PROFILE.adjustment_priority];
}

function toTPLevelForm(
  level: StrategyProfileTPLevel,
  context?: {
    allLevels?: StrategyProfileTPLevel[];
    selfIndex?: number;
  },
): AutoTradeTPLevelFormState {
  const moveSlToRaw =
    typeof level.move_sl_to === "string" && level.move_sl_to.length > 0
      ? level.move_sl_to
      : null;
  const lockFromServer =
    typeof level.sl_lock_pct === "number" && Number.isFinite(level.sl_lock_pct)
      ? level.sl_lock_pct
      : null;
  // Prefer the new numeric field. Otherwise derive a sane lock_pct from
  // legacy `move_sl_to` so the modal can render it as a real preset.
  const sl_lock_pct =
    lockFromServer !== null
      ? lockFromServer
      : deriveLockPctFromLegacy(moveSlToRaw, context);
  return {
    price_offset_pct: toFiniteNumber(level.price_offset_pct, 1),
    close_pct: toFiniteNumber(level.close_pct, 100),
    sl_lock_pct,
    move_sl_to: moveSlToRaw,
  };
}

function deriveLockPctFromLegacy(
  moveSlTo: string | null,
  context: { allLevels?: StrategyProfileTPLevel[]; selfIndex?: number } | undefined,
): number | null {
  if (!moveSlTo) return null;
  const normalized = moveSlTo.trim().toLowerCase();
  if (normalized === "breakeven") return 0;
  const tpMatch = /^tp([1-9]\d*)$/.exec(normalized);
  if (!tpMatch) return null;
  const refIndex = Number.parseInt(tpMatch[1], 10) - 1;
  const levels = context?.allLevels;
  const selfIndex = context?.selfIndex;
  if (
    levels === undefined ||
    selfIndex === undefined ||
    refIndex < 0 ||
    refIndex >= levels.length ||
    selfIndex < 0 ||
    selfIndex >= levels.length
  ) {
    return null;
  }
  const refOffset = toFiniteNumber(levels[refIndex].price_offset_pct, 0);
  const selfOffset = toFiniteNumber(levels[selfIndex].price_offset_pct, 0);
  if (selfOffset <= 0) return null;
  // SL → tp_ref price ⇔ lock_pct = ref_offset / self_offset × 100
  return Math.max(0, Math.min(200, (refOffset / selfOffset) * 100));
}

function toStrategyProfileForm(
  profile: StrategyProfileConfig | null | undefined,
): AutoTradeStrategyProfileFormState {
  if (!profile) {
    return { ...DEFAULT_STRATEGY_PROFILE, tp_levels: [] };
  }
  return {
    enabled: true,
    sl_mode: toSlMode(profile.sl_mode),
    sl_value: toFiniteNumber(profile.sl_value, DEFAULT_STRATEGY_PROFILE.sl_value),
    tp_mode: toTpMode(profile.tp_mode),
    tp_value: toFiniteNumber(profile.tp_value, DEFAULT_STRATEGY_PROFILE.tp_value),
    tp_levels: Array.isArray(profile.tp_levels)
      ? profile.tp_levels.map((level, index) =>
          toTPLevelForm(level, {
            allLevels: profile.tp_levels ?? [],
            selfIndex: index,
          }),
        )
      : [],
    trailing_enabled: toBoolean(
      profile.trailing_enabled,
      DEFAULT_STRATEGY_PROFILE.trailing_enabled,
    ),
    trailing_callback_rate: toFiniteNumber(
      profile.trailing_callback_rate,
      DEFAULT_STRATEGY_PROFILE.trailing_callback_rate,
    ),
    breakeven_enabled: toBoolean(
      profile.breakeven_enabled,
      DEFAULT_STRATEGY_PROFILE.breakeven_enabled,
    ),
    breakeven_trigger_rr: toFiniteNumber(
      profile.breakeven_trigger_rr,
      DEFAULT_STRATEGY_PROFILE.breakeven_trigger_rr,
    ),
    volatility_sl_enabled: toBoolean(
      profile.volatility_sl_enabled,
      DEFAULT_STRATEGY_PROFILE.volatility_sl_enabled,
    ),
    volatility_atr_period: toFiniteNumber(
      profile.volatility_atr_period,
      DEFAULT_STRATEGY_PROFILE.volatility_atr_period,
    ),
    volatility_atr_multiplier: toFiniteNumber(
      profile.volatility_atr_multiplier,
      DEFAULT_STRATEGY_PROFILE.volatility_atr_multiplier,
    ),
    adjustment_priority: toAdjustmentPriority(profile.adjustment_priority),
    max_position_pct: toFiniteNumber(
      profile.max_position_pct,
      DEFAULT_STRATEGY_PROFILE.max_position_pct,
    ),
    allow_sl_widen: toBoolean(
      profile.allow_sl_widen,
      DEFAULT_STRATEGY_PROFILE.allow_sl_widen,
    ),
  };
}

/**
 * Legacy fields the form still surfaces but the backend no longer persists.
 * Kept as `unknown` for backward-compat with stale config payloads.
 */
type LegacyAutoTradeReadFields = {
  signal_source?: "analysis" | "strategy_atr_block";
  strategy_id?: number | null;
  strategy_overrides?: Record<string, unknown>;
  timeframe?: string;
  bars?: number;
  poll_interval_seconds?: number;
};

export function toAutoTradeForm(config: AutoTradeConfigRead | null): AutoTradeFormState {
  const legacy = (config ?? {}) as LegacyAutoTradeReadFields;
  const overrides = legacy.strategy_overrides as
    | Partial<Record<"ema_period" | "atr_period" | "impulse_atr" | "ob_buffer_atr", unknown>>
    | undefined;
  const strategyProfile = (config?.strategy_profile ?? null) as
    | StrategyProfileConfig
    | null;

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
    signal_source: legacy.signal_source ?? "analysis",
    strategy_id: legacy.strategy_id ?? null,
    strategy_overrides: {
      ema_period: toNullableNumber(overrides?.ema_period),
      atr_period: toNullableNumber(overrides?.atr_period),
      impulse_atr: toNullableNumber(overrides?.impulse_atr),
      ob_buffer_atr: toNullableNumber(overrides?.ob_buffer_atr),
    },
    timeframe: legacy.timeframe ?? "1h",
    bars: legacy.bars ?? 500,
    poll_interval_seconds: legacy.poll_interval_seconds ?? 60,
    strategy_profile: toStrategyProfileForm(strategyProfile),
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


export function validateMoveSlTo(value: string | null): boolean {
  if (value === null) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized === "breakeven") return true;
  return MOVE_SL_TO_PATTERN.test(normalized);
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
  if (!form.timeframe.trim()) {
    return { isValid: false, message: "timeframe is required." };
  }
  if (!Number.isInteger(form.bars) || form.bars < 100 || form.bars > 20_000) {
    return { isValid: false, message: "bars must be in range [100..20000]." };
  }
  if (
    !Number.isInteger(form.poll_interval_seconds) ||
    form.poll_interval_seconds < 15 ||
    form.poll_interval_seconds > 3600
  ) {
    return {
      isValid: false,
      message: "poll_interval_seconds must be in range [15..3600].",
    };
  }
  if (form.signal_source === "strategy_atr_block") {
    if (!form.strategy_id || form.strategy_id <= 0) {
      return {
        isValid: false,
        message: "Select ATR strategy when signal source is ATR Strategy.",
      };
    }
    const overrides = form.strategy_overrides;
    const checks: Array<[number | null, string]> = [
      [overrides.ema_period, "ema_period"],
      [overrides.atr_period, "atr_period"],
      [overrides.impulse_atr, "impulse_atr"],
      [overrides.ob_buffer_atr, "ob_buffer_atr"],
    ];
    for (const [value, key] of checks) {
      if (value === null) {
        continue;
      }
      if (!Number.isFinite(value) || value <= 0) {
        return {
          isValid: false,
          message: `${key} override must be greater than 0.`,
        };
      }
    }
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

  if (form.strategy_profile.enabled) {
    const profileError = validateStrategyProfile(form.strategy_profile);
    if (profileError) {
      return { isValid: false, message: profileError };
    }
  }

  return { isValid: true, message: "" };
}

function validateStrategyProfile(
  profile: AutoTradeStrategyProfileFormState,
): string | null {
  if (!(profile.sl_value > 0)) {
    return "Strategy profile: sl_value must be > 0.";
  }
  if (profile.tp_mode === "single") {
    if (!(profile.tp_value > 0)) {
      return "Strategy profile: tp_value must be > 0 when tp_mode='single'.";
    }
  } else {
    if (profile.tp_levels.length === 0) {
      return "Strategy profile: tp_levels is required when tp_mode='multi'.";
    }
    for (const [index, level] of profile.tp_levels.entries()) {
      if (!(level.price_offset_pct > 0)) {
        return `TP level #${index + 1}: price_offset_pct must be > 0.`;
      }
      if (!(level.close_pct > 0) || level.close_pct > 100) {
        return `TP level #${index + 1}: close_pct must be in (0..100].`;
      }
      if (level.sl_lock_pct !== null) {
        if (!Number.isFinite(level.sl_lock_pct)) {
          return `TP level #${index + 1}: SL lock % must be a number.`;
        }
        if (level.sl_lock_pct < -100 || level.sl_lock_pct > 200) {
          return `TP level #${index + 1}: SL lock % must be in [-100..200].`;
        }
      }
    }
    const total = profile.tp_levels.reduce(
      (sum, level) => sum + level.close_pct,
      0,
    );
    if (Math.abs(total - 100) > 0.1) {
      return `TP levels close_pct must sum to 100% (current ${total.toFixed(2)}%).`;
    }
  }
  if (
    profile.trailing_enabled &&
    (profile.trailing_callback_rate < 0.1 || profile.trailing_callback_rate > 10)
  ) {
    return "trailing_callback_rate must be in [0.1..10].";
  }
  if (
    profile.breakeven_enabled &&
    (profile.breakeven_trigger_rr < 0.5 || profile.breakeven_trigger_rr > 5)
  ) {
    return "breakeven_trigger_rr must be in [0.5..5].";
  }
  if (profile.volatility_sl_enabled) {
    if (!Number.isInteger(profile.volatility_atr_period) || profile.volatility_atr_period < 1) {
      return "volatility_atr_period must be a positive integer.";
    }
    if (
      profile.volatility_atr_multiplier < 0.5 ||
      profile.volatility_atr_multiplier > 5
    ) {
      return "volatility_atr_multiplier must be in [0.5..5].";
    }
  }
  if (!(profile.max_position_pct > 0) || profile.max_position_pct > 100) {
    return "max_position_pct must be in (0..100].";
  }
  const seen = new Set<AdjustmentSource>();
  for (const key of profile.adjustment_priority) {
    if (!ADJUSTMENT_SOURCES.includes(key)) {
      return `adjustment_priority contains unknown key '${key}'.`;
    }
    if (seen.has(key)) {
      return `adjustment_priority must not contain duplicates ('${key}').`;
    }
    seen.add(key);
  }
  return null;
}

export function buildStrategyProfilePayload(
  profile: AutoTradeStrategyProfileFormState,
): StrategyProfileConfig | null {
  if (!profile.enabled) {
    return null;
  }
  const tpLevels: StrategyProfileTPLevel[] | null =
    profile.tp_mode === "multi"
      ? profile.tp_levels.map((level) => ({
          price_offset_pct: level.price_offset_pct,
          close_pct: level.close_pct,
          // Send the new numeric form whenever the user picked a value.
          // Backend prioritizes sl_lock_pct over move_sl_to; we still emit a
          // null `move_sl_to` to clear any stale legacy value on the server.
          sl_lock_pct:
            level.sl_lock_pct === null || !Number.isFinite(level.sl_lock_pct)
              ? null
              : Math.max(-100, Math.min(200, Number(level.sl_lock_pct))),
          move_sl_to: null,
        }))
      : null;

  return {
    sl_mode: profile.sl_mode,
    sl_value: profile.sl_value,
    tp_mode: profile.tp_mode,
    tp_value: profile.tp_mode === "single" ? profile.tp_value : null,
    tp_levels: tpLevels,
    trailing_enabled: profile.trailing_enabled,
    trailing_callback_rate: profile.trailing_callback_rate,
    breakeven_enabled: profile.breakeven_enabled,
    breakeven_trigger_rr: profile.breakeven_trigger_rr,
    volatility_sl_enabled: profile.volatility_sl_enabled,
    volatility_atr_period: profile.volatility_atr_period,
    volatility_atr_multiplier: profile.volatility_atr_multiplier,
    // Indicator watchers are driven internally by AI prediction signals;
    // this form intentionally does not surface them.
    watchers: [],
    adjustment_priority: [...profile.adjustment_priority],
    max_position_pct: profile.max_position_pct,
    allow_sl_widen: profile.allow_sl_widen,
  };
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
