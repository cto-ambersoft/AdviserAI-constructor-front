# ТЗ: Telegram-уведомления о сделках (frontend)

Статус: контракт обновлён (см. §2), UI — к реализации.
Бэкенд: Phase 1 готов (см. `constructor/TELEGRAM_NOTIFICATIONS.md`).

---

## 1. Что делает фича

Пользователь подключает свой Telegram и получает сообщения, когда автоторговля
открывает/закрывает сделку (опционально — риск-события: kill-switch, авто-пауза).
Управление — на пользователя (одна привязка на аккаунт, общий вкл/выкл + тогглы
по типам событий). Бот — общий для сервиса; пользователю НЕ нужно создавать
своего бота, только нажать deep-link и отправить `/start`.

Сообщения шлёт бэкенд (cron раз в минуту читает события автоторговли и
отправляет). **Фронту не нужно ничего поллить ради самих уведомлений** — только
для отображения статуса привязки (см. §4).

---

## 2. Контракт — УЖЕ обновлён (этим коммитом)

Сделано, отдельно делать не нужно:
- `openapi.json` — синхронизирован с бэкендом (добавлены telegram-операции).
- `lib/api/openapi-types.ts` — перегенерирован (`npm run gen:api-types`, нужен Node ≥18).
- `lib/api/types.ts` — добавлены алиасы `TelegramSettingsOut`, `TelegramSettingsUpdate`,
  `TelegramLinkOut`, `TelegramTestResult`.
- `lib/api/services/telegram.ts` — типизированные функции (ниже).
- `lib/api/index.ts` — реэкспорт нового сервиса.

Доступные функции (`import { ... } from "@/lib/api"`):

| Функция | Метод/путь | Возвращает |
|---|---|---|
| `getTelegramSettings()` | `GET /api/v1/live/notifications/telegram` | `TelegramSettingsOut` |
| `updateTelegramSettings(payload)` | `PUT …/telegram` | `TelegramSettingsOut` |
| `linkTelegram()` | `POST …/telegram/link` | `TelegramLinkOut` |
| `sendTelegramTest()` | `POST …/telegram/test` | `TelegramTestResult` |
| `unlinkTelegram()` | `DELETE …/telegram` | `TelegramSettingsOut` |

Типы:
```ts
TelegramSettingsOut = {
  linked: boolean;          // chat_id привязан
  enabled: boolean;         // мастер-выключатель
  notify_on_open: boolean;
  notify_on_close: boolean;
  notify_on_risk: boolean;
  linked_at: string | null; // ISO
}
TelegramSettingsUpdate = {  // все поля опциональны (partial)
  enabled?: boolean | null;
  notify_on_open?: boolean | null;
  notify_on_close?: boolean | null;
  notify_on_risk?: boolean | null;
}
TelegramLinkOut = {
  code: string;
  deep_link: string | null; // https://t.me/<bot>?start=<code> — null если бот без username
  expires_at: string | null;// ISO, обычно +15 мин
}
TelegramTestResult = { status: string; error: string | null }  // status: "sent" | "error" | ...
```

Коды ошибок `apiRequest`/`ApiError` (уже маппятся в `lib/api/client.ts`):
- **503 `service_unavailable`** — Telegram не сконфигурирован на бэке (нет токена).
  Прятать/дизейблить блок и показывать «уведомления недоступны».
- 401 — общий редирект на логин (как везде).

---

## 3. Что нужно реализовать (UI)

### 3.1 Страница/раздел настроек
Новый раздел **«Telegram-уведомления»**. Рекомендую страницу
`app/(app)/settings/notifications/page.tsx` (рядом с
`settings/connect-exchange`). Добавить пункт в навигацию настроек, если она есть.

### 3.2 Состояния экрана

**A. Загрузка** — `getTelegramSettings()` при маунте.

**B. Не сконфигурировано (503)** — инфо-блок «Уведомления временно недоступны»,
контролы скрыты/дизейбл.

**C. Не привязан** (`linked === false`):
- Кнопка **«Подключить Telegram»** → `linkTelegram()`.
- По ответу: открыть `deep_link` (`window.open(deep_link, "_blank")`) и/или
  показать его как ссылку/QR + текст «Откройте бота и нажмите Start».
- Если `deep_link === null` — показать `code` и инструкцию найти бота вручную
  (фолбэк; в норме username настроен на бэке).
- Показать «ссылка действует до `expires_at`».

**D. Привязан** (`linked === true`):
- Бейдж «Подключено» + `linked_at`.
- Свитчи: **enabled** (мастер), **notify_on_open**, **notify_on_close**,
  **notify_on_risk**. Изменение → `updateTelegramSettings({...})` (можно слать
  только изменённое поле). Дочерние свитчи логично дизейблить при `enabled=false`.
- Кнопка **«Отправить тест»** → `sendTelegramTest()`; по `status==="sent"` —
  success-toast, иначе error-toast c `error`.
- Кнопка **«Отключить»** → `unlinkTelegram()` → вернуться в состояние C.

### 3.3 Тосты
Использовать существующий `lib/notifications.ts` (sonner): success при
сохранении/тесте, `notifyApiError` при ошибках.

---

## 4. Поток привязки (UX)

```
[Подключить] → linkTelegram() → открыть deep_link → юзер жмёт Start в Telegram
   → бэкенд webhook сохраняет chat_id (без участия фронта)
   → фронт обновляет статус: либо кнопка «Проверить», либо лёгкий polling
```

Рекомендация: после открытия deep-link запустить **короткий polling**
`getTelegramSettings()` (например, каждые 3 c, максимум ~2 мин или до
`expires_at`), пока `linked` не станет `true`; затем остановить и показать
состояние D. Альтернатива без поллинга — кнопка «Я нажал Start, проверить».
Не поллить бесконечно.

---

## 5. Состояние (state)

Достаточно локального состояния страницы (`useState` + `useEffect`) — фича
изолированная. Глобальный zustand-стор не обязателен; заводить только если
статус привязки нужен где-то ещё (напр. иконка-индикатор в шапке).

---

## 6. Env

**Новых фронтовых env НЕ требуется.** Базовый `NEXT_PUBLIC_API_BASE_URL` уже
используется. Имя бота приходит в `deep_link` с бэкенда — фронту знать его не
нужно. (Все telegram-секреты живут только на бэкенде.)

---

## 7. Критерии приёмки

- [ ] Раздел настроек «Telegram-уведомления» доступен и грузит текущие настройки.
- [ ] Состояние «не сконфигурировано» (503) обрабатывается без падений.
- [ ] Кнопка «Подключить» открывает deep-link; после `/start` в Telegram UI
      переходит в состояние «Подключено» (через polling или ручную проверку).
- [ ] Свитчи enabled/open/close/risk сохраняются через `updateTelegramSettings`
      и переживают перезагрузку страницы.
- [ ] «Отправить тест» шлёт сообщение и показывает корректный тост по результату.
- [ ] «Отключить» снимает привязку и возвращает в исходное состояние.
- [ ] `npm run lint` и `tsc --noEmit` чистые; типы берутся из `@/lib/api`
      (никаких `any`/ручных интерфейсов под эти контракты).

---

## 8. Тех. заметки

- Codegen типов: `npm run gen:api-types` (нужен **Node ≥18**; дефолтный node v14
  падает на `??=`). При следующем изменении бэкенд-контракта: скопировать свежий
  `openapi.json` из `constructor/` и перегенерировать.
- Webhook `/api/v1/telegram/webhook/{secret}` — серверный, в `openapi.json`
  намеренно скрыт (`include_in_schema=False`); фронту не нужен.
- Задержка уведомления о сделке — до ~60 c (cron). Это ожидаемо, не баг.
