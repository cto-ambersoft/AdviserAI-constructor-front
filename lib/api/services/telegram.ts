import { apiRequest } from "@/lib/api/client";
import type {
  TelegramLinkOut,
  TelegramSettingsOut,
  TelegramSettingsUpdate,
  TelegramTestResult,
} from "@/lib/api/types";

const BASE = "/api/v1/live/notifications/telegram";

export async function getTelegramSettings() {
  return apiRequest<TelegramSettingsOut>(BASE, { method: "GET" });
}

export async function updateTelegramSettings(payload: TelegramSettingsUpdate) {
  return apiRequest<TelegramSettingsOut>(BASE, { method: "PUT", body: payload });
}

/** Generate a one-time deep link the user opens to connect their Telegram. */
export async function linkTelegram() {
  return apiRequest<TelegramLinkOut>(`${BASE}/link`, { method: "POST" });
}

/** Send a test message to the linked chat (verifies the connection). */
export async function sendTelegramTest() {
  return apiRequest<TelegramTestResult>(`${BASE}/test`, { method: "POST" });
}

export async function unlinkTelegram() {
  return apiRequest<TelegramSettingsOut>(BASE, { method: "DELETE" });
}
