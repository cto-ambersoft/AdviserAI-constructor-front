"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import { MarketChart } from "@/components/trading/market-chart";
import {
  cancelSpotOrder,
  createExchangeAccount,
  deleteExchangeAccount,
  getExchangeAccountsMeta,
  listAnalysisRuns,
  getMarketMeta,
  getMarketOhlcv,
  getOpenSpotOrders,
  getSpotBalances,
  getSpotOrderHistory,
  getSpotPnl,
  getSpotPositions,
  getSpotTrades,
  listExchangeAccounts,
  placeSpotOrder,
  updateExchangeAccount,
  validateExchangeAccount,
  ApiError,
  type ExchangeAccountRead,
  type ExchangeAccountUpdate,
  type ExchangeAccountsMetaResponse,
  type MarketMetaResponse,
  type NormalizedBalance,
  type NormalizedOrder,
  type NormalizedTrade,
  type SpotPnlAsset,
  type SpotPnlRead,
  type SpotPositionView,
  type AnalysisRun,
  type SpotOrderCreateRequest,
} from "@/lib/api";
import { notifyError, notifyInfo, notifyWarning } from "@/lib/notifications";
import { mapMarketRowsToCandles } from "@/lib/trading/mappers";
import { useAuthStore } from "@/stores/auth-store";
import { useTradingStore } from "@/providers/trading-store-provider";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";
const ORDER_PANEL_INPUT_CLASS =
  "h-8 w-full rounded-sm border border-input/90 bg-background/75 px-2.5 font-mono text-sm text-foreground outline-none transition-colors duration-75 placeholder:text-muted-foreground/90 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60";

type SpotWidgetState = {
  openOrders: NormalizedOrder[];
  orderHistory: NormalizedOrder[];
  trades: NormalizedTrade[];
  balances: NormalizedBalance[];
  positions: SpotPositionView[];
  pnl: SpotPnlRead | null;
};

type TradeActivityTab =
  | "openOrders"
  | "positions"
  | "trades"
  | "orderHistory"
  | "balances"
  | "pnl";

const EMPTY_WIDGETS: SpotWidgetState = {
  openOrders: [],
  orderHistory: [],
  trades: [],
  balances: [],
  positions: [],
  pnl: null,
};

export function CexDashboard({ mode = "full" }: { mode?: "full" | "trade" }) {
  const isTradeMode = mode === "trade";
  const router = useRouter();
  const symbol = useTradingStore((state) => state.symbol);
  const timeframe = useTradingStore((state) => state.timeframe);
  const bars = useTradingStore((state) => state.bars);
  const setSymbol = useTradingStore((state) => state.setSymbol);
  const setTimeframe = useTradingStore((state) => state.setTimeframe);
  const setBars = useTradingStore((state) => state.setBars);
  const setLastPrice = useTradingStore((state) => state.setLastPrice);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [marketMeta, setMarketMeta] = useState<MarketMetaResponse | null>(null);
  const [accountsMeta, setAccountsMeta] =
    useState<ExchangeAccountsMetaResponse | null>(null);
  const [accounts, setAccounts] = useState<ExchangeAccountRead[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [selectedExchangeName, setSelectedExchangeName] =
    useState<string>("bybit");
  const [candles, setCandles] = useState<
    ReturnType<typeof mapMarketRowsToCandles>
  >([]);
  const [spotWidgets, setSpotWidgets] =
    useState<SpotWidgetState>(EMPTY_WIDGETS);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [pollIntervalSec, setPollIntervalSec] = useState(5);
  const [barsInput, setBarsInput] = useState(String(bars));
  const [pollIntervalInput, setPollIntervalInput] = useState(
    String(pollIntervalSec),
  );
  const [armingEnabled, setArmingEnabled] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editMode, setEditMode] = useState<"demo" | "real">("demo");
  const [orderForm, setOrderForm] = useState<{
    side: "buy" | "sell";
    order_type: "market" | "limit";
    amount: string;
    price: string;
    tp_enabled: boolean;
    tp_trigger_price: string;
    tp_order_type: "market" | "limit";
    tp_price: string;
    sl_enabled: boolean;
    sl_trigger_price: string;
    sl_order_type: "market" | "limit";
    sl_price: string;
  }>({
    side: "buy",
    order_type: "market",
    amount: "0.001",
    price: "",
    tp_enabled: false,
    tp_trigger_price: "",
    tp_order_type: "market",
    tp_price: "",
    sl_enabled: false,
    sl_trigger_price: "",
    sl_order_type: "market",
    sl_price: "",
  });
  const [orderFormError, setOrderFormError] = useState("");
  const [confirmState, setConfirmState] = useState<{
    title: string;
    text: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [pendingByAction, setPendingByAction] = useState<
    Record<string, boolean>
  >({});
  const [isConfirmPending, setIsConfirmPending] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [activeActivityTab, setActiveActivityTab] =
    useState<TradeActivityTab>("openOrders");
  const [latestAnalysisRun, setLatestAnalysisRun] =
    useState<AnalysisRun | null>(null);
  const [tpLevelSource, setTpLevelSource] = useState<"none" | "ai" | "manual">(
    "none",
  );
  const [slLevelSource, setSlLevelSource] = useState<"none" | "ai" | "manual">(
    "none",
  );
  const [lastAppliedAnalysisId, setLastAppliedAnalysisId] = useState<
    string | null
  >(null);
  const isSpotRefreshInFlightRef = useRef(false);
  const queuedSpotRefreshRef = useRef<{
    accountId: number;
    force: boolean;
  } | null>(null);
  const nextSpotRefreshAtRef = useRef(0);
  const lastSpotSlowRefreshAtRef = useRef(0);
  const spotBackoffMsRef = useRef(0);

  const setMessage = useCallback((message: string) => {
    const normalized = message.trim();
    if (!normalized) {
      return;
    }
    notifyInfo(normalized);
  }, []);

  const setErrorMessage = useCallback((message: string) => {
    const normalized = message.trim();
    if (!normalized) {
      return;
    }
    notifyError(normalized);
  }, []);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) {
      return null;
    }
    return accounts.find((item) => item.id === selectedAccountId) ?? null;
  }, [accounts, selectedAccountId]);

  const setActionPending = useCallback((actionKey: string, value: boolean) => {
    setPendingByAction((prev) => ({ ...prev, [actionKey]: value }));
  }, []);

  const isActionPending = useCallback(
    (actionKey: string) => {
      return Boolean(pendingByAction[actionKey]);
    },
    [pendingByAction],
  );

  const hasPendingActions = useMemo(() => {
    return Object.values(pendingByAction).some(Boolean) || isConfirmPending;
  }, [isConfirmPending, pendingByAction]);

  const runWithPending = useCallback(
    async <T,>(actionKey: string, run: () => Promise<T>): Promise<T> => {
      setActionPending(actionKey, true);
      try {
        return await run();
      } finally {
        setActionPending(actionKey, false);
      }
    },
    [setActionPending],
  );

  useEffect(() => {
    if (selectedAccount) {
      setSelectedExchangeName(selectedAccount.exchange_name);
      return;
    }
    if (marketMeta?.default_exchange_name) {
      setSelectedExchangeName(marketMeta.default_exchange_name);
    }
  }, [marketMeta?.default_exchange_name, selectedAccount]);

  useEffect(() => {
    if (orderFormError) {
      setOrderFormError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderForm]);

  useEffect(() => {
    setBarsInput(String(bars));
  }, [bars]);

  useEffect(() => {
    setPollIntervalInput(String(pollIntervalSec));
  }, [pollIntervalSec]);

  useEffect(() => {
    if (!latestAnalysisRun || latestAnalysisRun._id === lastAppliedAnalysisId) {
      return;
    }
    const preferredScenario = getPreferredTrendScenario(latestAnalysisRun);
    if (!preferredScenario) {
      return;
    }
    const nextTp = toNullablePriceString(preferredScenario.takeProfit);
    const nextSl = toNullablePriceString(preferredScenario.stopLoss);
    if (!nextTp && !nextSl) {
      return;
    }
    setOrderForm((prev) => ({
      ...prev,
      tp_enabled: nextTp ? true : prev.tp_enabled,
      tp_trigger_price: nextTp ?? prev.tp_trigger_price,
      sl_enabled: nextSl ? true : prev.sl_enabled,
      sl_trigger_price: nextSl ?? prev.sl_trigger_price,
    }));
    if (nextTp) {
      setTpLevelSource("ai");
    }
    if (nextSl) {
      setSlLevelSource("ai");
    }
    setLastAppliedAnalysisId(latestAnalysisRun._id);
  }, [lastAppliedAnalysisId, latestAnalysisRun]);

  const loadBaseData = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [
        marketMetaResult,
        accountsMetaResult,
        accountsResult,
        analysisResult,
      ] = await Promise.allSettled([
        getMarketMeta(),
        getExchangeAccountsMeta(),
        listExchangeAccounts(),
        listAnalysisRuns({ limit: 1 }),
      ]);

      if (marketMetaResult.status === "fulfilled") {
        const nextMarketMeta = marketMetaResult.value;
        setMarketMeta(nextMarketMeta);
        if (nextMarketMeta.default_symbol && !symbol) {
          setSymbol(nextMarketMeta.default_symbol);
        }
      }

      if (accountsMetaResult.status === "fulfilled") {
        setAccountsMeta(accountsMetaResult.value);
      }

      if (accountsResult.status === "fulfilled") {
        const nextAccounts = accountsResult.value;
        setAccounts(nextAccounts);
        if (nextAccounts.length > 0) {
          setSelectedAccountId((prev) => prev ?? nextAccounts[0].id);
        }
      }

      if (analysisResult.status === "fulfilled") {
        setLatestAnalysisRun(analysisResult.value.runs?.[0] ?? null);
      } else {
        setLatestAnalysisRun(null);
      }

      const criticalErrors: unknown[] = [];
      if (marketMetaResult.status === "rejected") {
        criticalErrors.push(marketMetaResult.reason);
      }
      if (accountsMetaResult.status === "rejected") {
        criticalErrors.push(accountsMetaResult.reason);
      }
      if (accountsResult.status === "rejected") {
        criticalErrors.push(accountsResult.reason);
      }
      if (criticalErrors.length > 0) {
        setErrorMessage(
          toUserErrorMessage(criticalErrors[0], "Failed to load metadata"),
        );
      }
    } catch (error) {
      setErrorMessage(toUserErrorMessage(error, "Failed to load metadata"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMarket = async () => {
    try {
      const response = await getMarketOhlcv({
        exchange_name: selectedExchangeName,
        symbol,
        timeframe,
        bars,
      });
      const mapped = mapMarketRowsToCandles(response);
      setCandles(mapped);
      if (mapped.length > 0) {
        setLastPrice(mapped[mapped.length - 1].close);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load market data",
      );
    }
  };

  const applySpotBackoff = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 429) {
      const nextBackoffMs = Math.min(
        60_000,
        spotBackoffMsRef.current > 0 ? spotBackoffMsRef.current * 2 : 5_000,
      );
      spotBackoffMsRef.current = nextBackoffMs;
      nextSpotRefreshAtRef.current = Date.now() + nextBackoffMs;
      notifyWarning(
        `Rate limited by exchange API. Next retry in ${Math.ceil(nextBackoffMs / 1000)}s.`,
      );
      return true;
    }
    if (error instanceof TypeError) {
      const fallbackBackoffMs = 10_000;
      spotBackoffMsRef.current = fallbackBackoffMs;
      nextSpotRefreshAtRef.current = Date.now() + fallbackBackoffMs;
      notifyWarning("Exchange backend temporarily unavailable. Retrying soon.");
      return true;
    }
    return false;
  }, []);

  const toUserErrorMessage = useCallback((error: unknown, fallback: string) => {
    const mapKnownTradingError = (code: string, rawMessage: string) => {
      const normalizedCode = code.trim().toLowerCase();
      const normalizedMessage = rawMessage.trim().toLowerCase();

      if (
        normalizedCode.includes("authentication_failed") ||
        normalizedMessage.includes("could not validate credentials")
      ) {
        return "Check API keys, key permissions, and account mode (demo/real).";
      }
      if (
        normalizedCode.includes("insufficient_funds") ||
        normalizedMessage.includes("insufficient")
      ) {
        return "Insufficient balance to place the order.";
      }
      if (
        normalizedCode.includes("invalid_symbol") ||
        normalizedMessage.includes("symbol")
      ) {
        return "Trading pair is not available on the selected exchange or market.";
      }
      if (
        normalizedCode.includes("rate_limited") ||
        normalizedMessage.includes("rate limit")
      ) {
        return "Too many requests. Please wait and try again.";
      }
      return "";
    };

    if (error instanceof ApiError) {
      const mappedByCode = mapKnownTradingError(error.code, error.message);
      if (mappedByCode) {
        return mappedByCode;
      }
      if (
        typeof error.message === "string" &&
        error.message.trim().length > 0
      ) {
        return error.message;
      }
      return `${fallback} (HTTP ${error.status})`;
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }, []);

  const validateOrderForm = useCallback(() => {
    const amount = Number(orderForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Amount must be greater than 0.";
    }

    if (orderForm.order_type === "limit") {
      const limitPrice = Number(orderForm.price);
      if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
        return "Price is required for limit orders.";
      }
    }

    if (orderForm.tp_enabled) {
      const tpTrigger = Number(orderForm.tp_trigger_price);
      if (!Number.isFinite(tpTrigger) || tpTrigger <= 0) {
        return "Take profit trigger price must be greater than 0.";
      }
      if (orderForm.tp_order_type === "limit") {
        const tpPrice = Number(orderForm.tp_price);
        if (!Number.isFinite(tpPrice) || tpPrice <= 0) {
          return "Take profit price is required when TP order type is limit.";
        }
      }
    }

    if (orderForm.sl_enabled) {
      const slTrigger = Number(orderForm.sl_trigger_price);
      if (!Number.isFinite(slTrigger) || slTrigger <= 0) {
        return "Stop loss trigger price must be greater than 0.";
      }
      if (orderForm.sl_order_type === "limit") {
        const slPrice = Number(orderForm.sl_price);
        if (!Number.isFinite(slPrice) || slPrice <= 0) {
          return "Stop loss price is required when SL order type is limit.";
        }
      }
    }

    return "";
  }, [orderForm]);

  const orderValidationMessage = useMemo(
    () => validateOrderForm(),
    [validateOrderForm],
  );

  const isOrderSubmitDisabled = useMemo(() => {
    return (
      !selectedAccountId ||
      Boolean(orderValidationMessage) ||
      isActionPending("place-order") ||
      isConfirmPending
    );
  }, [
    isActionPending,
    isConfirmPending,
    orderValidationMessage,
    selectedAccountId,
  ]);

  const orderPreview = useMemo(() => {
    const accountText = selectedAccount
      ? `${selectedAccount.exchange_name} / ${selectedAccount.mode}`
      : "Account not selected";
    const baseOrderText = `${orderForm.side.toUpperCase()} ${orderForm.amount || "-"} (${orderForm.order_type})`;

    const tpText = orderForm.tp_enabled
      ? `trigger ${orderForm.tp_trigger_price || "-"} (${orderForm.tp_order_type}${orderForm.tp_order_type === "limit" ? ` @ ${orderForm.tp_price || "-"}` : " execution"})`
      : "not set";
    const slText = orderForm.sl_enabled
      ? `trigger ${orderForm.sl_trigger_price || "-"} (${orderForm.sl_order_type}${orderForm.sl_order_type === "limit" ? ` @ ${orderForm.sl_price || "-"}` : " execution"})`
      : "not set";

    return { accountText, baseOrderText, tpText, slText };
  }, [orderForm, selectedAccount]);

  const loadSpotWidgets = useCallback(
    async (accountId: number, force = false) => {
      const now = Date.now();
      if (!force && now < nextSpotRefreshAtRef.current) {
        return;
      }
      if (isSpotRefreshInFlightRef.current) {
        const queued = queuedSpotRefreshRef.current;
        if (!queued) {
          queuedSpotRefreshRef.current = { accountId, force };
        } else {
          queuedSpotRefreshRef.current = {
            accountId,
            force: queued.force || force,
          };
        }
        return;
      }

      isSpotRefreshInFlightRef.current = true;
      try {
        const widgetErrors: unknown[] = [];
        const [openOrders] = await Promise.allSettled([
          getOpenSpotOrders({
            account_id: accountId,
            symbol,
            limit: 100,
          }),
        ]);
        if (openOrders.status === "fulfilled") {
          setSpotWidgets((prev) => ({
            ...prev,
            openOrders: openOrders.value.orders,
          }));
        } else {
          widgetErrors.push(openOrders.reason);
        }

        const shouldRefreshSlow =
          force || now - lastSpotSlowRefreshAtRef.current >= 30_000;
        if (!shouldRefreshSlow) {
          const hasBackoffError = widgetErrors.some((error) =>
            applySpotBackoff(error),
          );
          if (!hasBackoffError) {
            spotBackoffMsRef.current = 0;
            if (widgetErrors.length > 0) {
              setErrorMessage(
                toUserErrorMessage(
                  widgetErrors[0],
                  "Failed to refresh trading widgets",
                ),
              );
            }
          }
          return;
        }

        const [orderHistory, trades, balances, positions, pnl] =
          await Promise.allSettled([
            getSpotOrderHistory({ account_id: accountId, symbol, limit: 100 }),
            getSpotTrades({ account_id: accountId, symbol, limit: 100 }),
            getSpotBalances(accountId),
            getSpotPositions({ account_id: accountId, quote_asset: "USDT" }),
            getSpotPnl({
              account_id: accountId,
              quote_asset: "USDT",
              limit: 100,
            }),
          ]);

        setSpotWidgets((prev) => ({
          ...prev,
          orderHistory:
            orderHistory.status === "fulfilled"
              ? orderHistory.value.orders
              : prev.orderHistory,
          trades:
            trades.status === "fulfilled" ? trades.value.trades : prev.trades,
          balances:
            balances.status === "fulfilled"
              ? balances.value.balances
              : prev.balances,
          positions:
            positions.status === "fulfilled"
              ? positions.value.positions
              : prev.positions,
          pnl: pnl.status === "fulfilled" ? pnl.value : prev.pnl,
        }));

        const slowErrors = [orderHistory, trades, balances, positions, pnl]
          .filter(
            (item): item is PromiseRejectedResult => item.status === "rejected",
          )
          .map((item) => item.reason);
        const allErrors = [...widgetErrors, ...slowErrors];
        const hasBackoffError = allErrors.some((error) =>
          applySpotBackoff(error),
        );
        if (!hasBackoffError) {
          spotBackoffMsRef.current = 0;
          if (allErrors.length > 0) {
            setErrorMessage(
              toUserErrorMessage(
                allErrors[0],
                "Failed to refresh trading widgets",
              ),
            );
          }
        }
        lastSpotSlowRefreshAtRef.current = Date.now();
      } catch (error) {
        if (!applySpotBackoff(error)) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to refresh trading widgets",
          );
        }
      } finally {
        isSpotRefreshInFlightRef.current = false;
        const queued = queuedSpotRefreshRef.current;
        if (queued) {
          queuedSpotRefreshRef.current = null;
          void loadSpotWidgets(queued.accountId, queued.force);
        }
      }
    },
    [applySpotBackoff, setErrorMessage, symbol, toUserErrorMessage],
  );

  const triggerImmediateTradingRefresh = useCallback(
    async (accountId: number) => {
      // Force full widgets update right after successful trade mutation.
      nextSpotRefreshAtRef.current = 0;
      lastSpotSlowRefreshAtRef.current = 0;
      await loadSpotWidgets(accountId, true);
    },
    [loadSpotWidgets],
  );

  useEffect(() => {
    void loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExchangeName, symbol, timeframe, bars]);

  useEffect(() => {
    if (!selectedAccountId) {
      setSpotWidgets(EMPTY_WIDGETS);
      return;
    }

    void loadSpotWidgets(selectedAccountId, true);
    if (!pollingEnabled) {
      return;
    }
    const safeInterval = Math.min(10, Math.max(3, pollIntervalSec));
    const timer = window.setInterval(() => {
      void loadSpotWidgets(selectedAccountId);
    }, safeInterval * 1000);
    return () => window.clearInterval(timer);
  }, [loadSpotWidgets, pollIntervalSec, pollingEnabled, selectedAccountId]);

  const refreshAll = async () => {
    setMessage("");
    setErrorMessage("");
    try {
      await runWithPending("refresh-all", async () => {
        await Promise.all([
          loadBaseData(),
          loadMarket(),
          selectedAccountId
            ? triggerImmediateTradingRefresh(selectedAccountId)
            : Promise.resolve(),
        ]);
      });
    } catch (error) {
      setErrorMessage(toUserErrorMessage(error, "Failed to refresh dashboard"));
    }
  };

  const handleCreateAccount = async (formData: FormData) => {
    const mode = (formData.get("mode")?.toString() ?? "demo") as
      | "demo"
      | "real";
    const runCreate = async () => {
      await runWithPending("create-account", async () => {
        setErrorMessage("");
        const payload = {
          exchange_name: formData.get("exchange_name")?.toString().trim() ?? "",
          account_label: formData.get("account_label")?.toString().trim() ?? "",
          mode,
          api_key: formData.get("api_key")?.toString() ?? "",
          api_secret: formData.get("api_secret")?.toString() ?? "",
          passphrase: formData.get("passphrase")?.toString() || null,
        };
        const created = await createExchangeAccount(payload);
        setAccounts((prev) => [created, ...prev]);
        setSelectedAccountId(created.id);
        setMessage("Account created. Secret values are never shown again.");
      });
    };

    if (mode === "real") {
      setConfirmState({
        title: "Create REAL account?",
        text: "You are adding credentials for real trading. Confirm you understand real funds can be affected.",
        onConfirm: runCreate,
      });
      return;
    }

    await runCreate();
  };

  const handleUpdateAccount = async (accountId: number, formData: FormData) => {
    const nextMode = (formData.get("mode")?.toString() ?? "demo") as
      | "demo"
      | "real";
    const patch: ExchangeAccountUpdate = {
      account_label: formData.get("account_label")?.toString().trim() || null,
      mode: nextMode,
      api_key: formData.get("api_key")?.toString() || null,
      api_secret: formData.get("api_secret")?.toString() || null,
      passphrase: formData.get("passphrase")?.toString() || null,
    };
    await runWithPending(`update-account-${accountId}`, async () => {
      await updateExchangeAccount(accountId, patch);
      setAccounts(await listExchangeAccounts());
      setEditingAccountId(null);
      setMessage(
        "Account updated. Secrets are masked and cannot be retrieved.",
      );
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedAccountId) {
      setErrorMessage("Select an exchange account first.");
      return;
    }
    if (selectedAccount?.mode === "real" && !armingEnabled) {
      setErrorMessage("Enable arming toggle before sending real mode orders.");
      return;
    }
    setMessage("");
    setErrorMessage("");
    const localFormError = orderValidationMessage;
    if (localFormError) {
      setOrderFormError(localFormError);
      return;
    }
    setOrderFormError("");

    const payload: SpotOrderCreateRequest = {
      account_id: selectedAccountId,
      symbol,
      side: orderForm.side,
      type: orderForm.order_type === "limit" ? "limit" : "market",
      amount: Number(orderForm.amount),
      price:
        orderForm.order_type === "limit" ? Number(orderForm.price || 0) : null,
      client_order_id: null,
      attached_take_profit: orderForm.tp_enabled
        ? {
            trigger_price: Number(orderForm.tp_trigger_price),
            order_type: orderForm.tp_order_type,
            price:
              orderForm.tp_order_type === "limit"
                ? Number(orderForm.tp_price || 0)
                : null,
          }
        : null,
      attached_stop_loss: orderForm.sl_enabled
        ? {
            trigger_price: Number(orderForm.sl_trigger_price),
            order_type: orderForm.sl_order_type,
            price:
              orderForm.sl_order_type === "limit"
                ? Number(orderForm.sl_price || 0)
                : null,
          }
        : null,
    };

    const run = async () => {
      await runWithPending("place-order", async () => {
        await placeSpotOrder(payload);
        setMessage("Order placed.");
        await triggerImmediateTradingRefresh(selectedAccountId);
      });
    };

    try {
      if (selectedAccount?.mode === "real") {
        setConfirmState({
          title: "Send REAL order?",
          text: "This order can execute on a real exchange account. Please confirm.",
          onConfirm: run,
        });
        return;
      }

      await run();
    } catch (error) {
      setErrorMessage(toUserErrorMessage(error, "Failed to place order"));
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!selectedAccountId) {
      return;
    }
    setCancelingOrderId(orderId);
    try {
      await runWithPending(`cancel-order-${orderId}`, async () => {
        await cancelSpotOrder({
          account_id: selectedAccountId,
          order_id: orderId,
          symbol,
        });
        setMessage(`Order ${orderId} canceled.`);
        await triggerImmediateTradingRefresh(selectedAccountId);
      });
    } catch (error) {
      setErrorMessage(toUserErrorMessage(error, "Failed to cancel order"));
    } finally {
      setCancelingOrderId(null);
    }
  };

  const pnlAssetRows: SpotPnlAsset[] = spotWidgets.pnl?.assets ?? [];
  const selectedMode = selectedAccount?.mode ?? "demo";
  const exchangeOptions = accountsMeta?.supported_exchanges ?? [
    selectedExchangeName,
  ];
  const timeframeOptions = marketMeta?.common_timeframes ?? [
    "1m",
    "5m",
    "15m",
    "1h",
    "4h",
    "1d",
  ];
  const tradeActivityTabs: Array<{ value: TradeActivityTab; label: string }> = [
    { value: "openOrders", label: "Open Orders" },
    { value: "positions", label: "Positions" },
    { value: "trades", label: "Trades" },
    { value: "orderHistory", label: "Order History" },
    { value: "balances", label: "Assets" },
    { value: "pnl", label: "PnL" },
  ];
  const activeWidgetTitleByTab: Record<TradeActivityTab, string> = {
    openOrders: "Open Orders",
    positions: "Positions",
    trades: "Trades",
    orderHistory: "Order History",
    balances: "Assets",
    pnl: "PnL",
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] p-4 md:p-6">
      {!isTradeMode ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{user?.email ?? "anonymous"}</Badge>
            <Badge
              variant={isLoading || hasPendingActions ? "outline" : "default"}
            >
              {isLoading || hasPendingActions ? "Loading..." : "Ready"}
            </Badge>
            <Badge
              variant={selectedMode === "real" ? "destructive" : "secondary"}
            >
              {selectedMode}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <LoadingButton
              variant="outline"
              onClick={() => void refreshAll()}
              isLoading={isActionPending("refresh-all")}
              loadingText="Refreshing..."
            >
              Refresh
            </LoadingButton>
            <Button
              variant="outline"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={`grid gap-4 ${isTradeMode ? "xl:grid-cols-1" : "xl:grid-cols-[380px_1fr]"}`}
      >
        {!isTradeMode ? (
          <section className="space-y-4">
            <Card className={CARD_CLASS}>
              <CardHeader>
                <CardTitle>Exchange Accounts</CardTitle>
                <CardDescription>
                  Create, update, delete, and validate exchange connections.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  className="space-y-2 rounded-md border p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setErrorMessage("");
                    setMessage("");
                    const formData = new FormData(event.currentTarget);
                    void handleCreateAccount(formData)
                      .then(() => {
                        event.currentTarget.reset();
                      })
                      .catch((error) => {
                        setErrorMessage(
                          toUserErrorMessage(error, "Failed to create account"),
                        );
                      });
                  }}
                >
                  <fieldset
                    className="space-y-2"
                    disabled={isActionPending("create-account")}
                  >
                    <Label text="New exchange account" />
                    <select
                      className={INPUT_CLASS}
                      name="exchange_name"
                      defaultValue={selectedExchangeName}
                    >
                      {exchangeOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <input
                      className={INPUT_CLASS}
                      name="account_label"
                      placeholder="Label"
                      required
                    />
                    <select
                      className={INPUT_CLASS}
                      name="mode"
                      defaultValue={accountsMeta?.default_mode ?? "demo"}
                    >
                      <option value="demo">demo</option>
                      <option value="real">real</option>
                    </select>
                    <input
                      className={INPUT_CLASS}
                      name="api_key"
                      placeholder="API key"
                      autoComplete="off"
                      required
                    />
                    <input
                      className={INPUT_CLASS}
                      name="api_secret"
                      placeholder="API secret"
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                    <input
                      className={INPUT_CLASS}
                      name="passphrase"
                      placeholder="Passphrase (optional)"
                      type="password"
                      autoComplete="new-password"
                    />
                    <LoadingButton
                      className="w-full"
                      type="submit"
                      isLoading={isActionPending("create-account")}
                      loadingText="Creating..."
                    >
                      Create Account
                    </LoadingButton>
                  </fieldset>
                </form>

                <Separator />

                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div key={account.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          className="text-left text-sm font-medium hover:underline"
                          onClick={() => setSelectedAccountId(account.id)}
                          type="button"
                        >
                          {account.account_label} ({account.exchange_name})
                        </button>
                        <Badge
                          variant={
                            account.mode === "real"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {account.mode}
                        </Badge>
                      </div>
                      {editingAccountId === account.id ? (
                        <form
                          className="space-y-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            setErrorMessage("");
                            const formData = new FormData(event.currentTarget);
                            void handleUpdateAccount(
                              account.id,
                              formData,
                            ).catch((error) => {
                              setErrorMessage(
                                toUserErrorMessage(
                                  error,
                                  "Failed to update account",
                                ),
                              );
                            });
                          }}
                        >
                          <input
                            className={INPUT_CLASS}
                            name="account_label"
                            value={editLabel}
                            onChange={(event) =>
                              setEditLabel(event.target.value)
                            }
                            required
                          />
                          <select
                            className={INPUT_CLASS}
                            name="mode"
                            value={editMode}
                            onChange={(event) =>
                              setEditMode(event.target.value as "demo" | "real")
                            }
                          >
                            <option value="demo">demo</option>
                            <option value="real">real</option>
                          </select>
                          <input
                            className={INPUT_CLASS}
                            name="api_key"
                            placeholder="New API key (optional)"
                          />
                          <input
                            className={INPUT_CLASS}
                            name="api_secret"
                            placeholder="New API secret (optional)"
                            type="password"
                            autoComplete="new-password"
                          />
                          <input
                            className={INPUT_CLASS}
                            name="passphrase"
                            placeholder="New passphrase (optional)"
                            type="password"
                            autoComplete="new-password"
                          />
                          <div className="flex gap-2">
                            <LoadingButton
                              type="submit"
                              size="sm"
                              isLoading={isActionPending(
                                `update-account-${account.id}`,
                              )}
                              loadingText="Saving..."
                            >
                              Save
                            </LoadingButton>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingAccountId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingAccountId(account.id);
                              setEditLabel(account.account_label);
                              setEditMode(account.mode as "demo" | "real");
                            }}
                          >
                            Edit
                          </Button>
                          <LoadingButton
                            size="sm"
                            variant="outline"
                            isLoading={isActionPending(
                              `validate-account-${account.id}`,
                            )}
                            loadingText="Validating..."
                            onClick={() =>
                              void runWithPending(
                                `validate-account-${account.id}`,
                                async () => {
                                  const res = await validateExchangeAccount(
                                    account.id,
                                  );
                                  setMessage(
                                    `Validation status: ${res.status}`,
                                  );
                                },
                              ).catch((error) => {
                                setErrorMessage(
                                  toUserErrorMessage(
                                    error,
                                    "Validation failed",
                                  ),
                                );
                              })
                            }
                          >
                            Validate
                          </LoadingButton>
                          <LoadingButton
                            size="sm"
                            variant="destructive"
                            isLoading={isActionPending(
                              `delete-account-${account.id}`,
                            )}
                            loadingText="Deleting..."
                            onClick={() =>
                              void runWithPending(
                                `delete-account-${account.id}`,
                                async () => {
                                  await deleteExchangeAccount(account.id);
                                  setAccounts(await listExchangeAccounts());
                                  setMessage("Account deleted.");
                                },
                              ).catch((error) => {
                                setErrorMessage(
                                  toUserErrorMessage(error, "Delete failed"),
                                );
                              })
                            }
                          >
                            Delete
                          </LoadingButton>
                        </div>
                      )}
                    </div>
                  ))}
                  {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No accounts yet.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="space-y-4">
          <div
            className={
              isTradeMode
                ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start"
                : "space-y-4"
            }
          >
            <div className={isTradeMode ? "min-w-0 space-y-4" : "space-y-4"}>
              <Card className={CARD_CLASS}>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <select
                      className={INPUT_CLASS}
                      value={selectedAccountId ?? ""}
                      onChange={(event) =>
                        setSelectedAccountId(
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    >
                      <option value="">
                        Select account (required for trading)
                      </option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_label} / {account.exchange_name} /{" "}
                          {account.mode}
                        </option>
                      ))}
                    </select>
                    <select
                      className={INPUT_CLASS}
                      value={selectedExchangeName}
                      onChange={(event) =>
                        setSelectedExchangeName(event.target.value)
                      }
                    >
                      {(
                        accountsMeta?.supported_exchanges ?? [
                          selectedExchangeName,
                        ]
                      ).map((exchange) => (
                        <option key={exchange} value={exchange}>
                          {exchange}
                        </option>
                      ))}
                    </select>
                    <input
                      className={INPUT_CLASS}
                      value={symbol}
                      onChange={(event) => setSymbol(event.target.value)}
                      placeholder={marketMeta?.default_symbol ?? "BTC/USDT"}
                    />
                    <select
                      className={INPUT_CLASS}
                      value={timeframe}
                      onChange={(event) =>
                        setTimeframe(
                          event.target.value as
                            | "1m"
                            | "5m"
                            | "15m"
                            | "1h"
                            | "4h"
                            | "1d",
                        )
                      }
                    >
                      {timeframeOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min={marketMeta?.min_bars ?? 50}
                      max={marketMeta?.max_bars ?? 5000}
                      value={barsInput}
                      onChange={(event) => {
                        const next = event.target.value;
                        setBarsInput(next);
                        const parsed = Number(next);
                        if (Number.isFinite(parsed)) {
                          setBars(parsed);
                        }
                      }}
                      onBlur={() => {
                        if (
                          !barsInput.trim() ||
                          !Number.isFinite(Number(barsInput))
                        ) {
                          setBarsInput(String(bars));
                        }
                      }}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={pollingEnabled}
                        onChange={(event) =>
                          setPollingEnabled(event.target.checked)
                        }
                      />
                      Auto refresh
                    </label>
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min={3}
                      max={10}
                      value={pollIntervalInput}
                      onChange={(event) => {
                        const next = event.target.value;
                        setPollIntervalInput(next);
                        const parsed = Number(next);
                        if (Number.isFinite(parsed)) {
                          setPollIntervalSec(parsed);
                        }
                      }}
                      onBlur={() => {
                        if (
                          !pollIntervalInput.trim() ||
                          !Number.isFinite(Number(pollIntervalInput))
                        ) {
                          setPollIntervalInput(String(pollIntervalSec));
                        }
                      }}
                    />
                  </div>
                  <div className="relative">
                    <MarketChart
                      candles={candles}
                      height={isTradeMode ? 360 : 420}
                    />
                    {isLoading && candles.length === 0 ? (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]">
                        <p className="inline-flex items-center text-sm text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading market chart...
                        </p>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {isTradeMode ? (
                <Card className={CARD_CLASS}>
                  <CardHeader>
                    <CardTitle>Positions & Activity</CardTitle>
                    <CardDescription>
                      Exchange-style tabs: show one data section at a time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-2">
                      {tradeActivityTabs.map((tab) => (
                        <Button
                          key={tab.value}
                          size="sm"
                          variant={
                            activeActivityTab === tab.value
                              ? "default"
                              : "ghost"
                          }
                          onClick={() => {
                            setActiveActivityTab(tab.value);
                            if (selectedAccountId) {
                              void loadSpotWidgets(selectedAccountId, true);
                            }
                          }}
                        >
                          {tab.label}
                        </Button>
                      ))}
                    </div>

                    {activeActivityTab === "openOrders" ? (
                      <WidgetTable
                        title={activeWidgetTitleByTab.openOrders}
                        rows={spotWidgets.openOrders}
                        cancelInFlightId={cancelingOrderId}
                        onCancel={(row) =>
                          typeof row.id === "string"
                            ? void handleCancelOrder(row.id)
                            : undefined
                        }
                      />
                    ) : null}
                    {activeActivityTab === "positions" ? (
                      <WidgetTable
                        title={activeWidgetTitleByTab.positions}
                        rows={spotWidgets.positions}
                      />
                    ) : null}
                    {activeActivityTab === "trades" ? (
                      <WidgetTable
                        title={activeWidgetTitleByTab.trades}
                        rows={spotWidgets.trades}
                      />
                    ) : null}
                    {activeActivityTab === "orderHistory" ? (
                      <WidgetTable
                        title={activeWidgetTitleByTab.orderHistory}
                        rows={spotWidgets.orderHistory}
                      />
                    ) : null}
                    {activeActivityTab === "balances" ? (
                      <WidgetTable
                        title={activeWidgetTitleByTab.balances}
                        rows={spotWidgets.balances}
                      />
                    ) : null}
                    {activeActivityTab === "pnl" ? (
                      <PnlWidget pnl={spotWidgets.pnl} assets={pnlAssetRows} />
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Card
              className={`${CARD_CLASS} ${isTradeMode ? "xl:sticky xl:top-20" : ""}`}
            >
              <CardContent className={isTradeMode ? "space-y-3" : "space-y-4"}>
                <div
                  className={`rounded-xl border border-border/75 bg-background/45 ${isTradeMode ? "space-y-3 p-3 shadow-inner" : "space-y-4 p-4"}`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Spot</span>
                    <Badge
                      variant={
                        selectedMode === "real" ? "destructive" : "secondary"
                      }
                    >
                      {selectedMode}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={orderForm.side === "buy" ? "default" : "outline"}
                      className={
                        orderForm.side === "buy" && isTradeMode
                          ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                          : ""
                      }
                      onClick={() =>
                        setOrderForm((prev) => ({ ...prev, side: "buy" }))
                      }
                    >
                      Buy
                    </Button>
                    <Button
                      variant={
                        orderForm.side === "sell" ? "destructive" : "outline"
                      }
                      onClick={() =>
                        setOrderForm((prev) => ({ ...prev, side: "sell" }))
                      }
                    >
                      Sell
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={
                        orderForm.order_type === "limit" ? "secondary" : "ghost"
                      }
                      onClick={() =>
                        setOrderForm((prev) => ({
                          ...prev,
                          order_type: "limit",
                        }))
                      }
                    >
                      Limit
                    </Button>
                    <Button
                      variant={
                        orderForm.order_type === "market"
                          ? "secondary"
                          : "ghost"
                      }
                      onClick={() =>
                        setOrderForm((prev) => ({
                          ...prev,
                          order_type: "market",
                        }))
                      }
                    >
                      Market
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label text="Account" />
                    <div
                      className={`${isTradeMode ? ORDER_PANEL_INPUT_CLASS : INPUT_CLASS} flex items-center justify-between`}
                    >
                      <span className="truncate">
                        {selectedAccount
                          ? `${selectedAccount.exchange_name} / ${selectedAccount.account_label}`
                          : "Not selected"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`grid gap-2 ${isTradeMode ? "sm:grid-cols-2" : ""}`}
                  >
                    {orderForm.order_type === "limit" ? (
                      <div className="space-y-1">
                        <Label text="Price" />
                        <input
                          className={
                            isTradeMode ? ORDER_PANEL_INPUT_CLASS : INPUT_CLASS
                          }
                          value={orderForm.price}
                          type="number"
                          step="any"
                          min={0}
                          onChange={(event) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              price: event.target.value,
                            }))
                          }
                          placeholder="Order price"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1">
                      <Label text="Quantity" />
                      <input
                        className={
                          isTradeMode ? ORDER_PANEL_INPUT_CLASS : INPUT_CLASS
                        }
                        value={orderForm.amount}
                        type="number"
                        step="any"
                        min={0}
                        onChange={(event) =>
                          setOrderForm((prev) => ({
                            ...prev,
                            amount: event.target.value,
                          }))
                        }
                        placeholder="Order quantity"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/75 bg-muted/15 p-3">
                    <Label text="TP / SL" />
                    <div className="mt-2 grid gap-3">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={orderForm.tp_enabled}
                            onChange={(event) => {
                              setOrderForm((prev) => ({
                                ...prev,
                                tp_enabled: event.target.checked,
                              }));
                              setTpLevelSource("manual");
                            }}
                          />
                          Take Profit
                          {tpLevelSource === "ai" ? (
                            <Badge variant="ai">AI</Badge>
                          ) : null}
                        </label>
                        <input
                          className={
                            isTradeMode ? ORDER_PANEL_INPUT_CLASS : INPUT_CLASS
                          }
                          type="number"
                          step="any"
                          min={0}
                          placeholder="TP trigger price"
                          value={orderForm.tp_trigger_price}
                          disabled={!orderForm.tp_enabled}
                          onChange={(event) => {
                            setOrderForm((prev) => ({
                              ...prev,
                              tp_trigger_price: event.target.value,
                            }));
                            setTpLevelSource("manual");
                          }}
                        />
                        <select
                          className={
                            isTradeMode ? ORDER_PANEL_INPUT_CLASS : INPUT_CLASS
                          }
                          value={orderForm.tp_order_type}
                          disabled={!orderForm.tp_enabled}
                          onChange={(event) => {
                            setOrderForm((prev) => ({
                              ...prev,
                              tp_order_type: event.target.value as
                                | "market"
                                | "limit",
                            }));
                            setTpLevelSource("manual");
                          }}
                        >
                          <option value="market">TP type: market</option>
                          <option value="limit">TP type: limit</option>
                        </select>
                        {orderForm.tp_enabled &&
                        orderForm.tp_order_type === "limit" ? (
                          <input
                            className={
                              isTradeMode
                                ? ORDER_PANEL_INPUT_CLASS
                                : INPUT_CLASS
                            }
                            type="number"
                            step="any"
                            min={0}
                            placeholder="TP limit price"
                            value={orderForm.tp_price}
                            onChange={(event) => {
                              setOrderForm((prev) => ({
                                ...prev,
                                tp_price: event.target.value,
                              }));
                              setTpLevelSource("manual");
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={orderForm.sl_enabled}
                            onChange={(event) => {
                              setOrderForm((prev) => ({
                                ...prev,
                                sl_enabled: event.target.checked,
                              }));
                              setSlLevelSource("manual");
                            }}
                          />
                          Stop Loss
                          {slLevelSource === "ai" ? (
                            <Badge variant="ai">AI</Badge>
                          ) : null}
                        </label>
                        <input
                          className={
                            isTradeMode ? ORDER_PANEL_INPUT_CLASS : INPUT_CLASS
                          }
                          type="number"
                          step="any"
                          min={0}
                          placeholder="SL trigger price"
                          value={orderForm.sl_trigger_price}
                          disabled={!orderForm.sl_enabled}
                          onChange={(event) => {
                            setOrderForm((prev) => ({
                              ...prev,
                              sl_trigger_price: event.target.value,
                            }));
                            setSlLevelSource("manual");
                          }}
                        />
                        <select
                          className={
                            isTradeMode ? ORDER_PANEL_INPUT_CLASS : INPUT_CLASS
                          }
                          value={orderForm.sl_order_type}
                          disabled={!orderForm.sl_enabled}
                          onChange={(event) => {
                            setOrderForm((prev) => ({
                              ...prev,
                              sl_order_type: event.target.value as
                                | "market"
                                | "limit",
                            }));
                            setSlLevelSource("manual");
                          }}
                        >
                          <option value="market">SL type: market</option>
                          <option value="limit">SL type: limit</option>
                        </select>
                        {orderForm.sl_enabled &&
                        orderForm.sl_order_type === "limit" ? (
                          <input
                            className={
                              isTradeMode
                                ? ORDER_PANEL_INPUT_CLASS
                                : INPUT_CLASS
                            }
                            type="number"
                            step="any"
                            min={0}
                            placeholder="SL limit price"
                            value={orderForm.sl_price}
                            onChange={(event) => {
                              setOrderForm((prev) => ({
                                ...prev,
                                sl_price: event.target.value,
                              }));
                              setSlLevelSource("manual");
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <Card className="border-dashed">
                    <CardHeader>
                      <CardTitle className="text-sm">Order Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p>Account: {orderPreview.accountText}</p>
                      <p>Order: {orderPreview.baseOrderText}</p>
                      <p>TP: {orderPreview.tpText}</p>
                      <p>SL: {orderPreview.slText}</p>
                    </CardContent>
                  </Card>
                  {selectedMode === "real" ? (
                    <p className="rounded-md border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                      You are sending a real order. Please verify all values
                      before confirming.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={armingEnabled}
                        onChange={(event) =>
                          setArmingEnabled(event.target.checked)
                        }
                        disabled={selectedMode !== "real"}
                      />
                      Arm real
                    </label>
                    <LoadingButton
                      className={
                        orderForm.side === "buy" && isTradeMode
                          ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                          : ""
                      }
                      onClick={() => void handlePlaceOrder()}
                      isLoading={isActionPending("place-order")}
                      loadingText="Placing..."
                      disabled={isOrderSubmitDisabled}
                    >
                      {orderForm.side === "buy" ? "Buy" : "Sell"}{" "}
                      {selectedMode === "demo" ? "Demo Trading" : ""}
                    </LoadingButton>
                  </div>
                </div>
                {orderFormError ? (
                  <p className="rounded-md border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                    {orderFormError}
                  </p>
                ) : null}
                {!isTradeMode ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <WidgetTable
                      title="Open Orders"
                      rows={spotWidgets.openOrders}
                      cancelInFlightId={cancelingOrderId}
                      onCancel={(row) =>
                        typeof row.id === "string"
                          ? void handleCancelOrder(row.id)
                          : undefined
                      }
                    />
                    <WidgetTable
                      title="Order History"
                      rows={spotWidgets.orderHistory}
                    />
                    <WidgetTable title="Trades" rows={spotWidgets.trades} />
                    <WidgetTable title="Balances" rows={spotWidgets.balances} />
                    <WidgetTable
                      title="Positions"
                      rows={spotWidgets.positions}
                    />
                    <PnlWidget pnl={spotWidgets.pnl} assets={pnlAssetRows} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {confirmState ? (
        <ConfirmModal
          title={confirmState.title}
          text={confirmState.text}
          onCancel={() => setConfirmState(null)}
          onConfirm={() =>
            void (async () => {
              setIsConfirmPending(true);
              try {
                await confirmState.onConfirm();
                setConfirmState(null);
              } catch (error) {
                setErrorMessage(toUserErrorMessage(error, "Operation failed"));
                setConfirmState(null);
              } finally {
                setIsConfirmPending(false);
              }
            })()
          }
          isLoading={isConfirmPending}
        />
      ) : null}
    </main>
  );
}

function WidgetTable({
  title,
  rows,
  onCancel,
  cancelInFlightId,
}: {
  title: string;
  rows: Record<string, unknown>[];
  onCancel?: (row: Record<string, unknown>) => void;
  cancelInFlightId?: string | null;
}) {
  const headers = rows.length > 0 ? Object.keys(rows[0]).slice(0, 7) : [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="max-h-72 overflow-auto overscroll-contain rounded-md border border-border/70 bg-background/35">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-2 py-2 text-left">
                      {header}
                    </th>
                  ))}
                  {onCancel ? (
                    <th className="px-2 py-2 text-left">action</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${title}-${index}`} className="border-t">
                    {headers.map((header) => (
                      <td
                        key={`${title}-${index}-${header}`}
                        className="px-2 py-1.5"
                      >
                        {renderWidgetCellValue(header, row[header])}
                      </td>
                    ))}
                    {onCancel ? (
                      <td className="px-2 py-1.5">
                        <LoadingButton
                          size="sm"
                          variant="outline"
                          onClick={() => onCancel(row)}
                          disabled={typeof row.id !== "string"}
                          isLoading={
                            typeof row.id === "string" &&
                            cancelInFlightId === row.id
                          }
                          loadingText="Canceling..."
                        >
                          Cancel
                        </LoadingButton>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PnlWidget({
  pnl,
  assets,
}: {
  pnl: SpotPnlRead | null;
  assets: SpotPnlAsset[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">PnL</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid gap-1 sm:grid-cols-3">
          <p>
            realized:{" "}
            <span className={formatPnlToneClass(pnl?.realized_pnl_quote)}>
              {pnl ? formatValue(pnl.realized_pnl_quote) : "-"}
            </span>
          </p>
          <p>
            unrealized:{" "}
            <span className={formatPnlToneClass(pnl?.unrealized_pnl_quote)}>
              {pnl ? formatValue(pnl.unrealized_pnl_quote) : "-"}
            </span>
          </p>
          <p>
            fees:{" "}
            <span className={formatPnlToneClass(pnl?.total_fees_quote, true)}>
              {pnl ? formatValue(pnl.total_fees_quote) : "-"}
            </span>
          </p>
        </div>
        <div className="max-h-40 overflow-auto overscroll-contain rounded-md border border-border/70 bg-background/35">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/70 backdrop-blur">
              <tr>
                <th className="px-2 py-1 text-left">asset</th>
                <th className="px-2 py-1 text-left">realized</th>
                <th className="px-2 py-1 text-left">unrealized</th>
                <th className="px-2 py-1 text-left">fees</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.asset} className="border-t">
                  <td className="px-2 py-1">{asset.asset}</td>
                  <td
                    className={`px-2 py-1 ${formatPnlToneClass(asset.realized_pnl_quote)}`}
                  >
                    {formatValue(asset.realized_pnl_quote)}
                  </td>
                  <td
                    className={`px-2 py-1 ${formatPnlToneClass(asset.unrealized_pnl_quote)}`}
                  >
                    {formatValue(asset.unrealized_pnl_quote)}
                  </td>
                  <td
                    className={`px-2 py-1 ${formatPnlToneClass(asset.total_fees_quote, true)}`}
                  >
                    {formatValue(asset.total_fees_quote)}
                  </td>
                </tr>
              ))}
              {assets.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-muted-foreground" colSpan={4}>
                    No asset breakdown
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmModal({
  title,
  text,
  onConfirm,
  onCancel,
  isLoading,
}: {
  title: string;
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <LoadingButton
            variant="destructive"
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Processing..."
          >
            Confirm
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

function LoadingButton({
  isLoading,
  loadingText,
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button> & {
  isLoading?: boolean;
  loadingText?: string;
}) {
  return (
    <Button {...props} disabled={disabled || isLoading}>
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isLoading ? (loadingText ?? children) : children}
    </Button>
  );
}

function getPreferredTrendScenario(run: AnalysisRun) {
  const trendExtraction = run.trendExtraction;
  if (!trendExtraction) {
    return null;
  }
  const scenarios: Array<{
    probabilityPct: number;
    takeProfit: number | null;
    stopLoss: number | null;
  }> = [];
  if (typeof trendExtraction.bull?.probabilityPct === "number") {
    scenarios.push(trendExtraction.bull);
  }
  if (typeof trendExtraction.flat?.probabilityPct === "number") {
    scenarios.push(trendExtraction.flat);
  }
  if (typeof trendExtraction.bear?.probabilityPct === "number") {
    scenarios.push(trendExtraction.bear);
  }
  if (!scenarios.length) {
    return null;
  }
  return scenarios.reduce((best, current) => {
    return current.probabilityPct > best.probabilityPct ? current : best;
  });
}

function toNullablePriceString(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return String(value);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value.toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return JSON.stringify(value);
}

function renderWidgetCellValue(header: string, value: unknown): ReactNode {
  const normalizedHeader = header.trim().toLowerCase();
  if (normalizedHeader === "side" && typeof value === "string") {
    return (
      <span
        className={`inline-flex items-center gap-1 ${formatSideToneClass(value)}`}
      >
        {isPositiveSide(value) ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : null}
        {isNegativeSide(value) ? (
          <ArrowDownRight className="h-3.5 w-3.5" />
        ) : null}
        {value}
      </span>
    );
  }

  if (normalizedHeader === "status" && typeof value === "string") {
    return (
      <Badge variant="outline" className={formatOrderStatusBadgeClass(value)}>
        {value}
      </Badge>
    );
  }

  if (normalizedHeader.includes("pnl") && typeof value === "number") {
    return (
      <span className={formatPnlToneClass(value)}>{formatValue(value)}</span>
    );
  }

  return formatValue(value);
}

function formatSideToneClass(side: string) {
  if (isPositiveSide(side)) {
    return "font-medium text-emerald-400";
  }
  if (isNegativeSide(side)) {
    return "font-medium text-red-400";
  }
  return "";
}

function isPositiveSide(side: string) {
  const normalized = side.trim().toLowerCase();
  return normalized === "buy" || normalized === "long";
}

function isNegativeSide(side: string) {
  const normalized = side.trim().toLowerCase();
  return normalized === "sell" || normalized === "short";
}

function formatOrderStatusBadgeClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-300";
  }
  if (normalized === "closed" || normalized === "filled") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-300";
  }
  if (
    normalized === "canceled" ||
    normalized === "cancelled" ||
    normalized === "rejected" ||
    normalized === "expired"
  ) {
    return "border-red-400/40 bg-red-500/10 text-red-300";
  }
  return "border-border/80 text-muted-foreground";
}

function formatPnlToneClass(value: number | null | undefined, inverse = false) {
  if (typeof value !== "number" || Number.isNaN(value) || value === 0) {
    return "text-muted-foreground";
  }
  if (inverse) {
    return value > 0
      ? "font-medium text-red-400"
      : "font-medium text-emerald-400";
  }
  return value > 0
    ? "font-medium text-emerald-400"
    : "font-medium text-red-400";
}
