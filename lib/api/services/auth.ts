import { apiRequest } from "@/lib/api/client";
import type {
  Email2FACodeSentResponse,
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  TwoFactorLoginEmailRequest,
  TwoFactorLoginRequest,
  TwoFactorRequiredResponse,
  UserRead,
} from "@/lib/api/types";
import type { AuthTokenBundle } from "@/lib/auth/token-contract";

export async function signup(payload: SignUpRequest) {
  return apiRequest<AuthTokenBundle>("/api/auth/signup", {
    method: "POST",
    body: payload,
  });
}

/**
 * Sign in. Returns the token bundle for users without 2FA, or a 2FA challenge
 * (`two_factor_required`) for users with it — then finish via {@link twoFactorLogin}.
 * — M4 §1b.
 */
export async function signin(payload: SignInRequest) {
  return apiRequest<SignInResponse>("/api/auth/signin", {
    method: "POST",
    body: payload,
  });
}

/** Narrow a signin response to the 2FA-challenge branch. */
export function isTwoFactorRequired(
  response: SignInResponse,
): response is TwoFactorRequiredResponse {
  return (
    "two_factor_required" in response &&
    response.two_factor_required === true
  );
}

/**
 * Complete a 2FA-gated login by exchanging the challenge token + a TOTP (or
 * recovery) code for the token bundle. `400` invalid code; `429` lockout
 * (Retry-After); `401` challenge expired/invalid (restart login). — M4 §1b.
 */
export async function twoFactorLogin(payload: TwoFactorLoginRequest) {
  return apiRequest<AuthTokenBundle>("/api/auth/2fa/login", {
    method: "POST",
    body: payload,
  });
}

/**
 * Request an emailed login code for the email-2FA factor. Validates the challenge
 * server-side (proves the password already passed), then emails an
 * `email_2fa_login` code to submit via {@link twoFactorLogin} with `method: "email"`.
 * `401` challenge expired/invalid; `429` lockout. — E5/F3.
 */
export async function requestLoginEmailCode(payload: TwoFactorLoginEmailRequest) {
  return apiRequest<Email2FACodeSentResponse>("/api/auth/2fa/login/email/request", {
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
