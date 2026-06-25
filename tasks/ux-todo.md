# UX/UI Overhaul — TODO

> Чек-лист к [ux-plan.md](./ux-plan.md). Один срез = один коммит, `lint`+`build`+`test` зелёные.

## Фаза 1 — Header
- [x] **T1** — примитивы `dropdown-menu`/`sheet` (вручную, стиль репо) + `lib/navigation.ts` (primary[3]/menu-groups/admin-флаг) + тест ✅
- [x] **T2** — десктоп-шапка: лого + 3 ссылки + `profile-menu` dropdown; `nav-link` на `useSelectedLayoutSegment`; admin-гейт ✅
- [x] **T3** — мобильная навигация через `Sheet` (гамбургер `< md`, вся навигация + logout внутри) ✅
- [x] **T4** — статус-индикатор перенесён из футера в шапку (tri-state ok/warn/error + popover деталей; футер удалён) ✅
- [ ] 🔶 **Чекпоинт 1** — ревью шапки (desktop+mobile, admin, статус)

## Фаза 2 — Lifecycle status
- [x] **T5** — `strategy-status-badge` + `deriveStrategyStatus` маппер (Live/Paused/Sandbox/Eligible/Validation/Research/Rejected/Archived) + unit-тест ✅
- [x] **T6** — интеграция бэйджа в дашборд + Monitor; убраны текстовые `enabled:/running:` и дублирующий `LifecycleStageBadge` ✅
- [x] 🔶 **Чекпоинт 2** — единая статусная модель видна везде ✅

## Фаза 3 — Launch wizard
- [x] **T7** — маршрут `auto-trade/new` + каркас степпера + reducer-состояние (назад/вперёд сохраняет) ✅
- [x] **T8** — шаг 1 (выбор профиля + имя) + шаг 2 (ATR-бэктест с метриками + accept); gating Next через `canLeaveStep` ✅
- [x] **T9** — шаг 3 (биржа/размер + connect-link) + шаг 4 (создать config + запустить sandbox) ✅
- [x] **T10** — шаг 5 (`getPromotionStatus` + gate-панель + `remainingTrades` на клиенте) + шаг 6 (`promoteStrategy` через step-up) ✅
- [x] **T11** — кнопка «New strategy» в шапке дашборда → визард; удалён старый «Create new»/`handleStartCreate` ✅
- [x] 🔶 **Чекпоинт 3** — путь sandbox → live проходится через визард ✅

## Фаза 4 — Page hygiene
- [x] **T12** — Auto-trade: читаемые labels вместо `last_started_at:`/`symbol:`, короче подзаголовок + Stop/Close, убраны backticks ✅
- [x] **T13** — Strategy builder: убран технический текст `include_series=false` → человеко-читаемый; формы уже на чистой `Label`/`Field` абстракции (дублей нет) ✅
- [x] **T14** — Monitor: явный empty-state «No active strategies» с CTA на визард; KPI уже через `kpi-format.tsx` ✅
- [x] **T15** — Forecasts: сырое имя файла убрано из таблицы в tooltip. (Единый settings-layout отложен: нужен рефактор `<main>`-обёрток с проверкой в браузере.) ✅
- [x] 🔶 **Чекпоинт 4** — основные экраны прошли гигиену (settings-layout — на in-browser ревью)

## Фаза 5 — Polish
- [x] **T16** — корректное loading-состояние выбора профиля в визарде («Loading profiles…»); консистентные empty/CTA состояния добавлены в T12/T14 ✅
- [x] **T17** — §9 unit-тесты на месте (nav-link/profile-menu/status-badge/wizard-gate); `gen:api-types` без дрейфа, `tsc`/`lint`/`build`/`test` (104) зелёные. Ручной in-browser прогон — за пользователем ✅

## Решения (закрыто)
- [x] Q1 (T7): визард — отдельный маршрут `auto-trade/new` ✅
- [x] Q2 (T10): бэкенд не нужен — «осталось N сделок» из `criteria[]` на клиенте ✅
- [x] Q3 (T11): старый «Create new» — удаляем ✅
