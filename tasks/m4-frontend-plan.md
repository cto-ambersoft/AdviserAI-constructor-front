# Implementation Plan — Milestone 4 frontend (2FA / Step-up / Live Monitor / SSE / Forecast Catalogue)

> Plan-mode artifact: **read-only investigation complete; no code changed.** Awaiting human review.
> Source of truth: [`../constructor/tasks/m4-frontend-tz.md`](../../constructor/tasks/m4-frontend-tz.md).
> Backend contract already synced into `lib/api/openapi-types.ts` (commits `b0f4c07…6e8e2a3`) —
> **no `gen:api-types` regeneration needed** (only small re-exports in `lib/api/types.ts`).
> Use **context7** for `qrcode.react` and Next.js 16 streaming-route APIs during implementation.

---

## 1. Goal

The backend `constructor` shipped Phase 1–2 ahead of the frontend. Five deliverables close the gap:

| ID | Deliverable | Backend surface | Priority |
|----|-------------|-----------------|----------|
| **Step-up** | Cross-cutting 2FA step-up flow — intercept `403` on gated actions, mint a one-time `X-Step-Up-Token`, retry | `POST /auth/2fa/step-up`, `X-Step-Up-Token` header on gated ops | **P0 (most important)** |
| **F4** | 2FA (TOTP) settings UI — enroll(QR+recovery) → verify → status → disable | `POST/GET/DELETE /auth/2fa/*` | **P0** |
| **F2** | Live Monitoring Dashboard — portfolio + per-strategy live KPIs, `kpi_as_of` freshness, controls | `GET /live/auto-trade/portfolio`, `…/strategies/{id}/health` | **P1** |
| **F5** | SSE live-consumer of risk events via BFF proxy → toasts + portfolio refetch | `GET /events/stream` | **P1** |
| **F3** | AI Forecast Catalogue trader-UI — filters + Delta-vs-Baseline + "use in strategy" deep-link | `GET /ai-backtests/ai-forecast-catalogue*` | **P2** |

**Decided with stakeholder:** ship the whole milestone in TZ-priority order; F3 "bind to strategy" =
**deep-link into the strategy builder with the forecast preselected** (reuses the existing
`ai_forecast_file` builder field; no backend change).

**Already done (do NOT rebuild):** Risk Governance config UI (F1, W9), per-strategy KPI cards,
health drill-down, position-trace modal. F2 reuses those formatters rather than reinventing them.

---

## 2. Architecture facts that shape every task (verified)

1. **Hybrid auth transport.** `lib/api/client.ts` sends `/api/v1/*` **directly** browser→backend with an
   in-memory `Bearer` token (`lib/auth/token-storage.ts`). Non-`/api/v1/*` paths hit Next route handlers
   (BFF) which read the **httpOnly access-token cookie** (`constructor_access_token`, set on signin/refresh).
   → The SSE BFF proxy can read the same cookie. → Step-up must hook the **direct** `/api/v1/*` path in
   `client.ts`, not the BFF.
2. **Gated endpoints already type `X-Step-Up-Token?: string | null`** in `openapi-types.ts`:
   `play_auto_trade…`, `upsert_auto_trade_config…`, `create_exchange_account…`, `disable_2fa…`.
   `apiRequest` currently has **no** custom-header option → must add one.
3. **SSE contract** (`constructor/app/api/v1/endpoints/events.py` + `services/events/stream.py`):
   SSE `event:` = `event_type`; `data:` = JSON `{ event_type, payload, message }`. 8 streamable types:
   `risk_blocked`, `risk_check_degraded`, `kpi_guard_triggered`, `strategy_auto_paused`,
   `kill_switch_triggered`, `position_emergency_closed_unprotected`, `data_stale`, `portfolio_dd_halt`.
   `429` when active streams ≥ `sse_max_streams_per_user` (default 5/worker). Server pings every 15s.
4. **One-time step-up token.** `expires_in` ≈ 300s; reused/expired/foreign → `403` "already used" →
   re-mint. Never cache or share across actions. `/step-up` is itself lockout-guarded (`429 + Retry-After`).
5. **Error matrix** (TZ §5): 400 (bad TOTP), 403 (step-up required / token spent), 409 (enroll when
   enabled), 429 (lockout **or** SSE stream cap; honor `Retry-After` seconds). `client.ts` currently maps
   neither `403` nor `Retry-After`.
6. **No secrets in logs.** Never `console.log`/telemetry the TOTP secret, recovery codes, or step-up token.
7. **Tooling needs Node ≥ 18** (default shell is v14, crashes eslint/next). nvm has v20/v24. No test runner.

---

## 3. Dependency graph (build bottom-up)

```
client.ts: +custom headers, +403 map, +Retry-After on ApiError   (T1.1)
   │
   ├── lib/api/services/totp.ts  (enroll/verify/status/stepUp/disable)   (T1.2)
   │       │
   │       ├── step-up registry + client interceptor + modal + provider  (T1.3)  ← gated retry
   │       │       │
   │       │       └── F4 2FA settings page (enroll/verify/status/disable-via-step-up)  (T1.4)
   │       │
   │       └── (status feeds 2FA UI + decides whether step-up modal can appear)
   │
   ├── F2 Live Monitor page (portfolio + per-strategy KPI + controls + health)   (T2.1–T2.3)
   │       │  (play control → auto step-up via interceptor from T1.3)
   │       │
   │       └── F5 SSE: BFF route → risk-events store/provider → toasts + portfolio refetch  (T3.1–T3.3)
   │
   └── F3 Forecast Catalogue trader page (filters + metrics + deep-link to builder)   (T4.1–T4.2)
```

`qrcode.react` (new dep) is required only by T1.4.

---

## Phase 1 — Step-up + 2FA (F4)  · P0 · "the most important"

> One vertical: a user can **enable** 2FA, and from then on **gated actions** prompt for a code and
> succeed by retrying with a fresh `X-Step-Up-Token`; **disable** is itself gated. Users without 2FA
> are unaffected (pass-through — no 403, no modal).

### T1.1 — Client foundations (headers + 403 + Retry-After)
**Description:** Make `apiRequest` able to send custom headers and surface the error fields step-up needs.
- Add `headers?: Record<string,string>` to `RequestOptions`; merge into `buildRequestHeaders`/`performRequest`.
- Map `403 → "forbidden"` in `ERROR_CODE_BY_STATUS`.
- On 429 (and any response carrying it), parse `Retry-After` → `ApiError.retryAfterSeconds: number | null`.
- Re-export 2FA contract types in `lib/api/types.ts` (`TotpEnrollResponse`, `StepUpResponse`,
  `TotpStatusResponse`, `TotpVerifyRequest`).

**Acceptance criteria:**
- [ ] `apiRequest(path, { headers })` forwards headers to the backend (and to BFF) unchanged.
- [ ] `ApiError` exposes `status:403 → code:"forbidden"` and `retryAfterSeconds` from a 429 `Retry-After`.
- [ ] No behavior change for existing callers (headers optional; additive field).

**Verify:** `npx tsc --noEmit` ✔ · `npm run lint` ✔ (Node 20). **Deps:** none. **Files:** `lib/api/client.ts`,
`lib/api/types.ts`. **Scope:** S.

### T1.2 — TOTP service
**Description:** Thin typed service wrapping the five 2FA endpoints (direct `/api/v1/*`).
- `enrollTotp()` → `TotpEnrollResponse`; `verifyTotp(code)` → `TotpStatusResponse`;
  `getTotpStatus()` → `TotpStatusResponse`; `stepUp(code)` → `StepUpResponse`;
  `disableTotp(stepUpToken)` → DELETE with `X-Step-Up-Token` header.
- Add to `lib/api/index.ts` barrel.

**Acceptance criteria:**
- [ ] All five functions typed from `components["schemas"]` (no `any`).
- [ ] `disableTotp` sends `X-Step-Up-Token`; `stepUp` posts `{ code }`.

**Verify:** `tsc --noEmit` ✔ · `lint` ✔. **Deps:** T1.1. **Files:** `lib/api/services/totp.ts`,
`lib/api/index.ts`. **Scope:** S.

### T1.3 — Step-up interceptor + modal (cross-cutting core)
**Description:** Catch `403` on gated `/api/v1/*` paths, prompt for a code once, mint a token, retry with
the header — implemented once, reused everywhere.
- `lib/api/step-up.ts`: a framework-free **registry** (`registerStepUpResolver`/`clearStepUpResolver`) and
  `isStepUpGated(method, path)` matching the 4 gated (method,path) pairs. No React import → no import cycle
  (`client.ts` → registry only; provider → totp service → client).
- `client.ts` interceptor: on a gated request returning `403` **and** a resolver is registered →
  `await resolver()` (returns a fresh token or `null` if cancelled) → retry **once** with
  `X-Step-Up-Token`. If retry still `403` (token spent/expired) → allow the resolver one re-mint, bounded
  (max 2 attempts) → otherwise throw the original `ApiError`. Never loop.
- `components/auth/step-up-modal.tsx`: code input (6–64 chars: 6-digit TOTP **or** recovery code), calls
  `stepUp(code)`; handles 400 ("Неверный код"), 429 (disable input + `Retry-After` countdown). Resolves the
  resolver promise with the token; cancel → resolves `null`.
- `components/auth/step-up-provider.tsx` (client): owns modal state, registers the resolver on mount,
  clears on unmount. Mounted via a small client wrapper in `app/(app)/layout.tsx`.

**Acceptance criteria:**
- [ ] Gated action by a **2FA-off** user behaves exactly as before (no 403 → no modal).
- [ ] Gated action by a **2FA-on** user → modal → correct code → original request retried with token → succeeds.
- [ ] Token is one-time: a second gated action mints a **fresh** token (no reuse); spent-token 403 re-mints once.
- [ ] Cancel closes the modal and surfaces the original error without a hang.
- [ ] No secret/token logged.

**Verify:** `npm run build` ✔ · `lint` ✔; manual against backend with a 2FA-enabled user. **Deps:** T1.2.
**Files:** `lib/api/step-up.ts`, `lib/api/client.ts`, `components/auth/step-up-modal.tsx`,
`components/auth/step-up-provider.tsx`, `app/(app)/layout.tsx` (+ client wrapper). **Scope:** M.

### T1.4 — 2FA settings page (F4)
**Description:** A Security settings page mirroring the connect-exchange/notifications card chrome.
- Add dep `qrcode.react`; render `<QRCodeSVG value={provisioning_uri} size={192} level="M" />` + the raw
  `secret` for manual entry.
- Flow: **status** (`getTotpStatus`) decides view → **Enroll** (`enrollTotp`) shows QR + secret +
  **10 recovery codes once** (copy / download, explicit "save now, shown once" warning) → **Verify**
  (`verifyTotp`, TOTP-only) flips `enabled:true` → **Disable** (`disableTotp`) runs through the step-up flow.
- Errors per matrix: 409 ("2FA уже включена — сначала отключите"), 400 ("Неверный код"), 429 (lockout +
  `Retry-After` countdown disabling the input).
- Page `app/(app)/settings/security/page.tsx` → `components/settings/two-factor-settings.tsx`. Nav: add a
  "Security" entry in `BASE_NAV_LINKS` + the header dropdown (`components/layout/app-header.tsx`).

**Acceptance criteria:**
- [ ] Enroll shows QR + secret + recovery codes once with a save/download affordance and warning.
- [ ] Verify requires a TOTP code; recovery code rejected at verify (per contract).
- [ ] Status renders enabled/disabled; Disable completes via step-up (X-Step-Up-Token).
- [ ] 409/400/429 handled; `Retry-After` blocks input for the window. No secrets logged.

**Verify:** `npm run build` ✔ · `lint` ✔; manual full enroll→verify→disable. **Deps:** T1.3. **Files:**
`app/(app)/settings/security/page.tsx`, `components/settings/two-factor-settings.tsx`,
`components/layout/app-header.tsx`, `package.json` (+`qrcode.react`). **Scope:** M.

### ☑️ Checkpoint A — Phase 1
- [ ] `build` + `lint` + `tsc --noEmit` green.
- [ ] Manual: enable 2FA end-to-end; saving auto-trade config (gated) prompts step-up and persists;
      adding an exchange key prompts step-up; disable 2FA prompts step-up.
- [ ] 2FA-off regression: config save / play / add-key unchanged (no modal).
- [ ] **Human review before Phase 2.**

---

## Phase 2 — Live Monitoring Dashboard (F2)  · P1

### T2.1 — Monitor page scaffold + portfolio summary
**Description:** New `/monitor` screen sourced from `getAutoTradePortfolio()`.
- Summary strip: `total_realized_pnl_usdt`, `total_unrealized_pnl_usdt`, `total_open_positions`,
  `total_running_strategies`, and **`portfolio_max_dd_pct`** with a "% of position notional, not account
  equity (W9 proxy)" caption.
- Page `app/(app)/monitor/page.tsx` → `components/monitor/live-monitor-dashboard.tsx`; nav link "Monitor".

**AC:** [ ] portfolio loads; summary incl. labeled portfolio Max-DD; loading/empty/error states.
**Verify:** `build` ✔ · `lint` ✔. **Deps:** Phase 1 (client headers) ·. **Files:** `app/(app)/monitor/page.tsx`,
`components/monitor/live-monitor-dashboard.tsx`, `components/layout/app-header.tsx`. **Scope:** M.

### T2.2 — Per-strategy live-KPI table
**Description:** A row per `StrategyPortfolioEntryRead`: `strategy_name`, `is_running`, realized/unrealized
PnL, `margin_used_usdt`, balances, and live KPIs `win_rate_pct`, `max_dd_pct`, `sharpe_proxy`, `roi_pct`,
`health_class` badge (4 states; `insufficient_data` neutral, **never** error-styled), `sample_size`, and
**`kpi_as_of`** freshness ("обновлено HH:MM" / "N мин назад"; `null` → "—", strategy stopped/no snapshot).
- Reuse existing KPI/format helpers from `components/auto-trade/auto-trade-budget-card.tsx` /
  `auto-trade-health-card.tsx`; denominator caption on every ROI/DD value; missing → "—", never `0`.

**AC:** [ ] all fields render; 4-state badge; freshness label; null→"—"; ROI/DD denominator-labeled.
**Verify:** `build` ✔ · `lint` ✔; manual across healthy/warning/critical/insufficient_data. **Deps:** T2.1.
**Files:** `components/monitor/live-monitor-dashboard.tsx` (+ small KPI subcomponents). **Scope:** M.

### T2.3 — Controls + health drill-down + auto-poll
**Description:** Lifecycle controls and the per-strategy health detail.
- Controls: `play` / `play-all` / `stop` / `stop-all` / `close-positions` (reuse existing services +
  close-positions modal). **`play` is gated** → step-up runs automatically via the T1.3 interceptor.
- Drill-down: `getStrategyHealth(configId, {window_days:30})` → `health_score`, `stability_score`,
  `total_pnl_usdt`, `window_days`, `computed_at` ("as of …").
- Auto-poll portfolio every 30s via `setInterval` in `useEffect`, paused on `document.hidden`, cleaned up on
  unmount (mirror the existing dashboard poll pattern). Keep a manual Refresh + refresh-after-action.

**AC:** [ ] controls work; play triggers step-up when 2FA on; health drill-down shows `computed_at`;
auto-poll refreshes without flicker/dupes and pauses when hidden.
**Verify:** `build` ✔ · `lint` ✔; manual (watch network tab). **Deps:** T2.2, T1.3. **Files:**
`components/monitor/live-monitor-dashboard.tsx`. **Scope:** M.

### ☑️ Checkpoint B — Phase 2
- [ ] `build`/`lint`/`tsc` green; manual KPI + controls + poll verified; **human review**.

---

## Phase 3 — SSE live-consumer (F5)  · P1

### T3.1 — BFF SSE proxy route
**Description:** `app/api/events/stream/route.ts` (Next Route Handler, `runtime="nodejs"`): read
`constructor_access_token` cookie, fetch backend `/api/v1/events/stream` with `Authorization: Bearer …` +
`Accept: text/event-stream`, **pipe `upstream.body`** back with SSE headers (`Content-Type:
text/event-stream`, `Cache-Control: no-store, no-transform`, `Connection: keep-alive`). On no cookie → 401;
forward upstream non-OK status (esp. 429). Token only via cookie — **never** query-string.

**AC:** [ ] `new EventSource("/api/events/stream")` (same-origin) streams events; unauthenticated → 401;
upstream 429 forwarded. **Verify:** `build` ✔ · `lint` ✔; manual curl/stream. **Deps:** none (parallelizable
with Phase 2). **Files:** `app/api/events/stream/route.ts`. **Scope:** S.

### T3.2 — risk-events store + provider (single EventSource/tab)
**Description:** `stores/risk-events-store.ts` (zustand): exactly **one** `EventSource` per tab, typed events
(`{ event_type, payload, message }`, the 8 streamable types), connection state, recent-events buffer,
manual **reconnect with exponential backoff**; on repeated immediate failures (proxy 429 / stream cap) stop
hammering and surface a muted "stream limited" state. `components/risk-events/risk-events-provider.tsx`
connects on mount / closes on unmount, mounted in `app/(app)/layout.tsx`.

**AC:** [ ] one connection per tab (not per component); reconnect/backoff on drop; 429 does not reconnect-loop;
clean teardown on unmount. **Verify:** `build` ✔ · `lint` ✔; manual (kill/restore stream). **Deps:** T3.1.
**Files:** `stores/risk-events-store.ts`, `components/risk-events/risk-events-provider.tsx`,
`app/(app)/layout.tsx`. **Scope:** M.

### T3.3 — Wire events → toasts + portfolio refetch
**Description:** Events are *hints, not source of truth*. On `kpi_guard_triggered` / `portfolio_dd_halt` /
`kill_switch_triggered` / `strategy_auto_paused` → toast (sonner, deduped) **and** refetch
`/portfolio` (statuses may have flipped to paused). Subscribe the Monitor to the store for live refresh +
a small connection indicator.

**AC:** [ ] key events raise a toast and re-fetch portfolio; Monitor reflects new statuses; no duplicate
streams; toasts deduped. **Verify:** `build` ✔ · `lint` ✔; manual via a backend-emitted event. **Deps:**
T3.2, T2.x. **Files:** `components/monitor/live-monitor-dashboard.tsx`, store wiring. **Scope:** S–M.

### ☑️ Checkpoint C — Phase 3
- [ ] `build`/`lint` green; SSE verified (event → toast + refetch); stream-cap (429) handled; **human review**.

---

## Phase 4 — AI Forecast Catalogue trader-UI (F3)  · P2

### T4.1 — Trader catalogue page
**Description:** Surface the catalogue (currently admin-only) in a trader page. Reuse existing services
`listAiForecastCatalogue({symbol,timeframe})`, `getCatalogueMetricsSchema`, `getAiForecastCatalogueEntry`.
Filters by symbol/timeframe; metrics table incl. Win / Sharpe / MaxDD and **Delta-vs-Baseline** (from
metrics-schema). Page `app/(app)/forecasts/page.tsx` → `components/forecasts/forecast-catalogue.tsx`; nav link.

**AC:** [ ] catalogue lists with symbol/timeframe filters and metric columns incl. Delta-vs-Baseline;
loading/empty/error states. **Verify:** `build` ✔ · `lint` ✔. **Deps:** none. **Files:**
`app/(app)/forecasts/page.tsx`, `components/forecasts/forecast-catalogue.tsx`,
`components/layout/app-header.tsx`. **Scope:** M.

### T4.2 — "Use in strategy" deep-link
**Description:** Per stakeholder: a row action that deep-links into the strategy/backtest builder with the
forecast preselected (`ai_forecast_file`) — reusing the existing builder binding; no backend change. Use a
query param (e.g. `/strategy?forecast=<file>`) the builder reads to preselect.

**AC:** [ ] action navigates to the builder with the chosen forecast preselected; no console errors.
**Verify:** `build` ✔ · `lint` ✔; manual. **Deps:** T4.1. **Files:** `components/forecasts/forecast-catalogue.tsx`,
builder page reading the param (`components/trading/trading-dashboard.tsx`). **Scope:** S–M.

### ☑️ Checkpoint D — Phase 4
- [ ] `build`/`lint` green; catalogue + deep-link verified; **human review**.

---

## Phase 5 — Acceptance & hardening

### T5.1 — Error-matrix + security audit
- [ ] Confirm TZ §5 matrix everywhere (400/403/409/429 + `Retry-After`).
- [ ] Grep for accidental logging of secret / recovery codes / step-up token (must be none).
- [ ] SSE token only via cookie/BFF; cookies `httpOnly`+`Secure`(prod)+`SameSite`; no token in query-string.

### T5.2 — Final acceptance run (TZ checklist)
- [ ] F4 enroll→verify→status→disable; 409/400/429 handled.
- [ ] Step-up: 2FA-off unchanged; 2FA-on modal→retry; one-time token honored.
- [ ] F2 live-KPI + `kpi_as_of` freshness + denominator-labeled DD/ROI; play under step-up.
- [ ] F5 single EventSource via BFF; reconnect/backoff; 429 handled; events → toast + refetch.
- [ ] F3 catalogue with filters, Delta-vs-Baseline, deep-link binding.
- [ ] `build` + `lint` + `tsc --noEmit` green.

---

## Risks & mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Step-up interceptor loops on repeated 403 | High | Hard cap 2 attempts; re-mint once; then throw original error |
| Import cycle `client.ts ↔ totp service` | Med | Registry is React/service-free; client imports only the registry |
| EventSource reconnect storm on 429 (stream cap) | Med | Manual reconnect w/ backoff; stop after N; muted "limited" state |
| Long-lived SSE outlives access-token cookie TTL | Med | Reconnect re-reads cookie (refreshed by periodic `/api/auth/refresh`); document caveat |
| Default Node v14 crashes lint/build | Med | Run all gates under Node 20/24 (nvm) — see memory note |
| Leaking secret/recovery/token to logs | High | No logging of those values; T5.1 grep gate |

## Open questions
- **SSE mid-stream auth expiry:** acceptable to rely on reconnect + periodic refresh for now? (No silent
  token refresh inside the streaming route in v1.)
- **F3 builder param contract:** confirm the builder reads `?forecast=<ai_forecast_file>` (or preferred param
  name) — finalized in T4.2.

---

## Commands (all under Node ≥ 18 / nvm 20)
```bash
nvm use 20
npm install qrcode.react        # T1.4 only
npx tsc --noEmit                 # typecheck gate
npm run lint                     # eslint gate
npm run build                    # full typecheck + bundle
npm run dev                      # manual QA (backend constructor on :8000)
```
No `gen:api-types` needed (contract already synced).
