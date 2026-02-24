import { apiRequest } from "@/lib/api/client";
import type { ExchangeSecretIn, ExchangeSecretOut } from "@/lib/api/types";

export async function encryptExchangeSecrets(payload: ExchangeSecretIn) {
  return apiRequest<ExchangeSecretOut>("/api/v1/exchange/encrypt", {
    method: "POST",
    body: payload,
  });
}
