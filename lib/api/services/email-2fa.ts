import { apiRequest } from "@/lib/api/client";
import type {
  Email2FACodeSentResponse,
  Email2FAStatusResponse,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Email-2FA — email as a full, opt-in second factor alongside TOTP. Enrollment
// proves control of the account email (verify-on-enroll); the factor then drives
// step-up and login via emailed codes. Gated on Resend being configured: when it
// is not, `getEmail2FAStatus().available` is false and enroll returns 503.
// ---------------------------------------------------------------------------

/** Current email-2FA state — `enabled` (confirmed) and `available` (Resend on). */
export async function getEmail2FAStatus() {
  return apiRequest<Email2FAStatusResponse>("/api/v1/auth/2fa/email/status", {
    method: "GET",
  });
}

/**
 * Begin enrollment: emails a one-time code. The factor is NOT active until
 * {@link confirmEmail2FA}. `503` when email-2FA is not configured (no Resend).
 */
export async function enrollEmail2FA() {
  return apiRequest<Email2FACodeSentResponse>("/api/v1/auth/2fa/email/enroll", {
    method: "POST",
  });
}

/**
 * Confirm enrollment with the emailed code → flips email-2FA to enabled.
 * `400` invalid/expired code; `429` lockout (honor `Retry-After`).
 */
export async function confirmEmail2FA(code: string) {
  return apiRequest<Email2FAStatusResponse>("/api/v1/auth/2fa/email/confirm", {
    method: "POST",
    body: { code },
  });
}

/**
 * Disable email-2FA. Gated (§1): call it plainly — the step-up interceptor in
 * `client.ts` catches the 403, runs the step-up modal, mints a one-time token and
 * retries with `X-Step-Up-Token`.
 */
export async function disableEmail2FA() {
  return apiRequest<Email2FAStatusResponse>("/api/v1/auth/2fa/email", {
    method: "DELETE",
  });
}

/**
 * Request a step-up code by email (the user must have email-2FA enrolled). The
 * returned code is then submitted via {@link stepUpEmail}. `400` when email-2FA
 * is not enabled; `429` rate-limited.
 */
export async function requestStepUpEmailCode() {
  return apiRequest<Email2FACodeSentResponse>(
    "/api/v1/auth/2fa/step-up/email/request",
    { method: "POST" },
  );
}
