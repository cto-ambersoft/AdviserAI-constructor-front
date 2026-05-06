export type SlMode = "fixed" | "atr" | "percentage";
export type TpMode = "single" | "multi";
export type AdjustmentSource = "watcher" | "trailing" | "breakeven" | "volatility";

export type AutoTradeTPLevelFormState = {
  price_offset_pct: number;
  close_pct: number;
  /**
   * % of profit (entry → this TP price) to lock by moving SL.
   *   null  — keep SL where it is
   *      0  — SL → entry (breakeven)
   *     50  — SL halfway between entry and this TP price
   *    100  — SL right at this TP price
   */
  sl_lock_pct: number | null;
  /** Legacy server form ("breakeven" | "tpN") preserved for round-tripping older configs. */
  move_sl_to: string | null;
};

export type AutoTradeStrategyProfileFormState = {
  enabled: boolean;
  sl_mode: SlMode;
  sl_value: number;
  tp_mode: TpMode;
  tp_value: number;
  tp_levels: AutoTradeTPLevelFormState[];
  trailing_enabled: boolean;
  trailing_callback_rate: number;
  breakeven_enabled: boolean;
  breakeven_trigger_rr: number;
  volatility_sl_enabled: boolean;
  volatility_atr_period: number;
  volatility_atr_multiplier: number;
  adjustment_priority: AdjustmentSource[];
  max_position_pct: number;
  allow_sl_widen: boolean;
};

export type AutoTradeFormState = {
  enabled: boolean;
  profile_id: number | null;
  account_id: number | null;
  position_size_usdt: number;
  leverage: number;
  min_confidence_pct: number;
  fast_close_confidence_pct: number;
  confirm_reports_required: number;
  risk_mode: string;
  sl_pct: number;
  tp_pct: number;
  signal_source: "analysis" | "strategy_atr_block";
  strategy_id: number | null;
  strategy_overrides: {
    ema_period: number | null;
    atr_period: number | null;
    impulse_atr: number | null;
    ob_buffer_atr: number | null;
  };
  timeframe: string;
  bars: number;
  poll_interval_seconds: number;
  strategy_profile: AutoTradeStrategyProfileFormState;
};

export type AutoTradeFormValidation = {
  isValid: boolean;
  message: string;
};

export const ADJUSTMENT_SOURCES: AdjustmentSource[] = [
  "watcher",
  "trailing",
  "breakeven",
  "volatility",
];

export const DEFAULT_STRATEGY_PROFILE: AutoTradeStrategyProfileFormState = {
  enabled: false,
  sl_mode: "fixed",
  sl_value: 1.0,
  tp_mode: "single",
  tp_value: 2.0,
  tp_levels: [],
  trailing_enabled: false,
  trailing_callback_rate: 1.0,
  breakeven_enabled: false,
  breakeven_trigger_rr: 1.0,
  volatility_sl_enabled: false,
  volatility_atr_period: 14,
  volatility_atr_multiplier: 2.0,
  adjustment_priority: [...ADJUSTMENT_SOURCES],
  max_position_pct: 100.0,
  allow_sl_widen: false,
};
