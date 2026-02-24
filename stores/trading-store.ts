import { createStore } from "zustand/vanilla";

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
export const DASHBOARD_TABS = [
  "builder",
  "strategies",
  "live",
  "portfolio",
  "analysis",
  "audit",
] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export type TradingState = {
  symbol: string;
  timeframe: Timeframe;
  bars: number;
  activeTab: DashboardTab;
  lastPrice: number;
  isLoading: boolean;
};

export type TradingActions = {
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setBars: (bars: number) => void;
  setActiveTab: (tab: DashboardTab) => void;
  setLastPrice: (price: number) => void;
  setLoading: (isLoading: boolean) => void;
};

export type TradingStore = TradingState & TradingActions;

export const defaultTradingState: TradingState = {
  symbol: "BTCUSDT",
  timeframe: "15m",
  bars: 500,
  activeTab: "builder",
  lastPrice: 0,
  isLoading: false,
};

export const createTradingStore = (
  initState: TradingState = defaultTradingState,
) => {
  return createStore<TradingStore>()((set) => ({
    ...initState,
    setSymbol: (symbol) => set(() => ({ symbol })),
    setTimeframe: (timeframe) => set(() => ({ timeframe })),
    setBars: (bars) => set(() => ({ bars })),
    setActiveTab: (activeTab) => set(() => ({ activeTab })),
    setLastPrice: (lastPrice) => set(() => ({ lastPrice })),
    setLoading: (isLoading) => set(() => ({ isLoading })),
  }));
};
