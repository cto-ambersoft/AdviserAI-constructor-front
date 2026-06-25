// Step-up registry + gated-path matcher — M4 §1.
//
// Framework-free on purpose: `client.ts` imports ONLY this module (no React, no
// services), so the import graph stays acyclic. A React provider registers the
// resolver; the client calls it when a gated request returns 403.

/**
 * Opens the step-up UI and resolves with a fresh one-time step-up token, or
 * `null` if the user cancels. The provider implements this; the client awaits it.
 */
export type StepUpResolver = () => Promise<string | null>;

let activeResolver: StepUpResolver | null = null;

export function registerStepUpResolver(resolver: StepUpResolver): void {
  activeResolver = resolver;
}

/**
 * Clear the resolver. If `resolver` is passed, only clears when it is still the
 * active one — so a late provider unmount can't clobber a newer registration.
 */
export function clearStepUpResolver(resolver?: StepUpResolver): void {
  if (!resolver || activeResolver === resolver) {
    activeResolver = null;
  }
}

export function getStepUpResolver(): StepUpResolver | null {
  return activeResolver;
}

// Gated (method, path) pairs that require X-Step-Up-Token when 2FA is enabled.
// Matched on the normalized backend path without query string. — TZ §1.
type GatedRule =
  | { method: string; path: string }
  | { method: string; pattern: RegExp };

const GATED_PATHS: ReadonlyArray<GatedRule> = [
  { method: "POST", path: "/api/v1/live/auto-trade/play" },
  { method: "PUT", path: "/api/v1/live/auto-trade/config" },
  { method: "POST", path: "/api/v1/exchange/accounts" },
  // T3 (S1/S2): changing or deleting an exchange API key is critical — account_id
  // is a dynamic segment, so match by pattern (anchored to digits).
  { method: "PATCH", pattern: /^\/api\/v1\/exchange\/accounts\/\d+$/ },
  { method: "DELETE", pattern: /^\/api\/v1\/exchange\/accounts\/\d+$/ },
  { method: "DELETE", path: "/api/v1/auth/2fa" },
  // T17 (W12f): applying an agent-weight suggestion changes runtime AI behaviour.
  {
    method: "POST",
    pattern: /^\/api\/v1\/ai-backtests\/agent-weights\/suggestions\/[^/]+\/apply$/,
  },
  // B5 (W10): promote/demote a strategy — config_id is a dynamic segment, so
  // these match by pattern (exact-string matching would never fire).
  {
    method: "POST",
    pattern: /^\/api\/v1\/live\/auto-trade\/strategies\/\d+\/promote$/,
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/live\/auto-trade\/strategies\/\d+\/demote$/,
  },
];

export const STEP_UP_HEADER = "X-Step-Up-Token";

/** Whether a (method, path) is one of the step-up-gated actions. */
export function isStepUpGated(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const pathOnly = path.split("?")[0];
  return GATED_PATHS.some((gated) => {
    if (gated.method !== normalizedMethod) return false;
    return "pattern" in gated
      ? gated.pattern.test(pathOnly)
      : gated.path === pathOnly;
  });
}
