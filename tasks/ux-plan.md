# UX/UI Overhaul — Implementation Plan

> План реализации [UX_SPEC.md](../UX_SPEC.md). Режим: read-only исследование завершено, ниже — нарезка на вертикальные задачи с acceptance-критериями, проверкой и чекпоинтами.
> Артефакты: этот файл + [ux-todo.md](./ux-todo.md). Не путать с `plan.md`/`todo.md` (трек M4) — те не трогаем.

**Дата:** 2026-06-22. **Статус:** Draft — ожидает ревью человеком перед стартом.

---

## A. Что выяснено по коду (grounding)

| Факт | Где | Влияние на план |
|------|-----|-----------------|
| Шапка показывает 7 ссылок + дублирующее меню; активность через `usePathname` | [app-header.tsx](../components/layout/app-header.tsx) | Полная переработка; перейти на `useSelectedLayoutSegment` |
| Лого ведёт на `/strategy` | app-header.tsx:100 | Сохраняем |
| shadcn-примитивов `dropdown-menu`/`sheet` нет; есть только badge/button/card/dialog/separator/skeleton/sonner/switch; `radix-ui@^1.4.3` в deps | `components/ui/`, package.json | T1: доустановить primitives |
| `lifecycle_stage` (`"sandbox"` и др.) есть на `portfolio.strategies[]` | dashboard:1029, [promotion-utils.ts](../components/monitor/promotion-utils.ts) | Источник для статус-бэйджа |
| Промоушен готов: `getPromotionStatus(configId)` → `{lifecycle_stage, sandbox_days, can_promote, criteria[]}`, где `criteria[] = {name, actual, threshold, passed}`; `promoteStrategy(configId)` (step-up gated) | [live-auto-trade.ts:240-252](../lib/api/services/live-auto-trade.ts), [promotion-gate-panel.tsx](../components/monitor/promotion-gate-panel.tsx), `PromotionGateCriterionRead` | Шаг KPI-gate переиспользует это; «осталось N сделок» = `threshold − actual` по критерию сделок — **считается на клиенте, бэкенд не нужен** |
| Создание стратегии сейчас: «Create new» → пустая форма → Save → Play. Визарда нет | dashboard `handleStartCreate`/`handleSave`/`handlePlay` | Визард — новый flow поверх тех же API |
| Бэктест — отдельная страница `/strategy`; шаги связаны через `submitBacktest`/`getBacktestResult` | [backtest.ts](../lib/api/services/backtest.ts) | Шаг 2 визарда переиспользует backtest-сервис |
| Layout: `AppHeader` + `AppStatusFooter` + провайдеры step-up/risk | [app/(app)/layout.tsx](<../app/(app)/layout.tsx>) | Статус из футера переезжает в шапку |

**Границы (из UX_SPEC §10):** бэкенд/OpenAPI не трогаем; типы только из `openapi-types.ts`; `SPEC.md` не перезаписываем; редизайн с нуля — нет.

---

## B. Граф зависимостей

```
Фаза 1 (Header)
  T1 deps+nav-model ──┬─> T2 desktop header (3 ссылки + dropdown)
                      ├─> T3 mobile sheet
                      └─> T4 status-indicator (перенос из footer)
                                │
Фаза 2 (Lifecycle)              │
  T5 strategy-status-badge ─────┼──> T6 integrate (dashboard + monitor)
                                │           │
Фаза 3 (Wizard)                 │           │ (T5 нужен шагу live)
  T7 route+stepper shell ─> T8 шаги 1-2 ─> T9 шаги 3-4 ─> T10 шаги 5-6 ─> T11 entry-point
                                                                │
Фаза 4 (Page hygiene)  ── зависит от Фаз 1-3 (стабильная навигация/бэйджи) ──
  T12 auto-trade · T13 strategy · T14 monitor · T15 settings/trade/forecasts  (параллельны)
                                │
Фаза 5 (Polish)
  T16 tokens/состояния  ·  T17 tests + build/lint gate
```

**Критический путь:** T1 → T2 → (Фаза 1 чекпоинт) → T5 → T7 → T8 → T9 → T10 → (Фаза 3 чекпоинт) → hygiene → polish.

---

## C. Задачи (вертикальные срезы)

Каждая задача — один сквозной работающий путь. Verification: `npm run lint && npm run build && npm run test` зелёные + ручная проверка указанного сценария.

### Фаза 1 — Header

#### T1 — Примитивы меню + модель навигации
- **Делаем:** `npx shadcn@latest add dropdown-menu sheet`; новый `lib/navigation.ts` — единый источник пунктов (primary[3], secondary[], admin[]) с `href`/`label`/`segment`/`icon`.
- **Acceptance:**
  - [ ] `components/ui/dropdown-menu.tsx` и `sheet.tsx` существуют, импортируются без ошибок.
  - [ ] `lib/navigation.ts` экспортирует разделённые группы; admin-группа помечена флагом `adminOnly`.
- **Verify:** `npm run build` проходит; ничего визуально не сломано (модель ещё не подключена).

#### T2 — Десктоп-шапка: 3 раздела + dropdown
- **Делаем:** переписать `app-header.tsx`; новый client-компонент `components/layout/nav-link.tsx` (`useSelectedLayoutSegment`); видимы лого + `Strategies/Auto-trade/Monitor`; `components/layout/profile-menu.tsx` (shadcn `DropdownMenu`) со вторичными ссылками + admin (гейт `canOpenAdminPages`) + Logout.
- **Acceptance:**
  - [ ] В desktop видны ровно: лого + 3 ссылки + статус-слот + меню-триггер.
  - [ ] Активный раздел подсвечен через `useSelectedLayoutSegment` (не `usePathname`).
  - [ ] Trade/Forecasts/Settings(Connect/Notifications/Security)/Admin/Logout доступны из dropdown ≤ 2 клика.
  - [ ] Admin-пункты скрыты при `canOpenAdminPages === false`.
  - [ ] Меню закрывается по Esc / клику вне / выбору пункта (radix-managed).
- **Verify:** ручной прогон навигации по всем разделам; проверка подсветки; admin-кейс (юзер без прав не видит admin).

#### T3 — Мобильная навигация (Sheet)
- **Делаем:** `components/layout/mobile-nav.tsx` — гамбургер → `Sheet` со всеми разделами + меню профиля списком; desktop-nav скрыт на `< md`.
- **Acceptance:**
  - [ ] На `< md` видны лого + гамбургер; вся навигация внутри `Sheet`.
  - [ ] Выбор пункта закрывает `Sheet` и переходит.
- **Verify:** ресайз окна / devtools mobile; прогон навигации.

#### T4 — Статус-индикатор в шапке
- **Делаем:** перенести health/sync-индикатор из `app-status-footer.tsx` в слот шапки (компактный `● цвет` + поповер деталей); упростить/удалить футер.
- **Acceptance:**
  - [ ] Индикатор виден в шапке, цвет отражает статус (ok/warn/error).
  - [ ] Детали доступны по клику; футер не дублирует то, что переехало.
- **Verify:** проверить состояния (при наличии sync-предупреждений индикатор меняет цвет).

> **🔶 Чекпоинт 1 (ревью человеком):** шапка финальна на desktop+mobile, навигация и admin-гейт корректны, статус переехал. Только после одобрения — Фаза 2.

---

### Фаза 2 — Lifecycle status

#### T5 — Единый `strategy-status-badge`
- **Делаем:** `components/auto-trade/strategy-status-badge.tsx` — маппинг `{lifecycle_stage, is_running, can_promote, paused-by-risk}` → бэйдж `Draft/Backtested/Sandbox/Eligible/Live/Paused` (цвет+подпись на базе `components/ui/badge`).
- **Acceptance:**
  - [ ] Чистая функция-маппер покрыта unit-тестом (все стадии → ожидаемый variant/label).
  - [ ] Нет дублирования логики статуса по компонентам.
- **Verify:** `npm run test` для маппера зелёный.

#### T6 — Интеграция бэйджа
- **Делаем:** подставить бэйдж в селектор Config Scope и Runtime Controls дашборда (вместо текстовых `enabled: false` / `running: false`) и в карточки `components/monitor/strategy-monitor-card.tsx`.
- **Acceptance:**
  - [ ] Дашборд и Monitor показывают один и тот же бэйдж для одной стратегии.
  - [ ] Текстовые `enabled:/running:` строки убраны или заменены бэйджем.
- **Verify:** визуально сверить стадию sandbox-стратегии в обоих местах.

> **🔶 Чекпоинт 2:** статусная модель едина и видна везде. Далее — визард.

---

### Фаза 3 — Launch wizard

#### T7 — Маршрут + каркас визарда
- **Делаем:** `app/(app)/auto-trade/new/page.tsx` + `components/auto-trade/launch-wizard/` (shell со степпером из `Badge`+разметки; состояние через локальный `useReducer`). Шаги-заглушки 1–6, навигация назад/вперёд с сохранением данных.
- **Acceptance:**
  - [ ] Маршрут открывается; 6 шагов проходимы; назад/вперёд сохраняет введённое.
  - [ ] Прогресс-степпер отражает текущий шаг.
- **Verify:** ручной проход пустого визарда туда-обратно.

#### T8 — Шаг 1 (стратегия) + Шаг 2 (бэктест)
- **Делаем:** шаг 1 — выбор типа стратегии и параметров (переиспользовать существующие формы из `components/trading/strategies/`); шаг 2 — `submitBacktest`/`getBacktestResult`, показ equity/winrate/maxDD/Sharpe, кнопка «Принять результат» / «Назад к шагу 1».
- **Acceptance:**
  - [ ] Шаг 1 валидирует параметры; «Дальше» неактивна при невалидных.
  - [ ] Шаг 2 реально запускает бэктест и показывает метрики; результат сохраняется в состоянии визарда.
- **Verify:** прогнать бэктест внутри визарда, увидеть метрики.

#### T9 — Шаг 3 (биржа) + Шаг 4 (sandbox)
- **Делаем:** шаг 3 — выбор/подключение аккаунта (`listExchangeAccounts`; инлайн-ссылка на Connect exchange при отсутствии) + размер позиции; шаг 4 — создать config (`upsertAutoTradeConfig`) в sandbox-стадии и запустить (`playAutoTrade`).
- **Acceptance:**
  - [ ] Если нет аккаунта — явная ссылка на подключение, шаг не даёт идти дальше.
  - [ ] По «Запустить sandbox» создаётся config и стартует sandbox; ошибки показываются тостом.
- **Verify:** создать стратегию в sandbox через визард, увидеть её на дашборде со статусом Sandbox.

#### T10 — Шаг 5 (KPI-gate) + Шаг 6 (promote → live)
- **Делаем:** шаг 5 — `getPromotionStatus(configId)` + переиспользовать `PromotionGatePanel`; «осталось N сделок» считаем на клиенте — новый чистый хелпер `lib/auto-trade/promotion.ts` (`remainingForCriterion(criteria, name) = max(0, threshold − actual)`, имя критерия сделок резолвим по `min_trades`/`trades`/`closed_trades`). Шаг 6 — `promoteStrategy(configId)` через step-up (`lib/api/step-up.ts` / `StepUpModal`); финальный статус-бэйдж Live (T5).
- **Бэкенд НЕ трогаем:** все нужные поля уже есть в `criteria[]` (см. §A). Gap-док не требуется.
- **Acceptance:**
  - [ ] Кнопка «Промоутить в live» неактивна, пока `can_promote !== true`; показано, чего не хватает (включая «осталось N сделок» из дельты критерия).
  - [ ] Хелпер `remainingForCriterion` покрыт unit-тестом.
  - [ ] Промоушен требует step-up при включённом требовании; успех → стадия Live.
- **Verify:** для eligible-стратегии пройти промоушен; для не-eligible убедиться, что кнопка заблокирована и показан остаток сделок.

#### T11 — Точка входа в визард + удаление старого «Create new»
- **Делаем:** кнопка «Новая стратегия» на дашборде Auto-trade → `/auto-trade/new`. **Удалить** старый «Create new» + `handleStartCreate` (визард полностью покрывает создание новой стратегии — кнопка стала избыточной). Селектор Config Scope и форма редактирования существующих config остаются.
- **Acceptance:**
  - [ ] С дашборда одной кнопкой открывается визард.
  - [ ] Старый «Create new» и `handleStartCreate` удалены; редактирование существующих стратегий не сломано.
  - [ ] Прерывание визарда не оставляет «висящую» стратегию (явный draft/cancel, без полузапущенного config).
- **Verify:** запуск визарда с дашборда; редактирование существующего config работает; отмена на середине не плодит мусорные config.

> **🔶 Чекпоинт 3:** полный путь sandbox → live проходится через визард. Далее — гигиена страниц.

---

### Фаза 4 — Page hygiene (параллельные срезы по экранам)

Каждая задача применяет чек-лист UX_SPEC §5: один primary CTA · состояния loading/empty/error · убрать дубль-подписи · технические термины в tooltip · единые форматы KPI.

- **T12 — Auto-trade** ([auto-trade-dashboard.tsx](../components/auto-trade/auto-trade-dashboard.tsx)): сократить пояснительные абзацы (напр. блок про Stop/Close), убрать `last_started_at:`-подобные технические строки в пользу читаемого вида, единый primary CTA, empty-states для логов/таблиц (уже частично есть «No events yet»).
- **T13 — Strategy builder** (`app/(app)/strategy`, `components/trading/*`): продвинутые параметры под «Advanced» (collapsible), убрать дубль-подписи полей.
- **T14 — Monitor** (`components/monitor/*`): единые форматы KPI через `kpi-format.tsx`, явный empty «нет активных стратегий».
- **T15 — Settings/Trade/Forecasts**: единый layout настроек, короткие подписи, success/error тосты; в Forecasts убрать технические имена файлов из основного текста.

**Acceptance (на каждую):** чек-лист §5 выполнен для экрана; нет регрессий функционала. **Verify:** визуальный проход экрана во всех состояниях (loading/empty/data/error).

> **🔶 Чекпоинт 4:** все экраны прошли гигиену. Далее — polish.

---

### Фаза 5 — Polish

#### T16 — Визуальная консистентность
- **Делаем:** единые токены отступов/типографики, консистентные карточки/бэйджи, унифицированные loading (`skeleton`)/empty/error состояния по приложению.
- **Acceptance:** [ ] Заголовки/отступы/карточки единообразны; нет «голых» пустых экранов.
- **Verify:** беглый аудит всех страниц.

#### T17 — Тесты и финальный гейт
- **Делаем:** unit-тесты по UX_SPEC §9 (nav-link активность; profile-menu admin-гейт+logout; status-badge маппинг; шаги визарда + блокировка «Live» до gate). Финальная регенерация типов при правках API-слоя.
- **Acceptance:** [ ] `npm run gen:api-types` (если трогали API-слой) · `npm run lint` · `npm run build` · `npm run test` — все зелёные.
- **Verify:** прогон полного флоу запуска на дев-стенде (skill `verify` / Chrome MCP).

---

## D. Решения (вопросы закрыты)
1. **T7:** ✅ Визард — **отдельный маршрут** `auto-trade/new`.
2. **T10:** ✅ Бэкенд **не нужен** — «осталось N сделок» считается на клиенте из `criteria[].{actual,threshold}`. Gap-док не требуется.
3. **T11:** ✅ Старый «Create new» **удаляем** (визард его покрывает).

## E. Порядок выполнения
1. Фаза 1 (T1→T2→T3→T4) → **Чекпоинт 1**
2. Фаза 2 (T5→T6) → **Чекпоинт 2**
3. Фаза 3 (T7→T8→T9→T10→T11) → **Чекпоинт 3**
4. Фаза 4 (T12–T15, параллельно) → **Чекпоинт 4**
5. Фаза 5 (T16, T17)

> Реализацию вести инкрементально (один срез = один коммит, build/lint/test зелёные). Старт — после одобрения этого плана и UX_SPEC.
