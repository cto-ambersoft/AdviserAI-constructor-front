# Implementation Plan — Frontend support for backend W9 "Risk Enforcement"

> Companion to [SPEC.md](../SPEC.md). Plan-mode artifact: **read-only investigation complete; no code
> changed.** Awaiting human review before implementation.
> Backend reference: `../constructor/RISK_GOVERNANCE.md` (§5–§8). Contract is current in
> `lib/api/openapi-types.ts` (regenerated 2026-06-12) — **no `gen:api-types` needed**.

---

## 1. Goal & shape of the work

Close the frontend gap created by the backend's W9 wave (everything `constructor` shipped after this
repo's last commit `6fcc4cf`, 2026-06-04). Three independently-shippable deliverables on a thin shared
type foundation:

| Phase | Deliverable | Backend AC | Priority | Vertical slice (one complete path) |
|---|---|---|---|---|
| **0** | Type foundation (D0) | — | prereq | OpenAPI-derived portfolio/health/trace/risk types compile and existing consumers still typecheck |
| **1** | Risk Governance config UI (D1) | AC#4 | **P0** | trader edits nested `risk` → `PUT /config` persists → `GET` round-trips back into the form |
| **2** | Live KPI Monitor (D2) | AC#7 | **P1** | portfolio + per-strategy health KPIs render (denominator-labeled) and auto-refresh |
| **3** | Post-Trade Trace viewer (D3) | W9 T3.1 | **P2** | open a position → fetch its trace → render signal→close timeline |

Each phase is a **complete user-visible path**, mergeable on its own. Out of scope (backend 0%): 2FA,
W10 promotion pipeline, SSE, anomaly detection, W11 portfolio DD-watcher — **do not build UI for these**.

---

## 2. Dependency graph

```
                ┌─────────────────────────────────────────────┐
                │  Phase 0 · T0.1  Type foundation (D0)         │
                │  lib/api/types.ts  (openapi-derived types)    │
                └───────────────┬─────────────────────────────-┘
                                │ unblocks all three (additive, low-risk)
        ┌───────────────────────┼───────────────────────────┐
        ▼                       ▼                             ▼
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐
│ Phase 1 · D1     │  │ Phase 2 · D2          │  │ Phase 3 · D3              │
│ Risk Config UI   │  │ Live KPI Monitor      │  │ Post-Trade Trace viewer   │
│ (needs Risk type)│  │ (needs portfolio+     │  │ (needs trace+positions    │
│                  │  │  health types)        │  │  types)                   │
└──────────────────┘  └──────────────────────┘  └──────────────────────────┘
   P0, AC#4              P1, AC#7                   P2

D1, D2, D3 are mutually INDEPENDENT after T0.1 → parallelizable, but recommended order P0 → P1 → P2.
```

**Why T0.1 first:** the hand-written `PortfolioSummaryResponse`/`StrategyPortfolioEntry`
([lib/api/types.ts:282-310](../lib/api/types.ts)) omit every new KPI field; D2 can't render them until
the types are swapped. D1 needs `AutoTradeRiskConfig`; D3 needs `PositionTraceRead`. All three live in
one tiny file edit → do it once, up front.

---

## 3. Cross-cutting rules (apply to every phase)

From `RISK_GOVERNANCE.md` + repo conventions — enforced in code review of each task:
1. **ROI/DD must be denominator-labeled** ("% of position notional, not account equity — W9 proxy").
2. **`health_class` is 4-valued** (`healthy`/`warning`/`critical`/`insufficient_data`); `insufficient_data`
   and `null` are neutral, never error-styled; missing KPI → "—", never `0`.
3. **Nullable limits: empty ⇄ `null` ("rule off")**, never `0`.
4. **`net`/`replace` policies marked "W10 — not yet enforced".**
5. **No new dependency / route / backend change** without asking. **No `any`.** Derive from
   `components["schemas"]`; hand-write only form-state types.
6. **Green gate per task:** `npx tsc --noEmit` + `npm run lint` (and `npm run build` where a component
   ships). Consult **context7** for any Next.js 16 / React 19 API question during implementation.

---

## 4. Phase 0 — Type foundation (D0)

### T0.1 — Replace stale portfolio types; export health/trace/risk types
- **Files:** [lib/api/types.ts](../lib/api/types.ts) (around lines 168, 282-310).
- **Change:**
  ```ts
  export type AutoTradeRiskConfig       = components["schemas"]["AutoTradeRiskConfig"];
  export type StrategyPortfolioEntry    = components["schemas"]["StrategyPortfolioEntryRead"]; // replaces hand-written
  export type PortfolioSummaryResponse  = components["schemas"]["PortfolioSummaryResponse"];     // replaces hand-written
  export type StrategyHealthRead        = components["schemas"]["StrategyHealthRead"];
  export type PositionTraceRead         = components["schemas"]["PositionTraceRead"];
  ```
  Delete the hand-written `StrategyPortfolioEntry`/`PortfolioSummaryResponse` blocks.
- **Acceptance criteria:** new types resolve; the generated `StrategyPortfolioEntryRead` is a superset
  of the old hand-written entry (additive nullable KPI fields), so existing consumers
  ([auto-trade-budget-card.tsx](../components/auto-trade/auto-trade-budget-card.tsx),
  [auto-trade-dashboard.tsx](../components/auto-trade/auto-trade-dashboard.tsx)) still compile unchanged.
- **Verify:** `npx tsc --noEmit` green; `npm run lint` green; `git grep -n "StrategyPortfolioEntry\b"`
  shows only the type alias + existing consumers (no field references that disappeared).
- **Rollback:** revert the single file; zero runtime impact.

> **Checkpoint 0 (no review needed — mechanical):** typecheck green ⇒ proceed.

---

## 5. Phase 1 — Risk Governance config UI (D1, P0, AC#4)

Vertical slice: a trader configures pre-trade limits + KPI-Guard + Kill-Switch and the values
round-trip through the existing config upsert. Mirrors the controlled `AutoTradeStrategyProfileSection`
plumbing exactly (parent-owned state; persisted in shared `handleSave`).

### T1.1 — Risk form-state, defaults, mappers, validation (pure logic)
- **Files:** [components/auto-trade/types.ts](../components/auto-trade/types.ts),
  [components/auto-trade/utils.ts](../components/auto-trade/utils.ts).
- **Change:**
  - `types.ts`: add `ConflictingSignalPolicy`, `AutoTradeRiskFormState` (nullable numerics as
    `number | null`), `DEFAULT_RISK_CONFIG` (backend defaults: `enabled:true`, guards off, policy `off`,
    all limits `null`), and `risk: AutoTradeRiskFormState` on `AutoTradeFormState`.
  - `utils.ts`: `toRiskForm()` (reuse `toNullableNumber`/`toBoolean`; fallback `DEFAULT_RISK_CONFIG`;
    coerce enum), wired into `toAutoTradeForm` ([utils.ts:212](../components/auto-trade/utils.ts));
    `buildRiskConfigPayload()` (always returns object; unset limits stay `null`); extend
    `getAutoTradeValidation` with the §4.2 bounds (SPEC) + cross-field rules (KPI-Guard enabled ⇒ ≥1
    threshold set; Kill-Switch enabled ⇒ `atr_spike_mult` or `price_move_pct` set).
- **Acceptance criteria:** `toRiskForm(buildRiskConfigPayload(x))` is identity for valid `x` (round-trip);
  out-of-range values produce a clear validation message; `AutoTradeFormState` initialized for a config
  with no `risk` yields `DEFAULT_RISK_CONFIG`.
- **Verify:** `npx tsc --noEmit` + `npm run lint` green. (No UI yet.)

### T1.2 — Risk Governance section component + wire-up + save
- **Files (new):** [components/auto-trade/auto-trade-risk-section.tsx](../components/auto-trade/auto-trade-risk-section.tsx).
  **(edit):** [components/auto-trade/auto-trade-config-form.tsx](../components/auto-trade/auto-trade-config-form.tsx),
  [components/auto-trade/auto-trade-dashboard.tsx](../components/auto-trade/auto-trade-dashboard.tsx).
- **Change:**
  - New controlled section `{ value: AutoTradeRiskFormState; onChange }`, three sub-cards (Pre-Trade
    Limits / KPI-Guard / Kill-Switch) per SPEC §4.3; reuse `SECTION_CARD`/`ITEM_CARD`/`INPUT_CLASS`/`Label`
    and the `OptionalNumberInput` shape; `conflicting_signal_policy` select with `net`/`replace` marked
    "W10 — not yet enforced"; KPI-Guard-vs-pre-trade distinction in helper copy.
  - Render it in the form after *Advanced strategy profile*, before *AI Trend Overlay*
    ([config-form.tsx:356-368](../components/auto-trade/auto-trade-config-form.tsx)); thread
    `form.risk` + `onChange`.
  - In `handleSave` ([dashboard.tsx:624](../components/auto-trade/auto-trade-dashboard.tsx)) add
    `risk: buildRiskConfigPayload(form.risk)` to the payload; import the builder.
- **Acceptance criteria (D1 done):** all 18 fields editable; empty ⇄ `null`; section gated by master +
  sub-toggles; validation blocks bad input before the request.
- **Verify:** `npm run build` green.

> ### ✅ Checkpoint A — D1 review & QA gate (AC#4)
> Manual QA against `npm run dev` + constructor on :8000:
> 1. Open Auto-Trade → select/create a config → expand **Risk Governance**.
> 2. Set a pre-trade limit + enable KPI-Guard (Max-DD %) + Kill-Switch (spike mult) → **Save** → no `422`.
> 3. Reload / re-select config → **all values identical** (round-trip).
> 4. Clear a field → Save → request body sends `null`; field empty on reload.
> 5. Enter out-of-range → validation banner blocks Save.
> 6. Regression: save with risk untouched → normal fields persist, no behavior change.
> 7. Inspect `PUT …/config` body: `risk` object shape matches `AutoTradeRiskConfig`.
>
> **Human review here.** D1 is independently mergeable — ship before starting D2 if desired.

---

## 6. Phase 2 — Live KPI Monitor (D2, P1, AC#7)

Vertical slice: live KPIs for the portfolio and the selected strategy render (denominator-labeled) and
auto-refresh. Portfolio is already fetched ([dashboard.tsx:504](../components/auto-trade/auto-trade-dashboard.tsx));
the health endpoint is new.

### T2.1 — Health service + per-strategy KPI rendering + portfolio DD strip
- **Files:** [lib/api/services/live-auto-trade.ts](../lib/api/services/live-auto-trade.ts) (add
  `getStrategyHealth(configId, { window_days })` → `StrategyHealthRead`),
  [lib/api/index.ts](../lib/api/index.ts) (re-export comes free via `export *`),
  [components/auto-trade/auto-trade-budget-card.tsx](../components/auto-trade/auto-trade-budget-card.tsx)
  (add a compact KPI row: win-rate, ROI, max-DD, sharpe-proxy + `health_class` badge + `sample_size`),
  [components/auto-trade/auto-trade-dashboard.tsx](../components/auto-trade/auto-trade-dashboard.tsx)
  (portfolio header card ~824-867: add `portfolio_max_dd_pct`, labeled).
- **Acceptance criteria:** per-strategy KPIs come from the portfolio entry; every ROI/DD value carries
  the denominator caption; `health_class` badge renders all 4 states; `null` → "—".
- **Verify:** `npm run build` green; visual render check.

### T2.2 — Selected-strategy health drill-down
- **Files:** new small card/panel (e.g.
  `components/auto-trade/auto-trade-health-card.tsx`) + render in
  [dashboard.tsx](../components/auto-trade/auto-trade-dashboard.tsx) near the budget card; fetch
  `getStrategyHealth(configForScope.config_id)` in the scoped-load effect.
- **Acceptance criteria:** shows `health_score` (0–100) + `health_class` + `stability_score` +
  `window_days` + `computed_at` ("as of …"); handles loading/`insufficient_data`/404 (config without
  enough trades) gracefully.
- **Verify:** `npm run build` green; render check across health classes.

### T2.3 — Auto-poll refresh (30 s, visibility-paused)
- **Files:** [dashboard.tsx](../components/auto-trade/auto-trade-dashboard.tsx).
- **Change:** `useEffect` with `setInterval` (30 s) re-fetching `portfolio` + selected-strategy
  `health`; `clearInterval` on cleanup; pause when `document.hidden` via a `visibilitychange` listener.
  **Plain `useEffect` pattern (no SWR)** to match the codebase and avoid a new dependency — confirmed
  against Next.js 16 docs via context7. Keep manual Refresh + refresh-after-action intact.
- **Acceptance criteria:** no duplicate/leaking intervals; polling pauses when tab hidden; no flicker
  (KPIs update in place).
- **Verify:** `npm run build`; watch the network tab — one poll per interval, stops when hidden.

> ### ✅ Checkpoint B — D2 review & QA gate (AC#7)
> Manual QA: per-strategy + portfolio KPIs render with denominator labels; `health_class` across
> `healthy/warning/critical/insufficient_data`; nullable → "—"; drill-down shows `computed_at`;
> auto-poll refreshes and pauses on tab-hide. **Human review here.** Mergeable independently.

---

## 7. Phase 3 — Post-Trade Trace viewer (D3, P2)

Vertical slice: open a position and view its signal→close timeline. NOTE: the dashboard does **not**
currently fetch auto-trade positions (`getAutoTradePositions` is unused) — the trades table shows
exchange `AccountTradeRead`s, and the trace endpoint is keyed by `position_id`
(`AutoTradePositionRead.id`). So this slice adds a minimal positions list as its entry point.

### T3.1 — Trace service + positions list (trace entry point)
- **Files:** [lib/api/services/live-auto-trade.ts](../lib/api/services/live-auto-trade.ts) (add
  `getPositionTrace(positionId)` → `PositionTraceRead`; `getAutoTradePositions` already exists),
  [dashboard.tsx](../components/auto-trade/auto-trade-dashboard.tsx) (fetch positions scoped by
  `config_id`/`account_id`; render a compact positions panel — `id`, symbol, side, status, PnL — with a
  "Trace" action per row).
- **Acceptance criteria:** positions load for the selected scope; each row exposes a Trace action keyed
  by `position.id`; open + closed positions both listed; empty/loading states handled.
- **Verify:** `npm run build` green; render check.

### T3.2 — Trace modal (timeline)
- **Files (new):** [components/auto-trade/auto-trade-position-trace-modal.tsx](../components/auto-trade/auto-trade-position-trace-modal.tsx)
  (reuse the `Dialog` primitive + the open-on-mount fetch pattern from
  [auto-trade-close-positions-modal.tsx](../components/auto-trade/auto-trade-close-positions-modal.tsx)).
- **Change:** header (symbol · side · status, entry→close prices, `close_reason` highlighted for
  `volatility_kill_switch`/auto-pause, timestamps); linkage chips (`decision_event_id` copyable +
  labeled as a core pointer, not a link; order/history ids); vertical timeline of `events`
  (reuse the row shape from [lib/auto-trade/mappers.ts](../lib/auto-trade/mappers.ts)).
- **Acceptance criteria:** trace opens for any position; metadata + linkage + ordered timeline render;
  read-only; loading/empty/error handled.
- **Verify:** `npm run build` green.

> ### ✅ Checkpoint C — D3 review & QA gate
> Manual QA: open trace for a closed position (ideally one closed by kill-switch / auto-pause) →
> metadata + linkage + ordered event timeline; `close_reason` prominent; read-only. **Human review.**

---

## 8. Risks, mitigations, rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stale-type swap (T0.1) breaks an existing consumer | Low | New fields are additive/nullable; `tsc` catches any break immediately; single-file revert. |
| KPI proxy numbers misread as account-level | Med | Mandatory denominator labels (cross-cutting rule #1) — gate in review. |
| Enabling a guard pauses a live strategy unexpectedly | Med | Backend ships all guards OFF; UI defaults off + explicit "can autonomously pause/close" copy. |
| Auto-poll leaks intervals / hammers backend | Low | Single interval, cleanup on unmount, visibility-pause; verify in network tab. |
| Positions panel (D3) scope mismatch | Low | Reuse the existing `config_id`/`account_id` scope threading already proven for other panels. |
| Contract drift (frontend `openapi.json` vs backend) | Low | Already synced (2026-06-12); if a 422 surfaces, re-run `gen:api-types` and reconcile before proceeding. |

Each phase reverts cleanly (small, isolated file sets) and ships independently — no phase depends on a
later one.

---

## 9. Definition of done (whole effort)
- D0+D1+D2+D3 each pass their checkpoint QA; `npx tsc --noEmit`, `npm run lint`, `npm run build` green.
- All cross-cutting rules (§3) satisfied; no new deps/routes/backend changes; no `any`.
- AC#4 (risk enforcement configurable from UI) and AC#7 (live KPI transparency in UI) demonstrably met;
  post-trade execution auditable via the trace viewer.

*Plan ready for review. On approval, execute Phase 0 → 1 → 2 → 3, stopping at each checkpoint.*
