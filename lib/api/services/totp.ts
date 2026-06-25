import { apiRequest } from "@/lib/api/client";
import type {
  StepUpResponse,
  TotpEnrollResponse,
  TotpStatusResponse,
  TwoFactorMethod,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// 2FA (TOTP) — M4 F4. Pure authenticator-app TOTP (no email/SMS). All calls go
// directly to the backend (`/api/v1/*`) with the in-memory bearer token.
// Never log `secret`, `recovery_codes`, or `step_up_token`.
// ---------------------------------------------------------------------------

/**
 * Begin enrollment: returns the `otpauth://` provisioning URI, the raw secret,
 * and 10 one-time recovery codes. 2FA is NOT active until {@link verifyTotp}.
 * `409` when 2FA is already enabled.
 */
export async function enrollTotp() {
  return apiRequest<TotpEnrollResponse>("/api/v1/auth/2fa/enroll", {
    method: "POST",
  });
}

/**
 * Confirm enrollment with a 6-digit TOTP code (recovery codes are rejected
 * here). Flips 2FA to enabled. `400` invalid code; `429` lockout.
 */
export async function verifyTotp(code: string) {
  return apiRequest<TotpStatusResponse>("/api/v1/auth/2fa/verify", {
    method: "POST",
    body: { code },
  });
}

/** Current 2FA state — drives the settings view. */
export async function getTotpStatus() {
  return apiRequest<TotpStatusResponse>("/api/v1/auth/2fa/status", {
    method: "GET",
  });
}

/**
 * Exchange a fresh second-factor code for a short-lived, one-time step-up token
 * used to authorize a single gated action. `method` defaults to `totp` (a TOTP or
 * 16-char recovery code); pass `email` with a code requested via
 * {@link requestStepUpEmailCode}. `400` invalid code; `429` lockout (honor
 * `Retry-After`).
 */
export async function stepUp(code: string, method: TwoFactorMethod = "totp") {
  return apiRequest<StepUpResponse>("/api/v1/auth/2fa/step-up", {
    method: "POST",
    body: { method, code },
  });
}

/**
 * Disable 2FA. Gated (§1): call it plainly — the step-up interceptor in
 * `client.ts` catches the 403, prompts for a code, mints a one-time token and
 * retries with `X-Step-Up-Token`. No token is passed by the caller.
 */
export async function disableTotp() {
  return apiRequest<TotpStatusResponse>("/api/v1/auth/2fa", {
    method: "DELETE",
  });
}
