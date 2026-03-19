"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { AutoTradeConfigForm } from "@/components/auto-trade/auto-trade-config-form";
import { AutoTradeChartPanel } from "@/components/auto-trade/auto-trade-chart-panel";
import { AutoTradePnlCards } from "@/components/auto-trade/auto-trade-pnl-cards";
import { AutoTradeSyncWarning } from "@/components/auto-trade/auto-trade-sync-warning";
import { AutoTradeTradesTable } from "@/components/auto-trade/auto-trade-trades-table";
import {
  toAutoTradeForm,
  formatDateTime,
  getAutoTradeValidation,
  normalizeRiskMode,
  isSupportedAutoTradeExchange,
} from "@/components/auto-trade/utils";
import type { AutoTradeFormState } from "@/components/auto-trade/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { INPUT_CLASS } from "@/components/trading/form-controls";
import {
  ApiError,
  getAccountTrades,
  getAutoTradeConfig,
  getAutoTradeEvents,
  getAutoTradeState,
  getMarketMeta,
  getMarketOhlcv,
  listAutoTradeConfigs,
  listExchangeAccounts,
  listPersonalAnalysisProfiles,
  playAutoTrade,
  stopAutoTrade,
  upsertAutoTradeConfig,
  type AccountAutoTradeEventRead,
  type AccountTradeRead,
  type AccountTradesPnlRead,
  type AutoTradeConfigRead,
  type AutoTradeEventRead,
  type AutoTradeStateResponse,
  type ExchangeAccountRead,
  type MarketMetaResponse,
  type PersonalAnalysisProfileRead,
} from "@/lib/api";
import {
  mapAccountTradesToChartMarkers,
  mapAutoTradeEventsToTimelineRows,
  normalizeSymbolForChart,
  normalizeSymbolForMarketQuery,
} from "@/lib/auto-trade/mappers";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { mapMarketRowsToCandles } from "@/lib/trading/mappers";

const CARD_CLASS = "border-border/90 bg-card/90 shadow-none";
const EVENTS_LIMIT = 50;
const TRADES_LIMIT = 120;
const FALLBACK_TIMEFRAME = "1h";
const FALLBACK_BARS = 300;

export function AutoTradeDashboard() {
  const [profiles, setProfiles] = useState<PersonalAnalysisProfileRead[]>([]);
  const [accounts, setAccounts] = useState<ExchangeAccountRead[]>([]);
  const [configs, setConfigs] = useState<AutoTradeConfigRead[]>([]);
  const [marketMeta, setMarketMeta] = useState<MarketMetaResponse | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [runtimeState, setRuntimeState] =
    useState<AutoTradeStateResponse | null>(null);
  const [accountTrades, setAccountTrades] = useState<AccountTradeRead[]>([]);
  const [accountTradesPnl, setAccountTradesPnl] =
    useState<AccountTradesPnlRead | null>(null);
  const [accountAutoEvents, setAccountAutoEvents] = useState<
    AccountAutoTradeEventRead[]
  >([]);
  const [events, setEvents] = useState<AutoTradeEventRead[]>([]);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [candles, setCandles] = useState<
    ReturnType<typeof mapMarketRowsToCandles>
  >([]);
  const [chartMarkers, setChartMarkers] = useState<
    ReturnType<typeof mapAccountTradesToChartMarkers>
  >([]);
  const [form, setForm] = useState<AutoTradeFormState>(toAutoTradeForm(null));
  const [timeframe, setTimeframe] = useState(FALLBACK_TIMEFRAME);
  const [bars, setBars] = useState(FALLBACK_BARS);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(false);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [isTradesLoading, setIsTradesLoading] = useState(false);
  const [isPnlLoading, setIsPnlLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayBusy, setIsPlayBusy] = useState(false);
  const [isStopBusy, setIsStopBusy] = useState(false);

  const requestIdRef = useRef(0);
  const selectedFormAccount = useMemo(
    () => accounts.find((account) => account.id === form.account_id) ?? null,
    [accounts, form.account_id],
  );
  const selectedScopeAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );
  const supportedAccounts = useMemo(
    () => accounts.filter((account) => isSupportedAutoTradeExchange(account)),
    [accounts],
  );
  const configuredAccountIds = useMemo(
    () => new Set(configs.map((config) => config.account_id)),
    [configs],
  );
  const creatableAccounts = useMemo(
    () =>
      supportedAccounts.filter(
        (account) => !configuredAccountIds.has(account.id),
      ),
    [configuredAccountIds, supportedAccounts],
  );
  const hasConfigForScope = useMemo(() => {
    if (selectedAccountId === null) {
      return false;
    }
    return configuredAccountIds.has(selectedAccountId);
  }, [configuredAccountIds, selectedAccountId]);
  const configForScope = useMemo(
    () => configs.find((item) => item.account_id === selectedAccountId) ?? null,
    [configs, selectedAccountId],
  );
  const profileForScope = useMemo(() => {
    const profileId = configForScope?.profile_id ?? form.profile_id;
    if (!profileId) {
      return null;
    }
    return profiles.find((item) => item.id === profileId) ?? null;
  }, [configForScope?.profile_id, form.profile_id, profiles]);
  const scopeSymbol = useMemo(
    () => normalizeSymbolForChart(profileForScope?.symbol),
    [profileForScope?.symbol],
  );
  const scopeMarketSymbol = useMemo(
    () => normalizeSymbolForMarketQuery(profileForScope?.symbol),
    [profileForScope?.symbol],
  );
  const scopeExchangeName = selectedScopeAccount?.exchange_name;
  const availableTimeframes = useMemo(() => {
    const list = marketMeta?.common_timeframes ?? [];
    if (list.length > 0) {
      return list;
    }
    return [FALLBACK_TIMEFRAME];
  }, [marketMeta?.common_timeframes]);
  const minBars = marketMeta?.min_bars ?? 50;
  const maxBars = marketMeta?.max_bars ?? 2000;
  const quickTimelineRows = useMemo(
    () => mapAutoTradeEventsToTimelineRows(accountAutoEvents, []),
    [accountAutoEvents],
  );
  const validation = useMemo(
    () => getAutoTradeValidation(form, selectedFormAccount),
    [form, selectedFormAccount],
  );
  const canPlayStop = selectedAccountId !== null && hasConfigForScope;

  const loadScoped = useCallback(
    async ({
      accountId,
      symbol,
      marketSymbol,
      timeframeValue,
      barsValue,
      exchangeName,
      showLoader = true,
    }: {
      accountId: number;
      symbol: string;
      marketSymbol: string;
      timeframeValue: string;
      barsValue: number;
      exchangeName?: string;
      showLoader?: boolean;
    }) => {
      const requestId = ++requestIdRef.current;
      if (showLoader) {
        setIsConfigLoading(true);
        setIsRuntimeLoading(true);
        setIsEventsLoading(true);
        setIsTradesLoading(true);
        setIsPnlLoading(true);
        setIsChartLoading(true);
      }

      const applyIfCurrent = (apply: () => void) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        apply();
      };

      const configPromise = (async () => {
        try {
          const configResponse = await getAutoTradeConfig({
            account_id: accountId,
          });
          applyIfCurrent(() => {
            setForm(toAutoTradeForm(configResponse));
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            applyIfCurrent(() => {
              setForm((prev) => ({
                ...toAutoTradeForm(null),
                account_id: accountId,
                profile_id: prev.profile_id,
              }));
            });
            return;
          }
          throw error;
        } finally {
          applyIfCurrent(() => {
            setIsConfigLoading(false);
          });
        }
      })();

      const runtimePromise = (async () => {
        try {
          const stateResponse = await getAutoTradeState({
            account_id: accountId,
          });
          applyIfCurrent(() => {
            setRuntimeState(stateResponse);
          });
        } catch {
          applyIfCurrent(() => {
            setRuntimeState(null);
          });
        } finally {
          applyIfCurrent(() => {
            setIsRuntimeLoading(false);
          });
        }
      })();

      const eventsPromise = (async () => {
        try {
          const eventsResponse = await getAutoTradeEvents({
            account_id: accountId,
            limit: EVENTS_LIMIT,
          });
          applyIfCurrent(() => {
            setEvents(eventsResponse.events ?? []);
          });
        } catch {
          applyIfCurrent(() => {
            setEvents([]);
          });
        } finally {
          applyIfCurrent(() => {
            setIsEventsLoading(false);
          });
        }
      })();

      const tradesPromise = (async () => {
        if (!symbol) {
          applyIfCurrent(() => {
            setAccountTrades([]);
            setAccountAutoEvents([]);
            setSyncWarnings([]);
            setChartMarkers([]);
            setAccountTradesPnl(null);
            setIsTradesLoading(false);
            setIsPnlLoading(false);
          });
          return;
        }

        try {
          const tradesResponse = await getAccountTrades({
            account_id: accountId,
            symbol,
            limit: TRADES_LIMIT,
            events_limit: EVENTS_LIMIT,
          });
          applyIfCurrent(() => {
            const tradesRows = tradesResponse.trades ?? [];
            setAccountTrades(tradesRows);
            setAccountTradesPnl(tradesResponse.pnl ?? null);
            setAccountAutoEvents(tradesResponse.auto_trade_events ?? []);
            setSyncWarnings(tradesResponse.sync_warnings ?? []);
            setChartMarkers(mapAccountTradesToChartMarkers(tradesRows));
          });
        } catch {
          applyIfCurrent(() => {
            setAccountTrades([]);
            setAccountAutoEvents([]);
            setSyncWarnings([]);
            setChartMarkers([]);
            setAccountTradesPnl(null);
          });
        } finally {
          applyIfCurrent(() => {
            setIsTradesLoading(false);
            setIsPnlLoading(false);
          });
        }
      })();

      const chartPromise = (async () => {
        if (!marketSymbol || !exchangeName) {
          applyIfCurrent(() => {
            setCandles([]);
            setIsChartLoading(false);
          });
          return;
        }
        try {
          const marketResponse = await getMarketOhlcv({
            exchange_name: exchangeName,
            symbol: marketSymbol,
            timeframe: timeframeValue,
            bars: barsValue,
          });
          applyIfCurrent(() => {
            setCandles(mapMarketRowsToCandles(marketResponse));
          });
        } catch {
          applyIfCurrent(() => {
            setCandles([]);
          });
        } finally {
          applyIfCurrent(() => {
            setIsChartLoading(false);
          });
        }
      })();

      await Promise.allSettled([configPromise, runtimePromise, eventsPromise]);
      await Promise.allSettled([tradesPromise, chartPromise]);
    },
    [],
  );

  const loadPage = useCallback(async () => {
    setIsPageLoading(true);
    setIsMetaLoading(true);
    try {
      const [configsResult, profilesResult, accountsResult, marketMetaResult] =
        await Promise.allSettled([
          listAutoTradeConfigs(),
          listPersonalAnalysisProfiles(),
          listExchangeAccounts(),
          getMarketMeta(),
        ]);
      if (configsResult.status !== "fulfilled") {
        throw configsResult.reason;
      }
      const configsRes = configsResult.value;
      const nextConfigs = configsRes.configs ?? [];
      setConfigs(nextConfigs);

      const nextAccountId =
        configsRes.active_account_id ??
        configsRes.active_config?.account_id ??
        nextConfigs[0]?.account_id ??
        null;
      setSelectedAccountId(nextAccountId);
      setIsPageLoading(false);

      const nextProfiles =
        profilesResult.status === "fulfilled" ? profilesResult.value : [];
      const nextAccounts =
        accountsResult.status === "fulfilled" ? accountsResult.value : [];
      setProfiles(nextProfiles);
      setAccounts(nextAccounts);
      if (marketMetaResult.status === "fulfilled") {
        setMarketMeta(marketMetaResult.value);
        setTimeframe(
          marketMetaResult.value.default_timeframe || FALLBACK_TIMEFRAME,
        );
        setBars(
          clampBars(
            marketMetaResult.value.default_bars || FALLBACK_BARS,
            marketMetaResult.value.min_bars,
            marketMetaResult.value.max_bars,
          ),
        );
      } else {
        setMarketMeta(null);
      }

      setSelectedAccountId((prev) => {
        if (prev !== null) {
          return prev;
        }
        return supportedAccountsFrom(nextAccounts)[0]?.id ?? null;
      });
    } catch (error) {
      notifyError(toUserError(error, "Failed to load auto-trade page."));
    } finally {
      setIsPageLoading(false);
      setIsMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (selectedAccountId === null || isPageLoading) {
      return;
    }
    void loadScoped({
      accountId: selectedAccountId,
      symbol: scopeSymbol,
      marketSymbol: scopeMarketSymbol,
      timeframeValue: timeframe,
      barsValue: bars,
      exchangeName: scopeExchangeName,
    });
  }, [
    bars,
    isPageLoading,
    loadScoped,
    scopeExchangeName,
    scopeMarketSymbol,
    scopeSymbol,
    selectedAccountId,
    timeframe,
  ]);

  const handleRefresh = useCallback(async () => {
    await loadPage();
    notifySuccess("Auto-trade data refreshed.");
  }, [loadPage]);

  const handleSave = useCallback(async () => {
    if (!validation.isValid) {
      notifyError(validation.message);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        enabled: form.enabled,
        profile_id: form.profile_id as number,
        account_id: form.account_id as number,
        position_size_usdt: form.position_size_usdt,
        leverage: Math.round(form.leverage),
        min_confidence_pct: form.min_confidence_pct,
        fast_close_confidence_pct: form.fast_close_confidence_pct,
        confirm_reports_required: Math.round(form.confirm_reports_required),
        risk_mode: normalizeRiskMode(form.risk_mode),
        sl_pct: form.sl_pct,
        tp_pct: form.tp_pct,
      };

      const savedConfig = await upsertAutoTradeConfig(payload);
      const nextConfigsResponse = await listAutoTradeConfigs();
      setConfigs(nextConfigsResponse.configs ?? []);
      setSelectedAccountId(savedConfig.account_id);
      const savedProfile =
        profiles.find((item) => item.id === savedConfig.profile_id) ?? null;
      const savedAccount =
        accounts.find((item) => item.id === savedConfig.account_id) ?? null;
      await loadScoped({
        accountId: savedConfig.account_id,
        symbol: normalizeSymbolForChart(savedProfile?.symbol),
        marketSymbol: normalizeSymbolForMarketQuery(savedProfile?.symbol),
        timeframeValue: timeframe,
        barsValue: bars,
        exchangeName: savedAccount?.exchange_name,
      });
      notifySuccess("Auto-trade config saved.");
    } catch (error) {
      notifyError(toUserError(error, "Failed to save config."));
    } finally {
      setIsSaving(false);
    }
  }, [
    accounts,
    bars,
    form,
    loadScoped,
    profiles,
    timeframe,
    validation.isValid,
    validation.message,
  ]);

  const handleStartCreate = useCallback(() => {
    if (creatableAccounts.length === 0) {
      notifyError("No supported accounts available for creating a new config.");
      return;
    }
    const defaultAccountId = creatableAccounts[0].id;
    setRuntimeState(null);
    setEvents([]);
    setSelectedAccountId(defaultAccountId);
    setForm((prev) => ({
      ...toAutoTradeForm(null),
      account_id: defaultAccountId,
      profile_id: prev.profile_id,
    }));
  }, [creatableAccounts]);

  const handlePlay = useCallback(async () => {
    if (!selectedAccountId) {
      notifyError("Select account scope first.");
      return;
    }
    setIsPlayBusy(true);
    try {
      await playAutoTrade({ account_id: selectedAccountId });
      await loadScoped({
        accountId: selectedAccountId,
        symbol: scopeSymbol,
        marketSymbol: scopeMarketSymbol,
        timeframeValue: timeframe,
        barsValue: bars,
        exchangeName: scopeExchangeName,
      });
      notifySuccess("Auto-trade started.");
    } catch (error) {
      notifyError(toUserError(error, "Failed to start auto-trade."));
    } finally {
      setIsPlayBusy(false);
    }
  }, [
    bars,
    loadScoped,
    scopeExchangeName,
    scopeMarketSymbol,
    scopeSymbol,
    selectedAccountId,
    timeframe,
  ]);

  const handleStop = useCallback(async () => {
    if (!selectedAccountId) {
      notifyError("Select account scope first.");
      return;
    }
    setIsStopBusy(true);
    try {
      await stopAutoTrade({ account_id: selectedAccountId });
      await loadScoped({
        accountId: selectedAccountId,
        symbol: scopeSymbol,
        marketSymbol: scopeMarketSymbol,
        timeframeValue: timeframe,
        barsValue: bars,
        exchangeName: scopeExchangeName,
      });
      notifySuccess("Auto-trade stopped.");
    } catch (error) {
      notifyError(toUserError(error, "Failed to stop auto-trade."));
    } finally {
      setIsStopBusy(false);
    }
  }, [
    bars,
    loadScoped,
    scopeExchangeName,
    scopeMarketSymbol,
    scopeSymbol,
    selectedAccountId,
    timeframe,
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Auto Trade</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage auto-trade config scoped by exchange account.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void handleRefresh()}
          disabled={isPageLoading}
        >
          {isPageLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Config Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${INPUT_CLASS} min-w-[320px] flex-1`}
                value={selectedAccountId ?? ""}
                onChange={(event) =>
                  setSelectedAccountId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                disabled={
                  isPageLoading ||
                  (isMetaLoading && supportedAccounts.length === 0)
                }
              >
                <option value="">
                  {supportedAccounts.length
                    ? "Select account scope"
                    : "No supported accounts"}
                </option>
                {supportedAccounts.map((account) => {
                  const accountConfig = configs.find(
                    (item) => item.account_id === account.id,
                  );
                  const profile = accountConfig
                    ? profiles.find(
                        (item) => item.id === accountConfig.profile_id,
                      )
                    : null;
                  const statusLabel = accountConfig
                    ? `config #${accountConfig.id} / profile #${profile?.id ?? accountConfig.profile_id}`
                    : "new config";
                  return (
                    <option key={account.id} value={account.id}>
                      {account.account_label} / {account.exchange_name} /{" "}
                      {account.mode} / {statusLabel}
                    </option>
                  );
                })}
              </select>
              <Button
                variant="outline"
                onClick={handleStartCreate}
                disabled={creatableAccounts.length === 0}
              >
                Create new
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Runtime Controls</CardTitle>
            <CardDescription>
              Start/stop execution for current account scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={runtimeState?.config?.enabled ? "default" : "outline"}
              >
                enabled: {String(runtimeState?.config?.enabled ?? false)}
              </Badge>
              <Badge
                variant={
                  runtimeState?.config?.is_running ? "default" : "outline"
                }
              >
                running: {String(runtimeState?.config?.is_running ?? false)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void handlePlay()}
                disabled={!canPlayStop || isPlayBusy}
              >
                {isPlayBusy ? "Starting..." : "Play"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleStop()}
                disabled={!canPlayStop || isStopBusy}
              >
                {isStopBusy ? "Stopping..." : "Stop"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AutoTradeSyncWarning warnings={syncWarnings} />

      <div className="mt-4">
        <AutoTradeChartPanel
          candles={candles}
          markers={chartMarkers}
          symbol={scopeMarketSymbol}
          timeframe={timeframe}
          bars={bars}
          minBars={minBars}
          maxBars={maxBars}
          timeframes={availableTimeframes}
          isLoading={isChartLoading}
          onTimeframeChange={setTimeframe}
          onBarsChange={setBars}
        />
      </div>

      <div className="mt-4">
        <AutoTradePnlCards
          accountPnl={accountTradesPnl}
          isLoading={isPnlLoading}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Auto Trade Config</CardTitle>
          </CardHeader>
          <CardContent>
            {isPageLoading || isConfigLoading ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading config...
              </p>
            ) : (
              <AutoTradeConfigForm
                form={form}
                profiles={profiles}
                accounts={accounts}
                isBusy={isSaving}
                validationMessage={validation.message}
                onChange={(updater) => setForm((prev) => updater(prev))}
                onSubmit={() => void handleSave()}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={CARD_CLASS}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Runtime State & Trades</CardTitle>
                {isRuntimeLoading ? (
                  <Badge variant="outline" className="text-xs">
                    Loading...
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                last_started_at:{" "}
                {formatDateTime(runtimeState?.config?.last_started_at)}
              </p>
              <p>
                last_stopped_at:{" "}
                {formatDateTime(runtimeState?.config?.last_stopped_at)}
              </p>
              <p>symbol: {scopeSymbol || "-"}</p>
              <p>loaded trades: {accountTrades.length}</p>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Quick Log (account trades sync)</CardTitle>
                {isTradesLoading ? (
                  <Badge variant="outline" className="text-xs">
                    Loading...
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {quickTimelineRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="max-h-[360px] overflow-auto rounded-md border border-border/70">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-2 py-2 text-left">Time</th>
                        <th className="px-2 py-2 text-left">Source</th>
                        <th className="px-2 py-2 text-left">Level</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickTimelineRows.map((event) => (
                        <tr
                          key={event.id}
                          className="border-t border-border/60"
                        >
                          <td className="px-2 py-1.5">
                            {formatDateTime(event.created_at)}
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge variant="outline">
                              {event.source === "account_trades"
                                ? "sync"
                                : "runtime"}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5">{event.level}</td>
                          <td className="px-2 py-1.5">{event.event_type}</td>
                          <td className="px-2 py-1.5">
                            {event.message ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {!hasConfigForScope && selectedScopeAccount ? (
            <Card className={CARD_CLASS}>
              <CardHeader>
                <CardTitle>Create Mode</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                No config exists for `{selectedScopeAccount.account_label}` yet.
                Fill the form and click `Save config` to create one.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>User Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <AutoTradeTradesTable
              trades={accountTrades}
              isLoading={isTradesLoading}
            />
          </CardContent>
        </Card>
        <Card className={CARD_CLASS}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Full Auto-mode Event Log</CardTitle>
              {isEventsLoading ? (
                <Badge variant="outline" className="text-xs">
                  Loading...
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="max-h-[360px] overflow-auto rounded-md border border-border/70">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-2 text-left">Time</th>
                      <th className="px-2 py-2 text-left">Level</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-t border-border/60">
                        <td className="px-2 py-1.5">
                          {formatDateTime(event.created_at)}
                        </td>
                        <td className="px-2 py-1.5">{event.level}</td>
                        <td className="px-2 py-1.5">{event.event_type}</td>
                        <td className="px-2 py-1.5">{event.message ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function supportedAccountsFrom(accounts: ExchangeAccountRead[]) {
  return accounts.filter((account) => isSupportedAutoTradeExchange(account));
}

function toUserError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "Resource not found for selected account scope.";
    }
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function clampBars(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
