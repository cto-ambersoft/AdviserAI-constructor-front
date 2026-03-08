export type AtrStrategyFormState = {
  ema_period: number;
  atr_period: number;
  impulse_atr: number;
  ob_buffer_atr: number;
  one_trade_per_ob: boolean;
  allocation_usdt: number;
};

export type KnifeStrategyFormState = {
  include_series: boolean;
  trades_limit: number;
  account_balance: number;
  side: string;
  entry_mode_long: string;
  entry_mode_short: string;
  knife_move_pct: number;
  entry_k_pct: number;
  tp_pct: number;
  sl_pct: number;
  use_max_range_filter: boolean;
  max_range_pct: number;
  use_wick_filter: boolean;
  max_wick_share_pct: number;
  requote_each_candle: boolean;
  max_requotes: number;
};

export type GridStrategyFormState = {
  ma_period: number;
  grid_spacing_pct: number;
  grids_down: number;
  order_fee_pct: number;
  allocation_usdt: number;
  initial_capital_usdt: number;
  order_size_usdt: number;
  close_open_positions_on_eod: boolean;
};

export type IntradayStrategyFormState = {
  lookback: number;
  atr_period: number;
  atr_mult: number;
  rr: number;
  vol_sma: number;
  vol_mult: number;
  time_exit_bars: number;
  side: string;
  allocation_usdt: number;
  risk_per_trade_pct: number;
  max_positions: number;
  fee_pct: number;
  entry_size_usdt: number;
};
