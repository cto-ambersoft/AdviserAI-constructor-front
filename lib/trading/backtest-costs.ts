/**
 * Default cost-model params for backtest requests, mirroring the backend
 * `BaseBacktestRequest` defaults (fee 0.06% taker, slippage/funding off). These
 * are required on every backtest request type in the generated contract
 * (openapi-typescript treats schema `default`s as non-optional), so the client
 * supplies them explicitly. Spread first so a form/config value still overrides.
 */
export const DEFAULT_BACKTEST_COSTS = {
  fee_pct: 0.06,
  slippage_pct: 0,
  funding_pct_per_bar: 0,
} as const;
