"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess } from "@/lib/notifications";
import {
  useAdminRuntimeStore,
  adminRuntimeDefaults,
} from "@/stores/admin-runtime-store";

const ROW_HEIGHT = 72;
const ROW_OVERSCAN = 8;

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

const moneyNumber = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const integerNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const localDateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function detailsLimitsLabel(
  strategies: number,
  configs: number,
  positions: number,
) {
  return `S:${strategies} C:${configs} P:${positions}`;
}

function detailsLimitsKey(
  strategies: number,
  configs: number,
  positions: number,
) {
  return [strategies, configs, positions].join(":");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return localDateTime.format(date);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return moneyNumber.format(value);
}

function formatInteger(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }
  return integerNumber.format(value);
}

function statusClass(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  if (
    normalized.includes("run") ||
    normalized.includes("open") ||
    normalized.includes("active") ||
    normalized.includes("enabled")
  ) {
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  }
  if (
    normalized.includes("close") ||
    normalized.includes("stop") ||
    normalized.includes("inactive") ||
    normalized.includes("disable") ||
    normalized.includes("error")
  ) {
    return "border-rose-400/45 bg-rose-500/15 text-rose-100";
  }
  return "border-border/80 bg-muted/40 text-foreground";
}

function useVirtualRows(count: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(560);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const handleScroll = () => {
      setScrollTop(node.scrollTop);
    };
    handleScroll();

    node.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            setViewportHeight(node.clientHeight);
          });
    resizeObserver?.observe(node);
    setViewportHeight(node.clientHeight);

    return () => {
      node.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
    };
  }, []);

  const totalHeight = count * ROW_HEIGHT;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - ROW_OVERSCAN,
  );
  const endIndex = Math.min(
    count,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + ROW_OVERSCAN,
  );

  return {
    containerRef,
    scrollTop,
    viewportHeight,
    totalHeight,
    startIndex,
    endIndex,
  };
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <Card className="border-border/90 bg-card/90">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl font-semibold">{formatInteger(value)}</div>
      </CardContent>
    </Card>
  );
}

function TruncatedNotice({ visible }: { visible: boolean | undefined }) {
  if (!visible) {
    return null;
  }
  return (
    <p className="rounded-sm border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">
      Показаны не все записи, увеличьте лимит
    </p>
  );
}

export function AdminRuntimeDashboard() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const {
    usersById,
    userIds,
    userPageKeyById,
    pagesByKey,
    summary,
    generatedAt,
    selectedUserId,
    detailLimits,
    filters,
    hasMore,
    nextAfterUserId,
    accessDenied,
    errorMessage,
    isBootstrapping,
    isLoadingMore,
    detailLoadingUserId,
    isPrefetchingNext,
    isExporting,
    refresh,
    loadMoreUsers,
    prefetchNextUsers,
    setSelectedUser,
    setIncludeInactiveUsers,
    setPositionsStatus,
    ensureDetailsForSelectedUser,
    increaseDetailLimits,
    exportFullDetailsSnapshot,
  } = useAdminRuntimeStore(
    useShallow((state) => ({
      usersById: state.usersById,
      userIds: state.userIds,
      userPageKeyById: state.userPageKeyById,
      pagesByKey: state.pagesByKey,
      summary: state.summary,
      generatedAt: state.generatedAt,
      selectedUserId: state.selectedUserId,
      detailLimits: state.detailLimits,
      filters: state.filters,
      hasMore: state.hasMore,
      nextAfterUserId: state.nextAfterUserId,
      accessDenied: state.accessDenied,
      errorMessage: state.errorMessage,
      isBootstrapping: state.isBootstrapping,
      isLoadingMore: state.isLoadingMore,
      detailLoadingUserId: state.detailLoadingUserId,
      isPrefetchingNext: state.isPrefetchingNext,
      isExporting: state.isExporting,
      refresh: state.refresh,
      loadMoreUsers: state.loadMoreUsers,
      prefetchNextUsers: state.prefetchNextUsers,
      setSelectedUser: state.setSelectedUser,
      setIncludeInactiveUsers: state.setIncludeInactiveUsers,
      setPositionsStatus: state.setPositionsStatus,
      ensureDetailsForSelectedUser: state.ensureDetailsForSelectedUser,
      increaseDetailLimits: state.increaseDetailLimits,
      exportFullDetailsSnapshot: state.exportFullDetailsSnapshot,
    })),
  );

  const currentDetailsLabel = useMemo(
    () =>
      detailsLimitsLabel(
        detailLimits.strategies_limit_per_user,
        detailLimits.configs_limit_per_user,
        detailLimits.positions_limit_per_user,
      ),
    [detailLimits],
  );
  const currentDetailsKey = useMemo(
    () =>
      detailsLimitsKey(
        detailLimits.strategies_limit_per_user,
        detailLimits.configs_limit_per_user,
        detailLimits.positions_limit_per_user,
      ),
    [detailLimits],
  );
  const selectedRuntimeUser = useMemo(
    () => (selectedUserId !== null ? usersById[selectedUserId] : null),
    [selectedUserId, usersById],
  );
  const selectedPageKey = useMemo(
    () => (selectedUserId !== null ? userPageKeyById[selectedUserId] : undefined),
    [selectedUserId, userPageKeyById],
  );
  const selectedPage = useMemo(
    () => (selectedPageKey ? pagesByKey[selectedPageKey] : undefined),
    [selectedPageKey, pagesByKey],
  );
  const selectedDetailsLoaded = useMemo(
    () => selectedPage?.details_key === currentDetailsKey,
    [selectedPage?.details_key, currentDetailsKey],
  );

  const { containerRef, scrollTop, viewportHeight, totalHeight, startIndex, endIndex } =
    useVirtualRows(userIds.length);
  const visibleUserIds = useMemo(
    () => userIds.slice(startIndex, endIndex),
    [endIndex, startIndex, userIds],
  );

  const handleOpenDetails = useCallback(
    (userId: number) => {
      setSelectedUser(userId);
      setIsDrawerOpen(true);
    },
    [setSelectedUser],
  );

  const handleExport = useCallback(async () => {
    const snapshot = await exportFullDetailsSnapshot();
    if (!snapshot) {
      return;
    }

    const stamp = new Date().toISOString().replaceAll(":", "-");
    const filename = `admin-runtime-${stamp}.json`;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    notifySuccess("Export complete");
  }, [exportFullDetailsSnapshot]);

  useEffect(() => {
    const state = useAdminRuntimeStore.getState();
    const hasRuntimeData = state.summary !== null || state.userIds.length > 0;
    if (state.isBootstrapping || hasRuntimeData || state.accessDenied) {
      return;
    }

    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedUserId === null) {
      return;
    }
    void ensureDetailsForSelectedUser();
  }, [ensureDetailsForSelectedUser, selectedUserId]);

  useEffect(() => {
    if (redirectedRef.current || !accessDenied) {
      return;
    }
    redirectedRef.current = true;
    notifyError("Access denied. Admin role is required.");
    router.replace("/strategy");
  }, [accessDenied, router]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }
    notifyError(errorMessage, { dedupeKey: errorMessage });
  }, [errorMessage]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || isPrefetchingNext) {
      return;
    }
    const remaining = totalHeight - (scrollTop + viewportHeight);
    if (remaining < ROW_HEIGHT * 10) {
      void prefetchNextUsers();
    }
  }, [
    hasMore,
    isLoadingMore,
    isPrefetchingNext,
    prefetchNextUsers,
    scrollTop,
    totalHeight,
    viewportHeight,
  ]);

  const metrics = [
    { label: "Total Users", value: summary?.total_users },
    { label: "Active Users", value: summary?.active_users },
    { label: "Admin Users", value: summary?.admin_users },
    { label: "Strategies", value: summary?.total_strategies },
    { label: "Active Strategies", value: summary?.active_strategies },
    { label: "AT Configs", value: summary?.total_auto_trade_configs },
    { label: "Running AT", value: summary?.running_auto_trade_configs },
    { label: "AT Positions", value: summary?.total_auto_trade_positions },
    { label: "Open Positions", value: summary?.open_auto_trade_positions },
    { label: "Running Live Paper", value: summary?.running_live_paper_profiles },
  ];

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admin Runtime</h1>
          <p className="text-sm text-muted-foreground">
            Cross-user runtime snapshot. Updated{" "}
            <span className="text-foreground">{formatDate(generatedAt)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filters.include_inactive_users ? "default" : "outline"}
            onClick={() =>
              void setIncludeInactiveUsers(!filters.include_inactive_users)
            }
            disabled={isBootstrapping}
          >
            {filters.include_inactive_users ? "Including inactive" : "Only active"}
          </Button>
          <Button
            size="sm"
            variant={filters.positions_status === "all" ? "default" : "outline"}
            onClick={() => void setPositionsStatus("all")}
            disabled={isBootstrapping}
          >
            Positions: all
          </Button>
          <Button
            size="sm"
            variant={filters.positions_status === "open" ? "default" : "outline"}
            onClick={() => void setPositionsStatus("open")}
            disabled={isBootstrapping}
          >
            Positions: open
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refresh()}
            disabled={isBootstrapping}
          >
            {isBootstrapping ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={isExporting || isBootstrapping}
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export full slice
          </Button>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {metrics.map((metric) => (
          <SummaryCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </section>

      <Card className="border-border/90 bg-card/90">
        <CardHeader className="border-b border-border/70">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span>Users ({formatInteger(userIds.length)})</span>
                <span className="text-xs text-muted-foreground">
                  page size {adminRuntimeDefaults.usersLimit}, details{" "}
                  {currentDetailsLabel}
                </span>
              </CardTitle>
            </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-[minmax(220px,1.8fr)_110px_1fr_1fr_120px] gap-3 border-b border-border/70 px-2 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>User</span>
            <span>Flags</span>
            <span>Strategies</span>
            <span>Auto-trade</span>
            <span className="text-right">Details</span>
          </div>

          <div
            ref={containerRef}
            className="relative h-[560px] overflow-auto rounded-md border border-border/70 bg-background/45"
          >
            <div className="relative" style={{ height: `${totalHeight}px` }}>
              {visibleUserIds.map((userId, visibleIndex) => {
                const rowIndex = startIndex + visibleIndex;
                const runtimeUser = usersById[userId];
                const stats = runtimeUser?.stats;
                if (!runtimeUser || !stats) {
                  return null;
                }
                const isSelected = selectedUserId === userId;
                const top = rowIndex * ROW_HEIGHT;

                return (
                  <div
                    key={userId}
                    className={cn(
                      "absolute left-0 right-0 grid h-[72px] grid-cols-[minmax(220px,1.8fr)_110px_1fr_1fr_120px] items-center gap-3 border-b border-border/60 px-2 text-sm",
                      isSelected && "bg-primary/8",
                    )}
                    style={{ top }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{runtimeUser.user.email}</div>
                      <div className="text-xs text-muted-foreground">
                        id #{runtimeUser.user.id}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          runtimeUser.user.is_active
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                            : "border-rose-400/40 bg-rose-500/15 text-rose-100",
                        )}
                      >
                        {runtimeUser.user.is_active ? "active" : "inactive"}
                      </Badge>
                      {runtimeUser.user.is_admin ? (
                        <Badge variant="outline" className="border-sky-400/40 bg-sky-500/15 text-sky-100">
                          admin
                        </Badge>
                      ) : null}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      total {compactNumber.format(stats.total_strategies)} / active{" "}
                      {compactNumber.format(stats.active_strategies)}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      cfg {compactNumber.format(stats.auto_trade_configs)} / run{" "}
                      {compactNumber.format(stats.running_auto_trade_configs)} / pos{" "}
                      {compactNumber.format(stats.auto_trade_positions)}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant={isSelected && isDrawerOpen ? "default" : "outline"}
                        onClick={() => handleOpenDetails(userId)}
                      >
                        Open
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              next cursor:{" "}
              <span className="text-foreground">
                {nextAfterUserId === null ? "none" : nextAfterUserId}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void increaseDetailLimits()}
                disabled={selectedUserId === null || detailLoadingUserId !== null}
              >
                {detailLoadingUserId !== null ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Show more details
              </Button>
              <Button
                size="sm"
                onClick={() => void loadMoreUsers()}
                disabled={!hasMore || isLoadingMore}
              >
                {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                Load more users
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        className={cn(
          "fixed inset-0 z-50 transition",
          isDrawerOpen && selectedRuntimeUser ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/55 transition-opacity",
            isDrawerOpen && selectedRuntimeUser ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsDrawerOpen(false)}
        />
        <aside
          className={cn(
            "absolute right-0 top-0 h-full w-full max-w-[720px] overflow-y-auto border-l border-border/80 bg-background p-4 shadow-2xl transition-transform duration-200",
            isDrawerOpen && selectedRuntimeUser ? "translate-x-0" : "translate-x-full",
          )}
        >
          {selectedRuntimeUser ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
                <div>
                  <h2 className="text-base font-semibold">User details</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedRuntimeUser.user.email}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {!selectedDetailsLoaded ? (
                <div className="rounded-md border border-primary/35 bg-primary/10 px-3 py-2 text-sm text-primary-foreground">
                  {detailLoadingUserId === selectedRuntimeUser.user.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Loading details...
                    </span>
                  ) : (
                    "Details are not loaded for the current limits."
                  )}
                </div>
              ) : null}

              <Card className="border-border/90">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-sm">Strategies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <TruncatedNotice visible={selectedRuntimeUser.strategies_truncated} />
                  {(selectedRuntimeUser.strategies ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No strategies</p>
                  ) : (
                    (selectedRuntimeUser.strategies ?? []).map((strategy) => (
                      <div
                        key={strategy.id}
                        className="rounded-sm border border-border/70 px-2 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{strategy.name}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              strategy.is_active
                                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                                : "border-rose-400/40 bg-rose-500/15 text-rose-100",
                            )}
                          >
                            {strategy.is_active ? "active" : "inactive"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {strategy.strategy_type} v{strategy.version} • updated{" "}
                          {formatDate(strategy.updated_at)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/90">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-sm">Auto-trade configs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <TruncatedNotice
                    visible={selectedRuntimeUser.auto_trade_configs_truncated}
                  />
                  {(selectedRuntimeUser.auto_trade_configs ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No configs</p>
                  ) : (
                    (selectedRuntimeUser.auto_trade_configs ?? []).map((config) => (
                      <div
                        key={config.id}
                        className="rounded-sm border border-border/70 px-2 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">
                            #{config.id} • account {config.account_id}
                          </p>
                          <Badge variant="outline" className={cn(statusClass(config.is_running ? "running" : "stopped"))}>
                            {config.is_running ? "running" : "stopped"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          enabled {String(config.enabled)} • size{" "}
                          {formatMoney(config.position_size_usdt)} USDT • lev{" "}
                          {formatInteger(config.leverage)} • risk {config.risk_mode}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          started {formatDate(config.last_started_at)} • updated{" "}
                          {formatDate(config.updated_at)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/90">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-sm">Auto-trade positions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <TruncatedNotice
                    visible={selectedRuntimeUser.auto_trade_positions_truncated}
                  />
                  {(selectedRuntimeUser.auto_trade_positions ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No positions</p>
                  ) : (
                    (selectedRuntimeUser.auto_trade_positions ?? []).map((position) => (
                      <div
                        key={position.id}
                        className="rounded-sm border border-border/70 px-2 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">
                            {position.symbol} • {position.side.toUpperCase()}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(statusClass(position.status))}
                          >
                            {position.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          entry {formatMoney(position.entry_price)} • qty{" "}
                          {formatMoney(position.quantity)} • size{" "}
                          {formatMoney(position.position_size_usdt)} USDT • lev{" "}
                          {formatInteger(position.leverage)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          opened {formatDate(position.opened_at)} • closed{" "}
                          {formatDate(position.closed_at)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/90">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-sm">Live paper profile</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedRuntimeUser.live_paper_profile ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          strategy #{selectedRuntimeUser.live_paper_profile.strategy_id}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            statusClass(
                              selectedRuntimeUser.live_paper_profile.is_running
                                ? "running"
                                : "stopped",
                            ),
                          )}
                        >
                          {selectedRuntimeUser.live_paper_profile.is_running
                            ? "running"
                            : "stopped"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        total balance{" "}
                        {formatMoney(
                          selectedRuntimeUser.live_paper_profile.total_balance_usdt,
                        )}{" "}
                        USDT • per trade{" "}
                        {formatMoney(
                          selectedRuntimeUser.live_paper_profile.per_trade_usdt,
                        )}{" "}
                        USDT
                      </p>
                      <p className="text-xs text-muted-foreground">
                        last processed{" "}
                        {formatDate(
                          selectedRuntimeUser.live_paper_profile.last_processed_at,
                        )}{" "}
                        • last poll{" "}
                        {formatDate(selectedRuntimeUser.live_paper_profile.last_poll_at)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No live paper profile
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="mt-20 flex flex-col items-center gap-2 text-center">
              <ShieldAlert className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a user to see details.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
