# M4 Frontend — Acceptance Report

> Maps the TZ acceptance checklist (`../constructor/tasks/m4-frontend-tz.md` §Acceptance) to the
> implementation. Code gates (`tsc --noEmit` + `npm run lint` + `npm run build`, Node 20) are **green
> across the whole repo**. Items marked **manual** need the `constructor` backend on :8000 + a login +
> an authenticator app — not runnable in this environment; left for human QA at the checkpoints.

## TZ acceptance checklist

| # | TZ item | Status | Where |
|---|---------|--------|-------|
| F4 | enroll (QR + recovery once) → verify → status → disable (step-up); 409/400/429 handled | code ✅ · manual ⏳ | [two-factor-settings.tsx](../components/settings/two-factor-settings.tsx), [totp.ts](../lib/api/services/totp.ts), `/settings/security` |
| Step-up | gated action **without** 2FA unchanged; **with** 2FA → code modal → retry with `X-Step-Up-Token`; one-time token | code ✅ · manual ⏳ | [step-up.ts](../lib/api/step-up.ts), [client.ts](../lib/api/client.ts), [step-up-modal.tsx](../components/auth/step-up-modal.tsx), [step-up-provider.tsx](../components/auth/step-up-provider.tsx) |
| §1b Login-2FA | signin → if `two_factor_required` show code field → `POST /auth/2fa/login {challenge_token, code}` → finish; 400/429+Retry-After/401 handled; no-2FA users unchanged | code ✅ · BFF path RUNTIME ✅ · browser manual ⏳ | [auth.ts](../lib/api/services/auth.ts), signin + [2fa/login route](../app/api/auth/2fa/login/route.ts), [auth-store.ts](../stores/auth-store.ts), [auth-form-card.tsx](../components/auth/auth-form-card.tsx) |
| F2 | Live Monitor: live-KPI, `kpi_as_of` freshness, denominator-labeled DD/ROI; controls play/stop/close (play under step-up) | code ✅ · manual ⏳ | [live-monitor-dashboard.tsx](../components/monitor/live-monitor-dashboard.tsx), [strategy-monitor-card.tsx](../components/monitor/strategy-monitor-card.tsx), `/monitor` |
| F5 | one EventSource via BFF proxy; reconnect/backoff; 429 stream-cap handled; risk events → toasts + portfolio refetch | code ✅ · transport RUNTIME ✅ · browser-loop manual ⏳ | [route.ts](../app/api/events/stream/route.ts), [risk-events-store.ts](../stores/risk-events-store.ts), [risk-event-display.ts](../components/risk-events/risk-event-display.ts) |
| F3 | trader catalogue with filters, Delta-vs-Baseline, attach-to-strategy | code ✅ · manual ⏳ | [forecast-catalogue.tsx](../components/forecasts/forecast-catalogue.tsx), [trading-dashboard.tsx](../components/trading/trading-dashboard.tsx), `/forecasts` |
| §5 | error matrix (400/403/409/429) + `Retry-After` | code ✅ | client + modal + 2FA + SSE store/route (see below) |

## Error matrix (§5) coverage

| Code | When | Handling |
|------|------|----------|
| 400 | bad TOTP in verify / step-up | "Invalid code" — [step-up-modal.tsx:67](../components/auth/step-up-modal.tsx), [two-factor-settings.tsx:113](../components/settings/two-factor-settings.tsx) |
| 403 | gated action without valid `X-Step-Up-Token` | step-up flow — [client.ts](../lib/api/client.ts) `shouldRunStepUp`/`runStepUpRetry` (also after a refresh-retry) |
| 403 | step-up token spent/expired/foreign | re-mint once (bounded to 2 attempts) then surface — [client.ts](../lib/api/client.ts) |
| 409 | enroll while 2FA already enabled | "already enabled" + status refetch — [two-factor-settings.tsx:84](../components/settings/two-factor-settings.tsx) |
| 429 | 2FA lockout | `Retry-After` countdown disables input — [step-up-modal.tsx](../components/auth/step-up-modal.tsx), [two-factor-settings.tsx](../components/settings/two-factor-settings.tsx) |
| 429 | SSE stream cap (>5) | manual reconnect backoff → `"limited"` state, no busy-loop — [risk-events-store.ts](../stores/risk-events-store.ts) |
| — | `Retry-After` header | parsed into `ApiError.retryAfterSeconds` (delta-seconds or HTTP-date) — [client.ts](../lib/api/client.ts) `parseRetryAfter`; SSE route forwards it |

## Security (S2/S3)

- ✅ SSE token only via httpOnly cookie through the BFF proxy — **never** in the query-string.
- ✅ No `console.*` / telemetry logging of `secret`, `recovery_codes`, `step_up_token`, or access tokens
  (grep-verified across `app components lib stores`).
- ✅ No `localStorage`/`sessionStorage` of sensitive values; recovery codes live in component state only
  and leave memory once verified.
- ✅ Session cookies: `httpOnly` + `secure` (production) + `sameSite=lax` — [session-cookies.ts](../app/api/auth/_utils/session-cookies.ts).
- ℹ️ CORS explicit-origins is a **backend** concern; the direct `/api/v1/*` calls use `credentials: "omit"` cross-origin.

## Runtime verification performed (no backend / auth required)

- SSE BFF proxy ([T3.1]): no cookie → **401**; cookie + no backend → **502**; cookie + local SSE stub →
  **piped the SSE frame** verbatim (cookie → Bearer → stream).
- Pure-logic assertions (Node, no test runner added): `parseRetryAfter`, `isStepUpGated` (incl. play-all
  and `/step-up` NOT gated), `kpi-format` (null→"—" never 0, freshness, signed PnL), `parseRiskEvent` +
  `reconnectDelayMs` backoff/cap, risk-event tone/refetch mapping, `formatMetricValue`/`pickMetricValue`.

## Remaining: manual QA (per checkpoint, needs backend + login + authenticator)

- **A** (F4 + step-up): enroll→verify→status→disable; gated save/play/add-key prompts step-up; 2FA-off regression.
- **B** (F2): KPI cards across health states, `kpi_as_of` freshness, denominator labels, controls, drill-down, 30s poll pauses when hidden.
- **C** (F5): one EventSource/tab, risk event → toast + portfolio refetch, reconnect on drop, 429 → "limited".
- **D** (F3): catalogue filters + Delta-vs-Baseline; "Use in strategy" lands on `/strategy` with forecast preselected.
