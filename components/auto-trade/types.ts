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

// ── W8/W9 Risk Governance (nested ``risk`` on the config upsert) ───────────
// Mirrors the backend ``AutoTradeRiskConfig``. Nullable numeric limits are
// modelled as ``number | null`` where ``null`` means "rule off"; the UI must
// never coerce an unset limit to 0.
export type ConflictingSignalPolicy = "off" | "block_opposite";

export type AutoTradeRiskFormState = {
  enabled: boolean;
  // Pre-Trade Risk Engine limits (W8). `null` = rule off.
  daily_loss_limit_usdt: number | null;
  daily_loss_limit_pct: number | null;
  max_open_positions: number | null;
  max_open_positions_per_symbol: number | null;
  exposure_cap_usdt: number | null;
  leverage_ceiling: number | null;
  conflicting_signal_policy: ConflictingSignalPolicy;
  // KPI-Guard auto-pause (W9). Pauses the WHOLE strategy on a confirmed breach.
  kpi_guard_enabled: boolean;
  kpi_guard_max_dd_pct: number | null;
  kpi_guard_max_daily_loss_usdt: number | null;
  kpi_guard_max_daily_loss_pct: number | null;
  kpi_guard_min_win_rate_pct: number | null;
  kpi_guard_min_trades: number | null;
  // Volatility Kill-Switch (W9). Hard-closes the position + risk-off latch.
  kill_switch_enabled: boolean;
  kill_switch_atr_spike_mult: number | null;
  kill_switch_atr_period: number | null;
  kill_switch_price_move_pct: number | null;
  kill_switch_cooldown_seconds: number | null;
  // Strategy Anomaly Detection (B6/W12). Alert-only; `null` = engine default.
  anomaly_detection_enabled: boolean;
  anomaly_z_threshold: number | null;
  anomaly_window: number | null;
  // Promotion KPI-Gate (B5/W10). `null` = gate's conservative default.
  promote_min_win_rate_pct: number | null;
  promote_max_dd_pct: number | null;
  promote_min_trades: number | null;
  promote_min_sandbox_days: number | null;
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
  // W7: optional UI label for the multi-strategy switcher. Mirrors
  // ``AutoTradeConfig.strategy_name`` on the backend.
  strategy_name: string | null;
  // T16 (W12e): catalogue forecast attached to this live strategy (forecastId).
  attached_forecast_id: string | null;
  // W8/W9: nested risk-governance config (pre-trade limits + KPI-Guard +
  // Kill-Switch). Persisted as ``risk`` on the same config upsert.
  risk: AutoTradeRiskFormState;
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

// Backend Pydantic defaults: the risk engine is "enabled" but with every limit
// unset (= no rule fires), and both guards off. An untouched section is thus a
// faithful no-op on save.
export const DEFAULT_RISK_CONFIG: AutoTradeRiskFormState = {
  enabled: true,
  daily_loss_limit_usdt: null,
  daily_loss_limit_pct: null,
  max_open_positions: null,
  max_open_positions_per_symbol: null,
  exposure_cap_usdt: null,
  leverage_ceiling: null,
  conflicting_signal_policy: "off",
  kpi_guard_enabled: false,
  kpi_guard_max_dd_pct: null,
  kpi_guard_max_daily_loss_usdt: null,
  kpi_guard_max_daily_loss_pct: null,
  kpi_guard_min_win_rate_pct: null,
  kpi_guard_min_trades: null,
  kill_switch_enabled: false,
  kill_switch_atr_spike_mult: null,
  kill_switch_atr_period: null,
  kill_switch_price_move_pct: null,
  kill_switch_cooldown_seconds: null,
  anomaly_detection_enabled: false,
  anomaly_z_threshold: null,
  anomaly_window: null,
  promote_min_win_rate_pct: null,
  promote_max_dd_pct: null,
  promote_min_trades: null,
  promote_min_sandbox_days: null,
};
