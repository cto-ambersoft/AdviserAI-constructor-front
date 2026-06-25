# SPEC — Frontend support for backend Milestone-4 / Week-9 "Risk Enforcement"

> Spec-driven development document. Status: **DRAFT — awaiting approval before implementation.**
> Derived from the `constructor` (backend) commits landed **after** this frontend's last commit
> (`6fcc4cf`, 2026-06-04T17:59:14+03:00). Authoritative backend reference:
> `../constructor/RISK_GOVERNANCE.md` (§5–§8, "Risk Enforcement W9").

---

## 0. Provenance — what the backend shipped while the frontend stood still

Last frontend commit: `6fcc4cf ui(auto-trade): precise PnL decomposition (W9)` — **2026-06-04**.
Since then `constructor` landed the **entire W9 Risk-Enforcement wave** (the in-trade and
post-trade enforcement layer on top of the W8 pre-trade foundation). The frontend has **zero**
support for any of it.

| Backend commit (constructor) | What it added | Frontend-facing contract |
|---|---|---|
| `6439ac0` W9 T0.1 | `roi_pct` on Strategy Health + named normalization base | `StrategyHealthRead.roi_pct` |
| `4670fe0` W9 T0.2 | persist `strategy_health_snapshots` (KPI history) | (feeds portfolio KPIs) |
| `197259c` W9 T1.1 | **KPI-Guard auto-pause thresholds** on risk config | `AutoTradeRiskConfig.kpi_guard_*` |
| `6339ef3` W9 T1.2 | KPI-Guard evaluator + idempotent auto-pause | events: `kpi_guard_triggered`, `strategy_auto_paused` |
| `570e91b` W9 T1.3 | KPI-Guard sweep cron (`*/5m`) — auto-pause running strategies | (server-side) |
| `e7ee621` W9 T1.4 | on-close fast-path + daily-loss / min-win-rate rules | (server-side) |
| `5bf8159` W9 T2.1 | **Volatility Kill-Switch thresholds** on risk config | `AutoTradeRiskConfig.kill_switch_*` |
| `5f14dc9`→`05de538` W9 T2.2–2.4 | kill-switch detector, hard close, risk-off latch | events: `kill_switch_triggered`, `risk_off_entered` |
| `be9ca76` W9 T3.1 | **Post-trade execution trace endpoint** | `GET …/positions/{id}/trace` → `PositionTraceRead` |
| `76f39c2` W9 T3.2 | **portfolio summary live KPIs** from health snapshots | `PortfolioSummaryResponse` per-strategy KPIs + `portfolio_max_dd_pct` |
| `62800a3` W9 T2.3b | wire kill-switch into production | (server-side plumbing) |
| `1b956b0` W9 T4.1 | `RISK_GOVERNANCE.md` reference + AC matrix | the doc this spec cites |
| `71fb84e`,`021fd0b`,`45b7e3d`,`9c8f06e`,`75e00f6` | W9 risk review fixes / REST partial-TP SL / deadlock | (server-side, no new contract) |

The backend's own AC matrix (`RISK_GOVERNANCE.md` §8) closes **AC#4 ✅ (engine)** and
**AC#7 ✅ (backend); UI W12** and lists, under *"Carried forward"*: **"KPI dashboard UI + SSE (W12)"**.
That carried-forward UI work — plus the risk-config inputs and the new trace endpoint — **is exactly
this spec.**

### What the contract is already ready for (no backend work needed)
The frontend OpenAPI contract is current (regenerated; `openapi.json` dated 2026-06-12). All three
deliverables below have a live, typed contract in [lib/api/openapi-types.ts](lib/api/openapi-types.ts):
- `AutoTradeRiskConfig` (openapi-types.ts:2747) with `kpi_guard_*` / `kill_switch_*`; `risk` field on
  `AutoTradeConfigRead`/`UpsertRequest` (openapi-types.ts:2366, :2427).
- `StrategyHealthRead` + `GET …/strategies/{config_id}/health?window_days=30`.
- `PositionTraceRead` + `GET …/positions/{position_id}/trace`.
- `PortfolioSummaryResponse`/`StrategyPortfolioEntryRead` per-strategy KPIs + `portfolio_max_dd_pct`.

### Explicitly OUT of scope (backend is 0% — nothing to integrate)
2FA (AC#5), W10 Strategy-Promotion Pipeline, SSE streaming, anomaly detection, Portfolio-Supervisor
DD-watcher (W11). Per the backend doc these are deferred/not-built; **do not** build UI for them.

---

## 1. Objective & deliverables

**Objective:** give the trader UI first-class support for the W9 backend risk-enforcement layer, so
AC#4 (risk enforcement) and AC#7 (live KPI transparency) are satisfiable from the UI, and post-trade
execution is auditable. Three deliverables, independently shippable, in priority order:

| ID | Deliverable | Backend AC | Priority | Depends on |
|----|-------------|-----------|----------|-----------|
| **D1** | **Risk Governance config UI** — edit the nested `risk` (pre-trade limits + KPI-Guard + Kill-Switch) on the config upsert | AC#4 | **P0** | — |
| **D2** | **Live KPI Monitor** — render per-strategy live KPIs (win-rate / max-DD / sharpe-proxy / ROI / health class) from the portfolio + per-strategy health endpoint | AC#7 | **P1** | D0 (type fix) |
| **D3** | **Post-Trade Trace viewer** — signal→close timeline drawer for a position via the trace endpoint | (W9 T3.1) | **P2** | — |

Plus a small prerequisite **D0**: replace the stale hand-written `PortfolioSummaryResponse` /
`StrategyPortfolioEntry` in [lib/api/types.ts:282](lib/api/types.ts) with the OpenAPI-derived types
(they currently omit every new KPI field). Required by D2.

**Target users:** authenticated traders on the Auto-Trade page (`app/(app)/auto-trade/page.tsx`)
managing one or more live strategies.

---

## 2. Cross-cutting requirements (from `RISK_GOVERNANCE.md` — mandatory for D1 & D2)

These come straight from the backend reference and its review notes; treat as hard constraints:

1. **ROI/DD denominator label (review I3, doc §7).** `roi_pct` and `max_dd_pct` are normalized by the
   **per-trade notional (`position_size_usdt`), NOT account equity** — a deliberate W9 proxy that can
   read **high** (12 wins on a 100-USDT base ⇒ `roi_pct = 120%`). **Any UI that shows these MUST label
   the denominator** (e.g. "% of position notional, not account equity") — the OpenAPI field
   descriptions carry the same warning. Non-negotiable.
2. **`health_class` is 4-valued:** `healthy` / `warning` / `critical` / `insufficient_data`. The UI must
   render all four; `insufficient_data` (< `HEALTH_MIN_TRADES` = 10 closed trades, review I2) is a
   neutral state, **never** styled as a failure.
3. **KPI-Guard ≠ pre-trade daily-loss (doc §5).** Pre-trade `daily_loss_limit_*` *blocks the next entry*;
   `kpi_guard_max_daily_loss_*` *pauses the whole strategy*. UI copy must make this distinction obvious
   so traders don't conflate them.
4. **Everything is opt-in & OFF by default (doc §intro, §5, §6).** Every threshold ships `None`/disabled
   and "must be calibrated with traders before enabled in production." UI framing: safe defaults, clear
   that enabling a guard can autonomously pause a running strategy / close a position.
5. **`conflicting_signal_policy` — `net`/`replace` are not active yet (doc §1 table, §8 carried-forward).**
   Backend fully implements `off` and `block_opposite`; `net`/`replace` are *"logged + skipped (W10)"*.
   Expose all four enum values (the contract accepts them) but **mark `net`/`replace` as "W10 — not yet
   enforced"** so a trader isn't misled into thinking they net positions today.
6. **Auto-pause is observable in the event stream.** The UI already renders `AutoTradeEvent`s; the new
   system events (`kpi_guard_triggered`, `strategy_auto_paused`, `kill_switch_triggered`,
   `risk_off_entered`, `risk_check_degraded`, `risk_blocked`) should be legible there (D2 surfaces the
   "why paused" cue; no schema change needed — they already flow through `getAutoTradeEvents`).

---

## 3. D0 — Type alignment (prerequisite)

`lib/api/types.ts:282-310` hand-writes `StrategyPortfolioEntry` / `PortfolioSummaryResponse` and is
**stale** — it omits `win_rate_pct`, `max_dd_pct`, `sharpe_proxy`, `roi_pct`, `health_class`,
`sample_size`, and `portfolio_max_dd_pct`. Replace with the generated types:

```ts
export type StrategyPortfolioEntry = components["schemas"]["StrategyPortfolioEntryRead"];
export type PortfolioSummaryResponse = components["schemas"]["PortfolioSummaryResponse"];
export type StrategyHealthRead = components["schemas"]["StrategyHealthRead"];
export type PositionTraceRead = components["schemas"]["PositionTraceRead"];
export type AutoTradeRiskConfig = components["schemas"]["AutoTradeRiskConfig"];
```

Verify existing consumers ([auto-trade-budget-card.tsx](components/auto-trade/auto-trade-budget-card.tsx),
[auto-trade-dashboard.tsx](components/auto-trade/auto-trade-dashboard.tsx)) still typecheck — the new
KPI fields are additive + nullable, so they should. `tsc` green is the gate.

---

## 4. D1 — Risk Governance config UI  *(P0, AC#4)*

### 4.1 Where it plugs in
Risk settings are a **nested `risk: AutoTradeRiskConfig`** on the existing
`PUT/GET /api/v1/live/auto-trade/config` — **no separate endpoint**. So D1 mirrors the existing
**controlled `AutoTradeStrategyProfileSection`** model (parent owns state; child is `{value, onChange}`;
persisted in the shared `handleSave`) — *not* the self-saving AI-overlay pattern.

```
GET /config → risk → toAutoTradeForm()/toRiskForm() → form.risk
   → <AutoTradeRiskGovernanceSection value onChange>   (controlled)
Save → handleSave() → buildRiskConfigPayload(form.risk) → payload.risk → PUT /config
```

### 4.2 The contract — `AutoTradeRiskConfig` (openapi-types.ts:2747)
Every numeric limit is **nullable** (`null` = "rule off"). Bounds mirror the backend CheckConstraints;
client validation must enforce them to prevent a `422`.

| Field | Type | Bounds | Default | Group |
|---|---|---|---|---|
| `enabled` | bool | — | `true` | master |
| `daily_loss_limit_usdt` | num\|null | ≥ 0 | null | Pre-trade |
| `daily_loss_limit_pct` | num\|null | 0 < x ≤ 100 | null | Pre-trade |
| `max_open_positions` | int\|null | ≥ 1 | null | Pre-trade |
| `max_open_positions_per_symbol` | int\|null | ≥ 1 | null | Pre-trade |
| `exposure_cap_usdt` | num\|null | > 0 | null | Pre-trade |
| `leverage_ceiling` | int\|null | 1..125 | null | Pre-trade |
| `conflicting_signal_policy` | enum | off \| block_opposite \| net \| replace | `"off"` | Pre-trade |
| `kpi_guard_enabled` | bool | — | `false` | KPI-Guard |
| `kpi_guard_max_dd_pct` | num\|null | 0 < x ≤ 100 | null | KPI-Guard |
| `kpi_guard_max_daily_loss_usdt` | num\|null | ≥ 0 | null | KPI-Guard |
| `kpi_guard_max_daily_loss_pct` | num\|null | 0 < x ≤ 100 | null | KPI-Guard |
| `kpi_guard_min_win_rate_pct` | num\|null | 0..100 | null | KPI-Guard |
| `kpi_guard_min_trades` | int\|null | ≥ 1 | null | KPI-Guard |
| `kill_switch_enabled` | bool | — | `false` | Kill-Switch |
| `kill_switch_atr_spike_mult` | num\|null | > 1 | null | Kill-Switch |
| `kill_switch_atr_period` | int\|null | ≥ 2 | null | Kill-Switch |
| `kill_switch_price_move_pct` | num\|null | > 0 | null | Kill-Switch |
| `kill_switch_cooldown_seconds` | int\|null | ≥ 0 | null | Kill-Switch |

### 4.3 UI: one collapsible "Risk Governance" section, three sub-cards
1. **Pre-Trade Limits** (W8 engine) — the 6 limits + `conflicting_signal_policy`. Helper text:
   "blocks the *next entry* when violated; records a `risk_blocked` event."
2. **KPI Guard — auto-pause** (W9 §5) — `kpi_guard_enabled` gates its 5 thresholds. Helper text:
   "**pauses the whole strategy** on a confirmed live-KPI breach (Max-DD / daily-loss / min win-rate).
   Statistical rules need ≥ 10 closed trades." Distinct-from-pre-trade callout (req §2.3).
3. **Volatility Kill-Switch** (W9 §6) — `kill_switch_enabled` gates its 4 params. Helper text:
   "**hard-closes the position and pauses the strategy** on a confirmed volatility spike."

Behaviors: nullable inputs use the empty-string ⇄ `null` convention (reuse `OptionalNumberInput`,
[auto-trade-config-form.tsx:434](components/auto-trade/auto-trade-config-form.tsx)); sub-toggles
disable their fields; whole section de-emphasized when master `enabled` off; `net`/`replace` carry the
"W10 — not yet enforced" marker (req §2.5). Styling matches the strategy-profile section chrome
(`SECTION_CARD`/`ITEM_CARD`, `INPUT_CLASS`, `Label`).

### 4.4 Form state, mappers, validation (mirrors strategy-profile plumbing)
- `components/auto-trade/types.ts`: add `AutoTradeRiskFormState` (nullable numbers as `number | null`),
  `ConflictingSignalPolicy`, `DEFAULT_RISK_CONFIG` (= backend defaults: `enabled:true`, guards off,
  policy `off`, all limits null), and `risk: AutoTradeRiskFormState` on `AutoTradeFormState`.
- `components/auto-trade/utils.ts`: `toRiskForm()` (reuse `toNullableNumber`/`toBoolean`; fallback
  `DEFAULT_RISK_CONFIG`; coerce enum) wired into `toAutoTradeForm` (utils.ts:212);
  `buildRiskConfigPayload()` (always returns the object; unset limits stay `null`); extend
  `getAutoTradeValidation` with §4.2 bounds + cross-field rules (if `kpi_guard_enabled` ⇒ ≥1 threshold
  set; if `kill_switch_enabled` ⇒ `atr_spike_mult` or `price_move_pct` set), feeding the existing banner.
- `components/auto-trade/auto-trade-dashboard.tsx` (`handleSave`, ~line 624): add
  `risk: buildRiskConfigPayload(form.risk)` to the payload; import the builder.
- `components/auto-trade/auto-trade-risk-section.tsx` **(NEW)**: the controlled section; render it in
  `auto-trade-config-form.tsx` after *Advanced strategy profile*, before *AI Trend Overlay*
  ([:356-368](components/auto-trade/auto-trade-config-form.tsx)).

### 4.5 D1 acceptance criteria
- All 18 fields editable per §4.2; empty ⇄ `null` (not `0`); lossless round-trip (save→reload identical).
- Client validation blocks every out-of-range value before the request (no `422`).
- `net`/`replace` visibly marked "W10 — not yet enforced"; KPI-Guard vs pre-trade distinction visible.
- Saving with the section untouched is a no-op faithful to backend defaults; non-risk save unaffected.

---

## 5. D2 — Live KPI Monitor  *(P1, AC#7)*

### 5.1 Data sources (both already typed; portfolio already fetched)
- `GET /api/v1/live/auto-trade/portfolio` → `PortfolioSummaryResponse` — **already fetched** in
  `loadPortfolio` ([auto-trade-dashboard.tsx:504](components/auto-trade/auto-trade-dashboard.tsx)) but
  its KPI fields are ignored. Per entry: `win_rate_pct`, `max_dd_pct`, `sharpe_proxy`, `roi_pct`,
  `health_class`, `sample_size` (all nullable); portfolio-level `portfolio_max_dd_pct`.
- `GET …/strategies/{config_id}/health?window_days=30` → `StrategyHealthRead` — **not wired**; adds
  `health_score` (0–100), `stability_score`, `total_pnl_usdt`, `window_days`, `computed_at` for the
  drill-down on the selected strategy. New service fn `getStrategyHealth(configId, {window_days})` in
  `lib/api/services/live-auto-trade.ts`.

### 5.2 UI
- **Portfolio KPI strip** in the portfolio summary card (dashboard:824-867): add `portfolio_max_dd_pct`
  (labeled per req §2.1) next to the existing realized/unrealized/running totals.
- **Per-strategy KPI** on each budget/strategy entry ([auto-trade-budget-card.tsx](components/auto-trade/auto-trade-budget-card.tsx)):
  a compact KPI row — win-rate, ROI, max-DD, sharpe-proxy, plus a `health_class` badge (4 states,
  req §2.2) and `sample_size`. `null` → "—" with a "no data yet" affordance, never `0`.
- **Health drill-down** for the selected strategy: a small card (or expandable panel) showing
  `health_score` + `health_class` + `stability_score` + `window_days` + `computed_at` ("as of …"),
  fetched via the health endpoint for `configForScope.config_id`.
- **Denominator labeling** (req §2.1) on every ROI/DD value — a one-line caption or info tooltip:
  "% of position notional (`position_size_usdt`), not account equity — W9 proxy."

### 5.3 Refresh (auto-poll — confirmed preference)
Add a polling interval for the live view so it reads as a "live dashboard" (AC#7). Default **30 s**,
`setInterval` in a `useEffect` with cleanup; pause when `document.hidden`; keep the existing manual
Refresh + refresh-after-action. Re-poll `portfolio` (+ the selected-strategy `health`). (SSE is W12 /
not on the backend — polling is the correct choice now.)

### 5.4 D2 acceptance criteria
- Every ROI/DD figure is denominator-labeled. `health_class` renders all 4 states; `insufficient_data`
  and `null` are neutral, never error-styled.
- Per-strategy KPIs come from the portfolio response; the selected-strategy drill-down comes from the
  health endpoint and shows `computed_at`. Auto-poll refreshes without flicker or duplicate requests.
- No `0`-for-missing; nullable → "—".

---

## 6. D3 — Post-Trade Trace viewer  *(P2, W9 T3.1)*

### 6.1 Contract
`GET /api/v1/live/auto-trade/positions/{position_id}/trace` → `PositionTraceRead`: position metadata
(`symbol`, `side`, `status`, `state`, `entry_price`, `close_price`, `close_reason`, timestamps),
linkage pointers (`decision_event_id` → core's `ai_decision_events`, **surfaced not dereferenced**;
`open/close_history_id`, `open/close_order_id`), and a chronological `events: AutoTradeEvent[]` list.
New service fn `getPositionTrace(positionId)` in `lib/api/services/live-auto-trade.ts`.

### 6.2 UI
A **trace drawer/modal** (reuse the `Dialog` primitive used by
[auto-trade-close-positions-modal.tsx](components/auto-trade/auto-trade-close-positions-modal.tsx)),
opened from a "Trace" action on a position/trade row (positions are already loaded via
`getAutoTradePositions`). Contents:
- Header: symbol · side · status, entry→close prices, `close_reason` (highlight
  `volatility_kill_switch` / auto-pause reasons), opened/closed timestamps.
- Linkage chips: `decision_event_id` (copyable; labeled as a core pointer, not a link), order/history ids.
- A vertical **timeline** of `events` (reuse the event-row rendering / `mapAutoTradeEventsToTimelineRows`
  shape from [lib/auto-trade/mappers.ts](lib/auto-trade/mappers.ts)) showing the signal→close path.

### 6.3 D3 acceptance criteria
- Trace opens for any position, renders metadata + linkage + ordered event timeline; `close_reason` is
  prominent. Read-only; `decision_event_id` is shown, not dereferenced. Loading/empty/error states handled.

---

## 7. Commands

No test runner exists (no jest/vitest/playwright in `package.json`; zero test files). Gates:

```bash
npm run dev            # local app for manual verification (backend constructor on :8000)
npm run build          # full production typecheck + bundle
npm run lint           # eslint
npx tsc --noEmit       # standalone typecheck (tsconfig noEmit:true)
npm run gen:api-types  # regenerate openapi-types.ts — NOT needed (contract already current)
```
`/api/v1/*` calls go **directly** to the backend (only non-versioned paths use the Next.js proxy —
`lib/api/client.ts`). Every increment must leave `tsc --noEmit` + `lint` green.

---

## 8. Project structure (files touched)

```
lib/api/
  types.ts                         # [EDIT] D0: openapi-derived portfolio/health/trace/risk types
  services/live-auto-trade.ts      # [EDIT] D2: getStrategyHealth(); D3: getPositionTrace()
  openapi-types.ts                 # [READONLY] generated — contract already current
components/auto-trade/
  types.ts                         # [EDIT] D1: AutoTradeRiskFormState + risk on form + DEFAULT_RISK_CONFIG
  utils.ts                         # [EDIT] D1: toRiskForm/buildRiskConfigPayload/validation
  auto-trade-risk-section.tsx      # [NEW]  D1: controlled Risk Governance section
  auto-trade-config-form.tsx       # [EDIT] D1: render risk section + thread state
  auto-trade-dashboard.tsx         # [EDIT] D1: risk in handleSave; D2: KPI strip + auto-poll + health drill-down
  auto-trade-budget-card.tsx       # [EDIT] D2: per-strategy KPI row + health_class badge
  auto-trade-position-trace-modal.tsx  # [NEW] D3: trace drawer
```
No new dependencies, routes, or backend changes.

---

## 9. Code style
- Match surrounding code: `"use client"`, controlled inputs, `onChange((prev) => …)`, `INPUT_CLASS` +
  `Label`, Tailwind v4, `lucide-react`, `cn()`. **No `any`** — derive from `components["schemas"]`;
  hand-write only form-state types (as the codebase already does for profile/TP state).
- Nullable numerics use the empty ⇄ `null` convention (`OptionalNumberInput`). Missing KPIs render "—",
  never `0`.
- D1 section stays purely controlled (no fetching), like `AutoTradeStrategyProfileSection`. D2 polling
  lives in the dashboard, cleaned up on unmount and paused on `document.hidden`.
- Brief comments tie fields/sections to W9 plan items and the doc's review caveats (I2/I3).

---

## 10. Testing / verification strategy
No automated harness; **do not add one** for this spec. Ladder: `tsc --noEmit` → `lint` → `build` →
**manual QA** against a running backend (`npm run dev` + constructor on :8000):
- **D1:** set limits + enable KPI-Guard (Max-DD %) + kill-switch (spike mult) → Save (no `422`) →
  reload → identical (round-trip); clear a field → payload `null`, field empty on reload; out-of-range →
  banner blocks Save; untouched-risk save = no-op; non-risk save regression OK. Inspect the
  `PUT …/config` body shape.
- **D2:** confirm per-strategy KPIs + portfolio DD render with denominator labels; `health_class`
  badge across `healthy/warning/critical/insufficient_data`; nullable → "—"; health drill-down shows
  `computed_at`; auto-poll refreshes (watch network tab; pauses when tab hidden).
- **D3:** open trace for a closed position → metadata + linkage + ordered timeline; `close_reason`
  prominent; read-only.

(Natural future unit seam, out of scope now: pure `toRiskForm ⇄ buildRiskConfigPayload` round-trip +
validation bounds.)

---

## 11. Boundaries
**Always do**
- Treat `RISK_GOVERNANCE.md` + OpenAPI as source of truth; keep `risk` on the existing config upsert.
- Honor every cross-cutting requirement in §2 (denominator labels, 4-state `health_class`, opt-in
  framing, KPI-Guard≠pre-trade, `net`/`replace`=W10).
- Lossless round-trips; empty ⇄ `null`; `tsc`+`lint` green per increment; use context7 for library docs.

**Ask first**
- Adding any dependency / test framework / route; any backend change.
- Touching anything in the OUT-OF-SCOPE list (§0); changing semantics beyond a muted hint.
- Restructuring the config form/dashboard beyond the inserts described here.

**Never do**
- Never send `0` where the user meant "off" — unset limits are `null`; never show `0` for a missing KPI.
- Never present ROI/DD without the per-trade-notional denominator label.
- Never style `insufficient_data` / `null` health as a failure.
- Never build UI for the 0%-backend items (2FA, promotion pipeline, SSE, anomaly detection).
- Never introduce `any`; never commit/push without explicit request.

---

## 12. Task breakdown (incremental, each ends green)
1. **D0 types** — swap stale portfolio types for openapi-derived; add health/trace/risk type exports. `tsc`.
2. **D1 types+mappers** — `AutoTradeRiskFormState`/defaults/`risk` field; `toRiskForm`/`buildRiskConfigPayload`/validation; wire into `toAutoTradeForm`. `tsc`.
3. **D1 section + wire-up** — `auto-trade-risk-section.tsx`; render in form; `risk` in `handleSave`. `build`.
4. **D1 verify** — round-trip QA (§10).
5. **D2 services + render** — `getStrategyHealth`; per-strategy KPI row + portfolio DD strip + health drill-down, all denominator-labeled. `build`.
6. **D2 auto-poll + verify** — 30 s poll w/ visibility pause; QA (§10).
7. **D3 service + trace modal** — `getPositionTrace`; trace drawer + open action. `build` + QA (§10).

> **Suggested delivery:** ship **D0+D1** first (the AC#4 critical path, fully self-contained), then
> **D2** (AC#7), then **D3**. Each deliverable is independently reviewable and mergeable.

---

*End of spec. On approval, implement task-by-task per §12.*
