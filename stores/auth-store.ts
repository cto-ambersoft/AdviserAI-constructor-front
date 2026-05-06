"use client";

import { create } from "zustand";
import { clearAccessToken, setAccessToken } from "@/lib/auth/token-storage";
import {
  getAdminRuntimeSnapshot,
  logoutSession,
  me,
  signin,
  signup,
  type ApiError,
  type SignInRequest,
  type SignUpRequest,
  type UserRead,
} from "@/lib/api";

type AuthStatus = "idle" | "authenticated" | "anonymous";

type AuthState = {
  user: UserRead | null;
  status: AuthStatus;
  hasHydrated: boolean;
  hasAdminAccess: boolean | null;
  isAdminAccessLoading: boolean;
  setUser: (user: UserRead | null) => void;
  hydrate: () => Promise<void>;
  login: (data: SignInRequest) => Promise<void>;
  register: (data: SignUpRequest) => Promise<void>;
  logout: () => Promise<void>;
  resolveAdminAccess: () => Promise<boolean>;
};

async function loadCurrentUser() {
  const currentUser = await me();
  return currentUser;
}

async function checkAdminAccess() {
  await getAdminRuntimeSnapshot({
    users_limit: 1,
    include_details: false,
    include_inactive_users: true,
    positions_status: "all",
  });
}

let adminAccessRequestId = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "idle",
  hasHydrated: false,
  hasAdminAccess: null,
  isAdminAccessLoading: false,
  setUser: (user) =>
    set(() => ({
      user,
      status: user ? "authenticated" : "anonymous",
      hasAdminAccess: user ? null : false,
      isAdminAccessLoading: false,
    })),
  hydrate: async () => {
    try {
      const currentUser = await loadCurrentUser();
      set(() => ({
        user: currentUser,
        status: "authenticated",
        hasHydrated: true,
      }));
      void get().resolveAdminAccess();
    } catch {
      clearAccessToken();
      set(() => ({
        user: null,
        status: "anonymous",
        hasHydrated: true,
        hasAdminAccess: false,
        isAdminAccessLoading: false,
      }));
    }
  },
  login: async (data) => {
    const tokenResponse = await signin(data);
    setAccessToken(tokenResponse.access_token);
    const currentUser = await loadCurrentUser();
    set(() => ({
      user: currentUser,
      status: "authenticated",
      hasHydrated: true,
      hasAdminAccess: null,
    }));
    void get().resolveAdminAccess();
  },
  register: async (data) => {
    const tokenResponse = await signup(data);
    setAccessToken(tokenResponse.access_token);
    const currentUser = await loadCurrentUser();
    set(() => ({
      user: currentUser,
      status: "authenticated",
      hasHydrated: true,
      hasAdminAccess: null,
    }));
    void get().resolveAdminAccess();
  },
  logout: async () => {
    try {
      await logoutSession();
    } catch {
      // Keep client logout resilient if the network is temporarily unavailable.
    }
    clearAccessToken();
    set(() => ({
      user: null,
      status: "anonymous",
      hasHydrated: true,
      hasAdminAccess: false,
      isAdminAccessLoading: false,
    }));
  },
  resolveAdminAccess: async () => {
    const user = get().user;
    if (!user) {
      set(() => ({
        hasAdminAccess: false,
        isAdminAccessLoading: false,
      }));
      return false;
    }

    // Fast-path if backend already sent role flag.
    if (user.is_admin === true) {
      set(() => ({
        hasAdminAccess: true,
        isAdminAccessLoading: false,
      }));
      return true;
    }

    const requestId = ++adminAccessRequestId;
    set(() => ({
      isAdminAccessLoading: true,
    }));

    try {
      await checkAdminAccess();

      if (requestId !== adminAccessRequestId) {
        return get().hasAdminAccess ?? false;
      }

      set(() => ({
        hasAdminAccess: true,
        isAdminAccessLoading: false,
      }));
      return true;
    } catch (error) {
      if (requestId !== adminAccessRequestId) {
        return get().hasAdminAccess ?? false;
      }

      const apiError = error as ApiError;
      if (typeof apiError?.status === "number" && apiError.status === 403) {
        set(() => ({
          hasAdminAccess: false,
          isAdminAccessLoading: false,
        }));
        return false;
      }

      // Keep UX resilient on transient network issues.
      set(() => ({
        hasAdminAccess: false,
        isAdminAccessLoading: false,
      }));
      return false;
    }
  },
}));

export function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }
  const maybeApiError = error as ApiError;
  if (!("status" in maybeApiError) || !("data" in maybeApiError)) {
    return null;
  }

  const detailValue =
    typeof maybeApiError.data === "object" &&
    maybeApiError.data !== null &&
    "detail" in maybeApiError.data
      ? (maybeApiError.data as { detail?: unknown }).detail
      : null;

  return typeof detailValue === "string" ? detailValue : null;
}
