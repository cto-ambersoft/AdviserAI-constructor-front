# TODO — Frontend support for backend W9 "Risk Enforcement"

> Tracks [tasks/plan.md](plan.md) / [SPEC.md](../SPEC.md). Status: `[ ]` todo · `[~]` in progress ·
> `[x]` done · `[!]` blocked. Each task ends green (`tsc --noEmit` + `lint`; `build` where UI ships).
> Use **context7** for any Next.js 16 / React 19 API question during implementation.

---

## Phase 0 — Type foundation (D0) · prereq, unblocks all
- [x] **T0.1** Swap stale portfolio types → openapi-derived; export risk/health/trace types — `f7fbac6` (+ contract regen `d9147ae`)
  - [ ] `lib/api/types.ts`: `AutoTradeRiskConfig`, `StrategyPortfolioEntry`(=`StrategyPortfolioEntryRead`), `PortfolioSummaryResponse`, `StrategyHealthRead`, `PositionTraceRead`
  - [ ] delete hand-written `StrategyPortfolioEntry` / `PortfolioSummaryResponse` (lines ~282-310)
  - **AC:** existing consumers compile unchanged (additive nullable fields)
  - **Verify:** `npx tsc --noEmit` ✔ · `npm run lint` ✔
  - ☑️ **Checkpoint 0** (mechanical): typecheck green ⇒ proceed

## Phase 1 — Risk Governance config UI (D1) · P0 · AC#4
- [x] **T1.1** Risk form-state + defaults + mappers + validation (pure logic) — `9ea499d`
  - [ ] `components/auto-trade/types.ts`: `ConflictingSignalPolicy`, `AutoTradeRiskFormState`, `DEFAULT_RISK_CONFIG`, `risk` on `AutoTradeFormState`
  - [ ] `components/auto-trade/utils.ts`: `toRiskForm()` (+ wire into `toAutoTradeForm`), `buildRiskConfigPayload()`, risk rules in `getAutoTradeValidation`
  - **AC:** `toRiskForm(buildRiskConfigPayload(x))` identity for valid x; bounds produce clear messages; no-risk config → defaults
  - **Verify:** `npx tsc --noEmit` ✔ · `npm run lint` ✔
- [x] **T1.2** Risk Governance section + wire-up + save — `63b5b9a`
  - [ ] new `components/auto-trade/auto-trade-risk-section.tsx` (3 sub-cards; `net`/`replace`="W10 not yet enforced"; KPI-Guard≠pre-trade copy)
  - [ ] render in `auto-trade-config-form.tsx` (after Strategy Profile, before AI Overlay)
  - [ ] `auto-trade-dashboard.tsx` `handleSave`: add `risk: buildRiskConfigPayload(form.risk)`
  - **AC:** all 18 fields editable; empty ⇄ `null`; gated by master + sub-toggles; validation blocks bad input
  - **Verify:** `npm run build` ✔
- [~] ✅ **Checkpoint A — D1 QA + human review (AC#4):** *(awaiting user manual QA against a running backend)* round-trip save/reload identical; clear→`null`; no `422`; out-of-range blocked; risk-untouched save = no-op; non-risk regression OK. *Independently mergeable.*
  - automated gates done: `tsc --noEmit` ✔ · `lint` ✔ · `build` ✔ (Node 20)

## Phase 2 — Live KPI Monitor (D2) · P1 · AC#7
- [x] **T2.1** Health service + per-strategy KPIs + portfolio DD strip — `2fd4cd9`
  - note: consolidated the per-strategy KPIs into a dedicated `auto-trade-health-card.tsx` (cleaner than overloading the budget card); denominator-labeled; 4-state `health_class`; `null`→"—"
- [x] **T2.2** Selected-strategy health drill-down — `b9c0dc7` (composite added to the same card; `getStrategyHealth` fetch keyed by config_id; insufficient_data/404 handled)
- [x] **T2.3** Auto-poll (30 s, visibility-paused) — `3689656`
- [~] ✅ **Checkpoint B — D2 QA + human review (AC#7):** *(awaiting user manual QA against a running backend)* labeled KPIs; all health classes; auto-poll behaves.
  - automated gates done: `tsc --noEmit` ✔ · `lint` ✔ · `build` ✔ (Node 20)

## Phase 3 — Post-Trade Trace viewer (D3) · P2 · W9 T3.1
- [x] **T3.1** Trace service + positions card + trace modal (building blocks) — `55342a8`
  - `getPositionTrace()`; `auto-trade-positions-card.tsx`; `auto-trade-position-trace-modal.tsx` (header + close_reason highlight; linkage chips incl. decision_event_id surfaced-not-dereferenced; ordered event timeline; read-only)
- [x] **T3.2** Wire positions panel + trace drawer into dashboard — `b79a3f2`
  - scoped `getAutoTradePositions` fetch; Trace action opens the modal
- [~] ✅ **Checkpoint C — D3 QA + human review:** *(awaiting user manual QA against a running backend)* trace opens (ideally a kill-switch/auto-pause close); timeline ordered; read-only.
  - automated gates done: `tsc --noEmit` ✔ · `lint` ✔ · `build` ✔ (Node 20)

---

### Global gates (every task)
- [ ] no new dependency / route / backend change · no `any` · empty⇄`null` · ROI/DD denominator-labeled · `net`/`replace`=W10
- [ ] never commit/push without explicit request
