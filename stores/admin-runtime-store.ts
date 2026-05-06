"use client";

import { create } from "zustand";
import {
  ApiError,
  getAdminRuntimeSnapshot,
  type AdminRuntimePositionsStatus,
  type AdminRuntimeQuery,
  type AdminRuntimeSnapshotResponse,
  type AdminRuntimeSummaryRead,
  type AdminUserRuntimeRead,
} from "@/lib/api";

const DEFAULT_USERS_LIMIT = 50;
const MAX_USERS_LIMIT = 200;
const DEFAULT_STRATEGIES_LIMIT = 20;
const DEFAULT_CONFIGS_LIMIT = 10;
const DEFAULT_POSITIONS_LIMIT = 30;
const MAX_STRATEGIES_LIMIT = 200;
const MAX_CONFIGS_LIMIT = 100;
const MAX_POSITIONS_LIMIT = 500;

type DetailLimits = {
  strategies_limit_per_user: number;
  configs_limit_per_user: number;
  positions_limit_per_user: number;
};

type RuntimeFilters = {
  include_inactive_users: boolean;
  positions_status: AdminRuntimePositionsStatus;
};

type RuntimePage = {
  after_user_id: number | null;
  next_after_user_id: number | null;
  has_more: boolean;
  user_ids: number[];
  details_key?: string;
};

type AdminRuntimeStore = {
  usersById: Record<number, AdminUserRuntimeRead>;
  userIds: number[];
  userPageKeyById: Record<number, string>;
  pagesByKey: Record<string, RuntimePage>;
  summary: AdminRuntimeSummaryRead | null;
  generatedAt: string | null;
  usersLimit: number;
  detailLimits: DetailLimits;
  filters: RuntimeFilters;
  selectedUserId: number | null;
  nextAfterUserId: number | null;
  hasMore: boolean;
  isBootstrapping: boolean;
  isLoadingMore: boolean;
  detailLoadingUserId: number | null;
  isPrefetchingNext: boolean;
  isExporting: boolean;
  accessDenied: boolean;
  errorMessage: string | null;
  setSelectedUser: (userId: number | null) => void;
  setIncludeInactiveUsers: (value: boolean) => Promise<void>;
  setPositionsStatus: (value: AdminRuntimePositionsStatus) => Promise<void>;
  refresh: () => Promise<void>;
  loadMoreUsers: () => Promise<void>;
  prefetchNextUsers: () => Promise<void>;
  ensureDetailsForSelectedUser: () => Promise<void>;
  ensureDetailsForUser: (userId: number) => Promise<void>;
  increaseDetailLimits: () => Promise<void>;
  exportFullDetailsSnapshot: () => Promise<AdminRuntimeSnapshotResponse | null>;
};

type QueryRequestOptions = {
  force?: boolean;
  cancelGroup?: string;
};

const snapshotCache = new Map<string, AdminRuntimeSnapshotResponse>();
const inFlightByQueryKey = new Map<string, Promise<AdminRuntimeSnapshotResponse>>();
const controllersByQueryKey = new Map<string, AbortController>();
const queryKeyByGroup = new Map<string, string>();

function stableQueryKey(query: AdminRuntimeQuery): string {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
}

function pageKey(afterUserId: number | null | undefined) {
  return `after:${afterUserId ?? "start"}`;
}

function detailsKey(limits: DetailLimits) {
  return [
    limits.strategies_limit_per_user,
    limits.configs_limit_per_user,
    limits.positions_limit_per_user,
  ].join(":");
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function abortGroup(group: string) {
  const currentQueryKey = queryKeyByGroup.get(group);
  if (!currentQueryKey) {
    return;
  }
  const controller = controllersByQueryKey.get(currentQueryKey);
  controller?.abort();
  queryKeyByGroup.delete(group);
}

function abortAllGroups() {
  for (const group of queryKeyByGroup.keys()) {
    abortGroup(group);
  }
}

function mergeRuntimeUser(
  current: AdminUserRuntimeRead | undefined,
  incoming: AdminUserRuntimeRead,
) {
  if (!current) {
    return {
      ...incoming,
      strategies_truncated: incoming.strategies_truncated ?? false,
      auto_trade_configs_truncated: incoming.auto_trade_configs_truncated ?? false,
      auto_trade_positions_truncated:
        incoming.auto_trade_positions_truncated ?? false,
    };
  }

  const hasStrategies = Object.prototype.hasOwnProperty.call(
    incoming,
    "strategies",
  );
  const hasConfigs = Object.prototype.hasOwnProperty.call(
    incoming,
    "auto_trade_configs",
  );
  const hasPositions = Object.prototype.hasOwnProperty.call(
    incoming,
    "auto_trade_positions",
  );
  const hasLivePaper = Object.prototype.hasOwnProperty.call(
    incoming,
    "live_paper_profile",
  );

  return {
    ...current,
    ...incoming,
    strategies: hasStrategies
      ? (incoming.strategies ?? [])
      : current.strategies,
    auto_trade_configs: hasConfigs
      ? (incoming.auto_trade_configs ?? [])
      : current.auto_trade_configs,
    auto_trade_positions: hasPositions
      ? (incoming.auto_trade_positions ?? [])
      : current.auto_trade_positions,
    live_paper_profile: hasLivePaper
      ? (incoming.live_paper_profile ?? null)
      : current.live_paper_profile,
    strategies_truncated:
      incoming.strategies_truncated ?? current.strategies_truncated ?? false,
    auto_trade_configs_truncated:
      incoming.auto_trade_configs_truncated ??
      current.auto_trade_configs_truncated ??
      false,
    auto_trade_positions_truncated:
      incoming.auto_trade_positions_truncated ??
      current.auto_trade_positions_truncated ??
      false,
  };
}

async function requestSnapshot(
  query: AdminRuntimeQuery,
  options: QueryRequestOptions = {},
) {
  const { force = false, cancelGroup } = options;
  const queryKey = stableQueryKey(query);

  if (!force) {
    const cached = snapshotCache.get(queryKey);
    if (cached) {
      return cached;
    }
  }

  const activePromise = inFlightByQueryKey.get(queryKey);
  if (activePromise) {
    return activePromise;
  }

  if (cancelGroup) {
    abortGroup(cancelGroup);
  }

  const controller = new AbortController();
  controllersByQueryKey.set(queryKey, controller);
  if (cancelGroup) {
    queryKeyByGroup.set(cancelGroup, queryKey);
  }

  const promise = getAdminRuntimeSnapshot(query, {
    signal: controller.signal,
  })
    .then((snapshot) => {
      snapshotCache.set(queryKey, snapshot);
      return snapshot;
    })
    .finally(() => {
      inFlightByQueryKey.delete(queryKey);
      controllersByQueryKey.delete(queryKey);
      if (cancelGroup && queryKeyByGroup.get(cancelGroup) === queryKey) {
        queryKeyByGroup.delete(cancelGroup);
      }
    });

  inFlightByQueryKey.set(queryKey, promise);
  return promise;
}

function createLightQuery(
  usersLimit: number,
  filters: RuntimeFilters,
  afterUserId?: number | null,
): AdminRuntimeQuery {
  return {
    users_limit: usersLimit,
    include_details: false,
    include_inactive_users: filters.include_inactive_users,
    positions_status: filters.positions_status,
    after_user_id: afterUserId ?? undefined,
  };
}

function createDetailsQuery(
  usersLimit: number,
  filters: RuntimeFilters,
  limits: DetailLimits,
  afterUserId?: number | null,
): AdminRuntimeQuery {
  return {
    users_limit: usersLimit,
    include_details: true,
    include_inactive_users: filters.include_inactive_users,
    positions_status: filters.positions_status,
    after_user_id: afterUserId ?? undefined,
    strategies_limit_per_user: limits.strategies_limit_per_user,
    configs_limit_per_user: limits.configs_limit_per_user,
    positions_limit_per_user: limits.positions_limit_per_user,
  };
}

function buildNextDetailLimits(limits: DetailLimits): DetailLimits {
  return {
    strategies_limit_per_user: Math.min(
      MAX_STRATEGIES_LIMIT,
      limits.strategies_limit_per_user + DEFAULT_STRATEGIES_LIMIT,
    ),
    configs_limit_per_user: Math.min(
      MAX_CONFIGS_LIMIT,
      limits.configs_limit_per_user + DEFAULT_CONFIGS_LIMIT,
    ),
    positions_limit_per_user: Math.min(
      MAX_POSITIONS_LIMIT,
      limits.positions_limit_per_user + DEFAULT_POSITIONS_LIMIT,
    ),
  };
}

function mergeSnapshotPage(
  state: AdminRuntimeStore,
  snapshot: AdminRuntimeSnapshotResponse,
  afterUserId: number | null | undefined,
  includeDetails: boolean,
): Pick<
  AdminRuntimeStore,
  | "usersById"
  | "userIds"
  | "userPageKeyById"
  | "pagesByKey"
  | "summary"
  | "generatedAt"
  | "nextAfterUserId"
  | "hasMore"
  | "selectedUserId"
> {
  const usersById = { ...state.usersById };
  const userIds = [...state.userIds];
  const userIdsSet = new Set(userIds);
  const userPageKeyById = { ...state.userPageKeyById };
  const pagesByKey = { ...state.pagesByKey };
  const key = pageKey(afterUserId);
  const pageUserIds: number[] = [];

  for (const runtimeUser of snapshot.users ?? []) {
    const userId = runtimeUser.user.id;
    usersById[userId] = mergeRuntimeUser(usersById[userId], runtimeUser);
    userPageKeyById[userId] = key;
    pageUserIds.push(userId);
    if (!userIdsSet.has(userId)) {
      userIdsSet.add(userId);
      userIds.push(userId);
    }
  }

  const existingPage = pagesByKey[key];
  const page = snapshot.page;
  const currentDetailKey = detailsKey(state.detailLimits);
  pagesByKey[key] = {
    after_user_id: afterUserId ?? null,
    next_after_user_id: page.next_after_user_id ?? null,
    has_more: Boolean(page.has_more),
    user_ids: pageUserIds.length > 0 ? pageUserIds : (existingPage?.user_ids ?? []),
    details_key: includeDetails ? currentDetailKey : existingPage?.details_key,
  };

  return {
    usersById,
    userIds,
    userPageKeyById,
    pagesByKey,
    summary: snapshot.summary,
    generatedAt: snapshot.generated_at,
    nextAfterUserId: page.next_after_user_id ?? null,
    hasMore: Boolean(page.has_more),
    selectedUserId:
      state.selectedUserId ?? (userIds.length > 0 ? userIds[0] : null),
  };
}

const initialDetailLimits: DetailLimits = {
  strategies_limit_per_user: DEFAULT_STRATEGIES_LIMIT,
  configs_limit_per_user: DEFAULT_CONFIGS_LIMIT,
  positions_limit_per_user: DEFAULT_POSITIONS_LIMIT,
};

const initialFilters: RuntimeFilters = {
  include_inactive_users: true,
  positions_status: "all",
};

function initialState(): Omit<
  AdminRuntimeStore,
  | "setSelectedUser"
  | "setIncludeInactiveUsers"
  | "setPositionsStatus"
  | "refresh"
  | "loadMoreUsers"
  | "prefetchNextUsers"
  | "ensureDetailsForSelectedUser"
  | "ensureDetailsForUser"
  | "increaseDetailLimits"
  | "exportFullDetailsSnapshot"
> {
  return {
    usersById: {},
    userIds: [],
    userPageKeyById: {},
    pagesByKey: {},
    summary: null,
    generatedAt: null,
    usersLimit: DEFAULT_USERS_LIMIT,
    detailLimits: initialDetailLimits,
    filters: initialFilters,
    selectedUserId: null,
    nextAfterUserId: null,
    hasMore: false,
    isBootstrapping: false,
    isLoadingMore: false,
    detailLoadingUserId: null,
    isPrefetchingNext: false,
    isExporting: false,
    accessDenied: false,
    errorMessage: null,
  };
}

export const useAdminRuntimeStore = create<AdminRuntimeStore>((set, get) => ({
  ...initialState(),

  setSelectedUser: (userId) => {
    set(() => ({
      selectedUserId: userId,
    }));
  },

  setIncludeInactiveUsers: async (value) => {
    const current = get().filters.include_inactive_users;
    if (current === value) {
      return;
    }
    set((state) => ({
      filters: {
        ...state.filters,
        include_inactive_users: value,
      },
    }));
    await get().refresh();
  },

  setPositionsStatus: async (value) => {
    const current = get().filters.positions_status;
    if (current === value) {
      return;
    }
    set((state) => ({
      filters: {
        ...state.filters,
        positions_status: value,
      },
    }));
    await get().refresh();
  },

  refresh: async () => {
    if (get().isBootstrapping) {
      return;
    }

    const state = get();
    abortAllGroups();

    set(() => ({
      ...initialState(),
      detailLimits: state.detailLimits,
      filters: state.filters,
      usersLimit: state.usersLimit,
      isBootstrapping: true,
    }));

    try {
      const lightQuery = createLightQuery(state.usersLimit, state.filters);
      const snapshot = await requestSnapshot(lightQuery, {
        cancelGroup: "runtime:bootstrap",
      });

      set((currentState) => ({
        ...mergeSnapshotPage(currentState, snapshot, null, false),
        isBootstrapping: false,
        accessDenied: false,
        errorMessage: null,
      }));

      const selected = get().selectedUserId;
      if (selected !== null) {
        await get().ensureDetailsForUser(selected);
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        set(() => ({
          isBootstrapping: false,
          accessDenied: true,
          errorMessage: null,
        }));
        return;
      }

      set(() => ({
        isBootstrapping: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to load admin runtime data.",
      }));
    }
  },

  loadMoreUsers: async () => {
    const state = get();
    if (!state.hasMore || state.nextAfterUserId === null || state.isLoadingMore) {
      return;
    }

    set(() => ({
      isLoadingMore: true,
      errorMessage: null,
    }));

    try {
      const query = createLightQuery(
        state.usersLimit,
        state.filters,
        state.nextAfterUserId,
      );
      const snapshot = await requestSnapshot(query, {
        cancelGroup: "runtime:load-more",
      });

      set((currentState) => ({
        ...mergeSnapshotPage(
          currentState,
          snapshot,
          state.nextAfterUserId,
          false,
        ),
        isLoadingMore: false,
      }));
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      set(() => ({
        isLoadingMore: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to load next users page.",
      }));
    }
  },

  prefetchNextUsers: async () => {
    const state = get();
    if (
      !state.hasMore ||
      state.nextAfterUserId === null ||
      state.isPrefetchingNext ||
      state.isLoadingMore
    ) {
      return;
    }

    set(() => ({
      isPrefetchingNext: true,
    }));

    try {
      const query = createLightQuery(
        state.usersLimit,
        state.filters,
        state.nextAfterUserId,
      );
      await requestSnapshot(query, {
        cancelGroup: "runtime:prefetch-next",
      });
    } catch (error) {
      if (!isAbortError(error)) {
        set(() => ({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to prefetch next users page.",
        }));
      }
    } finally {
      set(() => ({
        isPrefetchingNext: false,
      }));
    }
  },

  ensureDetailsForSelectedUser: async () => {
    const selectedUserId = get().selectedUserId;
    if (selectedUserId === null) {
      return;
    }
    await get().ensureDetailsForUser(selectedUserId);
  },

  ensureDetailsForUser: async (userId) => {
    const state = get();
    const userPageKey = state.userPageKeyById[userId];
    if (!userPageKey) {
      return;
    }

    const page = state.pagesByKey[userPageKey];
    if (!page) {
      return;
    }

    const currentDetailKey = detailsKey(state.detailLimits);
    if (page.details_key === currentDetailKey) {
      return;
    }

    set(() => ({
      detailLoadingUserId: userId,
      errorMessage: null,
    }));

    try {
      const query = createDetailsQuery(
        state.usersLimit,
        state.filters,
        state.detailLimits,
        page.after_user_id,
      );
      const snapshot = await requestSnapshot(query, {
        cancelGroup: "runtime:details-active",
      });

      set((currentState) => ({
        ...mergeSnapshotPage(
          currentState,
          snapshot,
          page.after_user_id,
          true,
        ),
        detailLoadingUserId: null,
      }));
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      set(() => ({
        detailLoadingUserId: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to load detailed runtime data.",
      }));
    }
  },

  increaseDetailLimits: async () => {
    const nextLimits = buildNextDetailLimits(get().detailLimits);
    set(() => ({
      detailLimits: nextLimits,
    }));
    await get().ensureDetailsForSelectedUser();
  },

  exportFullDetailsSnapshot: async () => {
    const state = get();
    if (state.isExporting) {
      return null;
    }

    set(() => ({
      isExporting: true,
      errorMessage: null,
    }));

    try {
      const usersById = new Map<number, AdminUserRuntimeRead>();
      let summary: AdminRuntimeSummaryRead | null = null;
      let generatedAt: string | null = null;
      let afterUserId: number | null | undefined = null;
      let hasMore = true;

      while (hasMore) {
        const query = createDetailsQuery(
          state.usersLimit,
          state.filters,
          state.detailLimits,
          afterUserId,
        );
        const snapshot = await requestSnapshot(query, {
          cancelGroup: "runtime:export",
        });

        summary = snapshot.summary;
        generatedAt = snapshot.generated_at;
        for (const runtimeUser of snapshot.users ?? []) {
          usersById.set(runtimeUser.user.id, runtimeUser);
        }

        hasMore = Boolean(snapshot.page.has_more);
        afterUserId = snapshot.page.next_after_user_id ?? null;
      }

      if (!summary || !generatedAt) {
        return null;
      }

      return {
        generated_at: generatedAt,
        summary,
        page: {
          users_limit: state.usersLimit,
          after_user_id: null,
          next_after_user_id: null,
          has_more: false,
        },
        users: Array.from(usersById.values()),
      };
    } catch (error) {
      if (!isAbortError(error)) {
        set(() => ({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to export full snapshot.",
        }));
      }
      return null;
    } finally {
      set(() => ({
        isExporting: false,
      }));
    }
  },
}));

export const adminRuntimeDefaults = {
  usersLimit: DEFAULT_USERS_LIMIT,
  detailLimits: initialDetailLimits,
  maxUsersLimit: MAX_USERS_LIMIT,
};
