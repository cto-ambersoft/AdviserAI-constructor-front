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
};

export type AutoTradeFormValidation = {
  isValid: boolean;
  message: string;
};
