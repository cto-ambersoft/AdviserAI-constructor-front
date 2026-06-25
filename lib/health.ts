/** Tri-state health tone derived from the backend `/health` status string. */
export type HealthTone = "ok" | "warn" | "error";

export const HEALTH_LABEL: Record<HealthTone, string> = {
  ok: "Connection stable",
  warn: "Degraded",
  error: "Disconnected",
};

/**
 * Collapse the backend health `status` string into a tri-state tone for the
 * header indicator. Anything not recognised as healthy or degraded — including
 * a missing/unreachable status — is treated as an error (fail-loud in the UI).
 */
export function deriveHealthTone(status: string | null | undefined): HealthTone {
  const value = (status ?? "").toLowerCase().trim();
  if (value === "ok" || value === "healthy" || value === "up") {
    return "ok";
  }
  if (value.includes("degrad") || value.includes("warn") || value === "partial") {
    return "warn";
  }
  return "error";
}
