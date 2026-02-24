import { apiRequest } from "@/lib/api/client";
import type { SignInRequest, SignUpRequest, UserRead } from "@/lib/api/types";
import type { AuthTokenBundle } from "@/lib/auth/token-contract";

export async function signup(payload: SignUpRequest) {
  return apiRequest<AuthTokenBundle>("/api/auth/signup", {
    method: "POST",
    body: payload,
  });
}

export async function signin(payload: SignInRequest) {
  return apiRequest<AuthTokenBundle>("/api/auth/signin", {
    method: "POST",
    body: payload,
  });
}

export async function refreshSession() {
  return apiRequest<AuthTokenBundle>("/api/auth/refresh", {
    method: "POST",
    body: {},
  });
}

export async function logoutSession() {
  return apiRequest<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
    body: {},
  });
}

export async function me() {
  return apiRequest<UserRead>("/api/v1/auth/me");
}
