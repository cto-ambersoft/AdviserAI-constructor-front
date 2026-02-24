"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createTradingStore,
  defaultTradingState,
  type TradingState,
  type TradingStore,
} from "@/stores/trading-store";

type TradingStoreApi = ReturnType<typeof createTradingStore>;

const TradingStoreContext = createContext<TradingStoreApi | undefined>(
  undefined,
);

export function TradingStoreProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: TradingState;
}) {
  const [store] = useState<TradingStoreApi>(() =>
    createTradingStore(initialState ?? defaultTradingState),
  );

  return (
    <TradingStoreContext.Provider value={store}>
      {children}
    </TradingStoreContext.Provider>
  );
}

export function useTradingStore<T>(selector: (store: TradingStore) => T): T {
  const tradingStoreContext = useContext(TradingStoreContext);
  if (!tradingStoreContext) {
    throw new Error("useTradingStore must be used within TradingStoreProvider");
  }

  return useStore(tradingStoreContext, selector);
}
