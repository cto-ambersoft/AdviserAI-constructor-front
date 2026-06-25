# TODO — Milestone 4 frontend (2FA / Step-up / Live Monitor / SSE / Forecast Catalogue)

> Tracks [tasks/m4-frontend-plan.md](m4-frontend-plan.md). TZ: [`../constructor/tasks/m4-frontend-tz.md`].
> Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.
> Each task ends green: `tsc --noEmit` + `lint` (Node ≥ 18 / nvm 20); `build` where UI ships.
> Use **context7** for `qrcode.react` and Next.js 16 streaming APIs. No `gen:api-types` needed.

---

## Phase 1 — Step-up + 2FA (F4) · P0 (most important)
- [x] **T1.1** Client foundations — `headers` option, 403 map, `ApiError.retryAfterSeconds`, 2FA type re-exports — `e9ec6b3`
  - files: `lib/api/client.ts`, `lib/api/types.ts` · verify: `tsc`+`lint` ✔ + parseRetryAfter assertions ✔
- [x] **T1.2** TOTP service — enroll/verify/status/stepUp/disable — `0138112`
  - files: `lib/api/services/totp.ts`, `lib/api/index.ts` · verify: `tsc`+`lint` ✔
- [x] **T1.3** Step-up interceptor + modal + provider (one-time token, bounded retry, gated-path matcher) — `3b8de52`
  - files: `lib/api/step-up.ts`, `lib/api/client.ts`, `components/auth/step-up-modal.tsx`,
    `components/auth/step-up-provider.tsx`, `app/(app)/layout.tsx` · verify: `build` ✔ + isStepUpGated assertions ✔ (manual @ Checkpoint A)
- [x] **T1.4** 2FA settings page — `qrcode.react`, enroll(QR+secret+recovery once)→verify→status→disable(step-up) — `03f3a9d`
  - files: `app/(app)/settings/security/page.tsx`, `components/settings/two-factor-settings.tsx`,
    `components/layout/app-header.tsx`, `package.json` · verify: `build` ✔ (route generated)
- [~] ☑️ **Checkpoint A** — code gates GREEN (`tsc`+`lint`+`build` ✔; parseRetryAfter + isStepUpGated assertions ✔).
  - [ ] **Manual QA pending** — needs constructor backend on :8000 + a real login + an authenticator app
        (enroll→verify→status→disable; gated save/play/add-key prompts step-up; 2FA-off regression).
        Not runnable in this env (backend down; cannot enter credentials). **Human review before Phase 2.**

## Phase 2 — Live Monitoring Dashboard (F2) · P1
- [x] **T2.1** `/monitor` page + portfolio summary (labeled `portfolio_max_dd_pct`) — `fc9b0b6`
  - files: `app/(app)/monitor/page.tsx`, `components/monitor/live-monitor-dashboard.tsx`, `kpi-format.tsx`, app-header nav
- [x] **T2.2** Per-strategy KPI cards — win/roi/maxDD/sharpe + 4-state `health_class` + `kpi_as_of` freshness + denom labels (null→"—") — `04ab7e8`
  - files: `components/monitor/strategy-monitor-card.tsx`, `live-monitor-dashboard.tsx`
- [x] **T2.3** Controls (play[gated]/play-all/stop/stop-all/close) + health drill-down + 30s auto-poll (pause on hidden) — `0edc421`
  - files: `components/monitor/live-monitor-dashboard.tsx`, `strategy-monitor-card.tsx`
- [~] ☑️ **Checkpoint B** — code gates GREEN (`tsc`+`lint`+`build` ✔; kpi-format assertions: null→"—", freshness, signs ✔).
  - [ ] **Manual QA pending** — needs backend on :8000 + login: KPI cards across health states,
        `kpi_as_of` freshness, denom labels, controls (play→step-up when 2FA on), drill-down `computed_at`,
        30s poll pauses when tab hidden. Not runnable here (auth-gated, backend down). **Human review.**

## Phase 3 — SSE live-consumer (F5) · P1
- [x] **T3.1** BFF SSE proxy route (nodejs runtime, cookie→Bearer, pipe body, forward 429, never query-string) — `280d271`
  - files: `app/api/events/stream/route.ts` · verify: `build` ✔ + RUNTIME ✔ (401 no-cookie, 502 no-backend, 200 piped SSE frame via stub)
- [x] **T3.2** risk-events zustand store + provider — single EventSource/tab, reconnect+backoff, 429→"limited" guard — `1002bf8`
  - files: `stores/risk-events-store.ts`, `components/risk-events/risk-events-provider.tsx`, `app/(app)/layout.tsx` · verify: `build` ✔ + parseRiskEvent/backoff assertions ✔
- [x] **T3.3** events → deduped toasts + portfolio refetch + connection pill — `a48868a`
  - files: `components/risk-events/risk-event-display.ts`, `components/monitor/live-monitor-dashboard.tsx` · verify: `build` ✔ + tone/refetch assertions ✔
- [~] ☑️ **Checkpoint C** — code gates GREEN; SSE transport RUNTIME-verified (cookie→Bearer→pipe).
  - [ ] **Manual QA pending** — needs backend on :8000 emitting events + login: one EventSource/tab,
        risk event → toast + portfolio refetch, reconnect on drop, 429 stream-cap → "limited" (no busy-loop). **Human review.**

## Phase 4 — AI Forecast Catalogue trader-UI (F3) · P2
- [x] **T4.1** Trader catalogue page — filters symbol/timeframe + schema-driven metrics incl. Delta-vs-Baseline — `2ee1f65`
  - files: `app/(app)/forecasts/page.tsx`, `components/forecasts/forecast-catalogue.tsx`, `lib/ai-backtests/metric-format.ts`, app-header nav
  - (extracted formatMetricValue/pickMetricValue to shared module; admin catalogue now imports them)
- [x] **T4.2** "Use in strategy" deep-link → `/strategy?forecast=` preselects `ai_forecast_file` (apply-until-sticks) — `240c2a9`
  - files: `components/forecasts/forecast-catalogue.tsx`, `components/trading/trading-dashboard.tsx`
- [~] ☑️ **Checkpoint D** — code gates GREEN (`tsc`+`lint`+`build` ✔; metric-format assertions ✔).
  - [ ] **Manual QA pending** — needs backend on :8000 + login: catalogue lists with symbol/timeframe
        filters + Delta-vs-Baseline columns; "Use in strategy" lands on `/strategy` with forecast preselected
        + run_with_ai on. Not runnable here (auth-gated). **Human review.**

## Phase 5 — Acceptance & hardening
- [x] **T5.1** Error-matrix audit (400/403/409/429 + Retry-After ✅); no secret/recovery/token logging ✅;
      SSE token cookie-only ✅; cookies httpOnly+Secure(prod)+SameSite ✅; no sensitive localStorage ✅
- [x] **T5.2** Final TZ acceptance checklist → [m4-frontend-acceptance.md](m4-frontend-acceptance.md);
      whole-repo `tsc`+`lint`+`build` GREEN; all M4 routes generated
- [x] ☑️ **Checkpoint Complete** — all code gates green; acceptance report written. Manual QA (A–D) is the
      only remaining work and needs a live backend + login + authenticator.
