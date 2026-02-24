"use client";

import { create } from "zustand";
import { clearAccessToken, setAccessToken } from "@/lib/auth/token-storage";
import {
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
  setUser: (user: UserRead | null) => void;
  hydrate: () => Promise<void>;
  login: (data: SignInRequest) => Promise<void>;
  register: (data: SignUpRequest) => Promise<void>;
  logout: () => Promise<void>;
};

async function loadCurrentUser() {
  const currentUser = await me();
  return currentUser;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  hasHydrated: false,
  setUser: (user) =>
    set(() => ({
      user,
      status: user ? "authenticated" : "anonymous",
    })),
  hydrate: async () => {
    try {
      const currentUser = await loadCurrentUser();
      set(() => ({
        user: currentUser,
        status: "authenticated",
        hasHydrated: true,
      }));
    } catch {
      clearAccessToken();
      set(() => ({ user: null, status: "anonymous", hasHydrated: true }));
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
    }));
  },
  register: async (data) => {
    const tokenResponse = await signup(data);
    setAccessToken(tokenResponse.access_token);
    const currentUser = await loadCurrentUser();
    set(() => ({
      user: currentUser,
      status: "authenticated",
      hasHydrated: true,
    }));
  },
  logout: async () => {
    try {
      await logoutSession();
    } catch {
      // Keep client logout resilient if the network is temporarily unavailable.
    }
    clearAccessToken();
    set(() => ({ user: null, status: "anonymous", hasHydrated: true }));
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
